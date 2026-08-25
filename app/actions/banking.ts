'use server'

import { db } from '@/lib/db'
import {
  bankAccount,
  disbursement,
  paymentReceipt,
  profile,
  loan as loansTable,
  user,
} from '@/lib/db/schema'
import { assertRole, requireAdmin } from '@/lib/session'
import { receiptBranding } from '@/lib/brand'
import { recordAudit } from '@/lib/audit'
import { requireAcceptedContract } from '@/lib/legal/expediente'
import { activateLoanAfterDisbursement } from '@/lib/loan-schedule'
import { revalidateOps } from '@/lib/revalidate'
import { and, eq, sql, desc, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { formatCBU, formatCVU, formatAlias, isValidBankAlias, normalizeBankAlias } from '@/lib/finance'
import { persistBankLookup } from '@/lib/bank-lookup'
import { validateBankAccountAuto } from '@/lib/argenapi'

type AccountType = 'cbu' | 'cvu' | 'alias' | 'cci'

const RE_CUIL = /^\d{11}$/
const RE_CBU_CVU = /^\d{22}$/
const RE_ALIAS = /^[a-z0-9.]{6,20}$/
const RE_SWIFT_CCI = /^[A-Z0-9]{8,34}$/
const RE_DNI_AR = /^\d{7,8}$/

function validateCuilMod11(cuil: string): boolean {
  if (!RE_CUIL.test(cuil)) return false
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cuil[i], 10) * factors[i]
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return parseInt(cuil[10], 10) === expected
}

export async function getMyBankAccounts() {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
    .orderBy(desc(bankAccount.isPrimary), desc(bankAccount.createdAt))
}

export async function getPrimaryBankAccount() {
  const accounts = await getMyBankAccounts()
  return accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null
}

export async function createBankAccount(input: {
  accountType: AccountType
  bankName: string
  accountNumber?: string
  cbu?: string
  cvu?: string
  alias?: string
  holderName: string
  holderCuil: string
  holderDocumentType?: string
  holderDocumentNumber?: string
  setAsPrimary?: boolean
}) {
  const userId = await assertRole('customer')
  const id = crypto.randomUUID()

  if (!input.holderName?.trim()) {
    throw new Error('Nombre del titular obligatorio')
  }
  if (!input.holderCuil) {
    throw new Error('CUIL del titular obligatorio')
  }
  if (!validateCuilMod11(input.holderCuil)) {
    throw new Error('CUIL inválido: deben ser 11 dígitos con dígito verificador correcto')
  }
  if (input.holderDocumentType && input.holderDocumentNumber) {
    const docType = input.holderDocumentType.toUpperCase()
    const docNum = input.holderDocumentNumber.trim()
    if (docType === 'DNI' || docType === 'LC' || docType === 'LE') {
      if (!RE_DNI_AR.test(docNum)) {
        throw new Error('Número de documento inválido (DNI: 7-8 dígitos)')
      }
    }
  }

  const accountType = input.accountType
  if (accountType === 'cbu') {
    const val = (input.cbu ?? input.accountNumber ?? '').trim()
    if (!val) throw new Error('CBU o número de cuenta requerido')
    if (!RE_CBU_CVU.test(val)) {
      throw new Error('CBU inválido: deben ser exactamente 22 dígitos')
    }
  } else if (accountType === 'cvu') {
    const val = (input.cvu ?? '').trim()
    if (!val) throw new Error('CVU requerido')
    if (!RE_CBU_CVU.test(val)) {
      throw new Error('CVU inválido: deben ser exactamente 22 dígitos')
    }
  } else if (accountType === 'alias') {
    const val = normalizeBankAlias(input.alias ?? '')
    if (!val) throw new Error('Alias requerido')
    if (!isValidBankAlias(val) || !RE_ALIAS.test(val)) {
      throw new Error('Alias inválido: 6 a 20 caracteres (letras, números y punto). No uses @.')
    }
    input.alias = val
  } else if (accountType === 'cci') {
    const val = (input.accountNumber ?? '').trim().toUpperCase()
    if (!val) throw new Error('Número CCI / SWIFT / IBAN requerido')
    if (!RE_SWIFT_CCI.test(val)) {
      throw new Error('CCI/SWIFT/IBAN inválido: 8-34 caracteres alfanuméricos')
    }
    input.accountNumber = val
  }

  const setAsPrimary = input.setAsPrimary ?? false

  const [result] = await db.transaction(async (tx) => {
    if (setAsPrimary) {
      await tx
        .update(bankAccount)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(bankAccount.userId, userId))
    }
    return tx
      .insert(bankAccount)
      .values({
        id,
        userId,
        accountType,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        cbu: input.cbu,
        cvu: input.cvu,
        alias: input.alias ? normalizeBankAlias(input.alias) : input.alias,
        holderName: input.holderName.trim(),
        holderCuil: input.holderCuil,
        holderDocumentType: input.holderDocumentType,
        holderDocumentNumber: input.holderDocumentNumber,
        isPrimary: setAsPrimary,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
  })

  if (result.cbu || result.cvu || result.alias) {
    try {
      const lookup = await validateBankAccountAuto({
        cbu: result.cbu,
        cvu: result.cvu,
        alias: result.alias,
      })
      await persistBankLookup({
        bankAccountId: result.id,
        lookup,
        actorUserId: userId,
        source: 'unicred_on_create',
      })
    } catch (e) {
      console.warn('[banking] lookup on create skipped:', (e as Error).message)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  return { ok: true, id: result.id }
}

export async function updateBankAccount(
  id: string,
  input: {
    accountType?: AccountType
    bankName?: string
    accountNumber?: string
    cbu?: string
    cvu?: string
    alias?: string
    holderName?: string
    holderCuil?: string
  },
) {
  const userId = await assertRole('customer')
  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
    .limit(1)
  if (!acc) throw new Error('Cuenta no encontrada')

  const accountType = input.accountType ?? (acc.accountType as AccountType)
  const next: Record<string, unknown> = {
    accountType,
    updatedAt: new Date(),
    isVerified: false,
    verificationMethod: null,
    verifiedAt: null,
    verifiedBy: null,
  }

  if (input.bankName?.trim()) next.bankName = input.bankName.trim()
  if (input.holderName?.trim()) next.holderName = input.holderName.trim()
  if (input.holderCuil) {
    if (!validateCuilMod11(input.holderCuil)) {
      throw new Error('CUIL inválido: deben ser 11 dígitos con dígito verificador correcto')
    }
    next.holderCuil = input.holderCuil
  }

  if (accountType === 'cbu') {
    const val = (input.cbu ?? input.accountNumber ?? acc.cbu ?? '').trim()
    if (!RE_CBU_CVU.test(val)) throw new Error('CBU inválido: deben ser exactamente 22 dígitos')
    next.cbu = val
    next.cvu = null
    next.alias = input.alias ? normalizeBankAlias(input.alias) : acc.alias
  } else if (accountType === 'cvu') {
    const val = (input.cvu ?? acc.cvu ?? '').trim()
    if (!RE_CBU_CVU.test(val)) throw new Error('CVU inválido: deben ser exactamente 22 dígitos')
    next.cvu = val
    next.cbu = null
    next.alias = input.alias ? normalizeBankAlias(input.alias) : acc.alias
  } else if (accountType === 'alias') {
    const val = normalizeBankAlias(input.alias ?? acc.alias ?? '')
    if (!isValidBankAlias(val)) {
      throw new Error('Alias inválido: 6 a 20 caracteres (letras, números y punto). No uses @.')
    }
    next.alias = val
  } else if (accountType === 'cci') {
    const val = (input.accountNumber ?? acc.accountNumber ?? '').trim().toUpperCase()
    if (!RE_SWIFT_CCI.test(val)) throw new Error('CCI/SWIFT/IBAN inválido')
    next.accountNumber = val
  }

  await db
    .update(bankAccount)
    .set(next as any)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  revalidatePath('/admin')
  return { ok: true, id }
}

export async function setPrimaryBankAccount(id: string) {
  const userId = await assertRole('customer')

  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
    .limit(1)

  if (!acc) throw new Error('Cuenta no encontrada')

  await db.transaction(async (tx) => {
    await tx
      .update(bankAccount)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(bankAccount.userId, userId))
    await tx
      .update(bankAccount)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  return { ok: true }
}

export async function deleteBankAccount(id: string) {
  const userId = await assertRole('customer')

  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
    .limit(1)

  if (!acc) throw new Error('Cuenta no encontrada')

  await db.transaction(async (tx) => {
    if (acc.isPrimary) {
      const others = await tx
        .select({ id: bankAccount.id })
        .from(bankAccount)
        .where(
          and(
            eq(bankAccount.userId, userId),
            eq(bankAccount.isActive, true),
            ne(bankAccount.id, id),
          ),
        )
        .limit(1)
      await tx
        .update(bankAccount)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
      if (others[0]) {
        await tx
          .update(bankAccount)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(and(eq(bankAccount.id, others[0].id), eq(bankAccount.userId, userId)))
      }
    }
    await tx
      .update(bankAccount)
      .set({ isActive: false, isPrimary: false, updatedAt: new Date() })
      .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  return { ok: true }
}

export async function getDisbursementsForLoan(loanId: string) {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(disbursement)
    .where(and(eq(disbursement.loanId, loanId), eq(disbursement.userId, userId)))
    .limit(1)
}

export async function getMyDisbursements() {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(disbursement)
    .where(eq(disbursement.userId, userId))
    .orderBy(sql`${disbursement.createdAt} desc`)
}

export async function generateDisbursementReceipt(disbursementId: string) {
  const userId = await assertRole('customer')

  const [d] = await db
    .select()
    .from(disbursement)
    .where(and(eq(disbursement.id, disbursementId), eq(disbursement.userId, userId)))
    .limit(1)

  if (!d) throw new Error('Desembolso no encontrado')

  const bank = d.bankAccountId
    ? (
        await db
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.id, d.bankAccountId))
          .limit(1)
      )[0]
    : undefined

  const id = crypto.randomUUID()
  const receiptNumber = `ACR-${Date.now().toString().slice(-8)}`

  const [receipt] = await db
    .insert(paymentReceipt)
    .values({
      id,
      receiptNumber,
      receiptType: 'disbursement',
      userId,
      disbursementId: d.id,
      loanId: d.loanId,
      amount: d.amount,
      currency: d.currency,
      previousBalance: '0',
      newBalance: '0',
      pendingInstallments: 0,
      totalPaidToDate: '0',
      bankAccountSnapshot: bank ? JSON.parse(JSON.stringify(bank)) : null,
      method: d.disbursementMethod,
      referenceNumber: d.referenceNumber,
      paidAt: d.creditedAt,
      issuedAt: new Date(),
      branding: JSON.parse(JSON.stringify(receiptBranding())),
      createdAt: new Date(),
    })
    .returning()

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/comprobantes')
  return { ok: true, receiptId: receipt.id, receiptNumber }
}

export async function getDisbursementReceipts(loanId: string) {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(paymentReceipt)
    .where(
      and(
        eq(paymentReceipt.loanId, loanId),
        eq(paymentReceipt.userId, userId),
        eq(paymentReceipt.receiptType, 'disbursement'),
      ),
    )
}

export async function registerBankAccountVerification(id: string, method: 'deposito' | 'otp' | 'argenapi' = 'argenapi') {
  const userId = await assertRole('customer')

  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
    .limit(1)
  if (!acc) throw new Error('Cuenta no encontrada')

  if (method === 'argenapi') {
    return validateBankAccountLive(id)
  }

  await db
    .update(bankAccount)
    .set({
      verificationMethod: method,
      verificationCodeSentAt: new Date(),
      verificationAttempts: (acc.verificationAttempts ?? 0) + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  return { ok: true, method }
}

export async function validateBankAccountLive(id: string) {
  const userId = await assertRole('customer')

  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))
    .limit(1)
  if (!acc) return { ok: false, message: 'Cuenta no encontrada', isVerified: false }
  if (!acc.cbu && !acc.cvu && !acc.alias) {
    return { ok: false, message: 'Falta CBU, CVU o ALIAS para validar', isVerified: false }
  }

  const attemptIdx = (acc.verificationAttempts ?? 0) + 1
  try {
    const r = await validateBankAccountAuto({
      cbu: acc.cbu,
      cvu: acc.cvu,
      alias: acc.alias ? normalizeBankAlias(acc.alias) : acc.alias,
    })
    const persisted = await persistBankLookup({
      bankAccountId: id,
      lookup: r,
      actorUserId: userId,
      source: 'unicred_customer',
    })
    const best = r.best
    const ok = persisted.ok
    const status = best?.status ?? 'api_error'
    const msg = best?.message

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/perfil')
    revalidatePath('/admin')

    if (ok) {
      const ent = best?.data?.entidad ? ` · ${best.data.entidad}` : ''
      return {
        ok: true,
        isVerified: true,
        message: `Cuenta actualizada y guardada${ent}. Titular: ${persisted.extracted?.titular || acc.holderName}.`,
        status,
      }
    }

    const userMsg =
      status === 'not_found' ? 'Alias/CBU/CVU no encontrado en la red bancaria argentina.' :
      status === 'invalid_format' ? 'Formato inválido. El alias no lleva @ (6-20 caracteres: letras, números y punto). CBU/CVU: 22 dígitos.' :
      status === 'missing_key' ? 'Error interno: credencial ArgenAPI no configurada en servidor.' :
      status === 'timeout' ? 'Tiempo de espera agotado consultando BCRA/ArgenAPI. Reintentá en 10s.' :
      status === 'bad_request' ? 'Solicitud rechazada por ArgenAPI.' :
      msg || `Rechazado por ArgenAPI (${status}).`

    return {
      ok: false,
      isVerified: false,
      message: userMsg,
      status,
    }
  } catch (e: any) {
    await db
      .update(bankAccount)
      .set({
        verificationMethod: 'argenapi',
        verificationAttempts: attemptIdx,
        updatedAt: new Date(),
      })
      .where(and(eq(bankAccount.id, id), eq(bankAccount.userId, userId)))

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/perfil')

    return {
      ok: false,
      isVerified: false,
      message: e?.message ?? 'Error desconocido validando cuenta bancaria',
      status: 'api_error' as const,
    }
  }
}

export async function markDisbursementAsCredited(
  disbursementId: string,
  externalRef?: string,
) {
  const adminUserId = await requireAdmin()

  const [d] = await db
    .select()
    .from(disbursement)
    .where(eq(disbursement.id, disbursementId))
    .limit(1)
  if (!d) throw new Error('Desembolso no encontrado')
  if (d.status === 'credited') throw new Error('Desembolso ya acreditado')

  const now = new Date()
  // Determinístico: si el admin hace doble clic, el segundo intento choca contra
  // el número de comprobante ya emitido en vez de generar uno nuevo.
  const receiptNumber = `DES-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${d.id.slice(-8).toUpperCase()}`

  const bank = d.bankAccountId
    ? (
        await db
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.id, d.bankAccountId))
          .limit(1)
      )[0]
    : undefined

  const loan = d.loanId
    ? (
        await db
          .select()
          .from(loansTable)
          .where(eq(loansTable.id, d.loanId))
          .limit(1)
      )[0]
    : undefined

  if (loan && (loan.status === 'rejected' || loan.status === 'cancelled' || loan.status === 'paid')) {
    throw new Error('Este crédito no puede desembolsarse en su estado actual.')
  }
  if (loan && loan.status === 'pending') {
    throw new Error('Aprobá el crédito antes de acreditar el desembolso.')
  }
  if (loan) {
    await requireAcceptedContract(loan.id)
  }

  const custRows = await db
    .select({
      fullName: user.name,
      cuil: profile.cuil,
      email: user.email,
      phone: profile.phone,
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.userId, d.userId))
    .limit(1)
  const cust = custRows[0] ?? null

  await db.transaction(async (tx) => {
    // La condición sobre el estado va en el UPDATE: si dos acreditaciones entran
    // a la vez, sólo una encuentra el desembolso pendiente.
    const acquired = await tx
      .update(disbursement)
      .set({
        status: 'credited',
        creditedAt: now,
        receiptNumber,
        referenceNumber: externalRef ?? d.referenceNumber,
        processedBy: adminUserId,
        updatedAt: now,
      })
      .where(and(eq(disbursement.id, disbursementId), ne(disbursement.status, 'credited')))
      .returning({ id: disbursement.id })

    if (acquired.length === 0) throw new Error('Desembolso ya acreditado')

    if (loan) {
      await activateLoanAfterDisbursement(tx, {
        loanId: loan.id,
        userId: d.userId,
        principal: Number(loan.principal),
        term: loan.term,
        monthlyRate: Number(loan.monthlyRate),
        now,
      })
    }

    await tx.insert(paymentReceipt).values({
      id: crypto.randomUUID(),
      receiptNumber,
      receiptType: 'disbursement',
      userId: d.userId,
      disbursementId: d.id,
      loanId: d.loanId ?? null,
      installmentId: null,
      amount: d.amount,
      currency: d.currency,
      previousBalance: '0',
      newBalance: String(loan?.totalAmount ?? d.amount),
      pendingInstallments: Number(loan?.term ?? 0),
      totalPaidToDate: '0',
      loanSnapshot: loan ? JSON.parse(JSON.stringify(loan)) : null,
      customerSnapshot: cust ? JSON.parse(JSON.stringify(cust)) : null,
      bankAccountSnapshot: bank ? JSON.parse(JSON.stringify(bank)) : null,
      method: d.disbursementMethod,
      referenceNumber: externalRef ?? d.referenceNumber,
      paidAt: now,
      issuedAt: now,
      branding: JSON.parse(JSON.stringify(receiptBranding())),
      createdAt: now,
    })
  })

  await recordAudit({
    actorUserId: adminUserId,
    action: 'DISBURSEMENT_CREDITED',
    entityType: 'disbursement',
    entityId: d.id,
    targetUserId: d.userId,
    summary: `Desembolso acreditado por ${d.amount} ${d.currency} · comprobante ${receiptNumber}`,
    changes: { estado: { antes: d.status, despues: 'credited' }, referencia: externalRef ?? null },
  })

  revalidateOps()
  return { ok: true, receiptNumber, creditedAt: now.toISOString() }
}

export async function getAllDisbursements(limit = 100) {
  await requireAdmin()
  return db
    .select()
    .from(disbursement)
    .orderBy(desc(disbursement.createdAt))
    .limit(limit)
}

export async function attachDisbursementProof(disbursementId: string, formData: FormData) {
  const adminUserId = await requireAdmin()
  const [row] = await db.select().from(disbursement).where(eq(disbursement.id, disbursementId)).limit(1)
  if (!row) throw new Error('Desembolso no encontrado.')
  if (row.status !== 'credited') {
    throw new Error('Adjuntá el comprobante después de acreditar la transferencia.')
  }

  const file = formData.get('proof')
  const reference = String(formData.get('reference') || '').trim()
  if (!(file instanceof File)) {
    throw new Error('Subí el comprobante de la transferencia (PDF o imagen).')
  }
  const { fileToDbProof } = await import('@/lib/proof-storage')
  const { dataUrl: proofUrl } = await fileToDbProof(file)

  await db
    .update(disbursement)
    .set({
      proofUrl,
      referenceNumber: reference || row.referenceNumber,
      notes: row.notes,
      updatedAt: new Date(),
    })
    .where(eq(disbursement.id, row.id))

  await recordAudit({
    actorUserId: adminUserId,
    action: 'DISBURSEMENT_PROOF_ATTACHED',
    entityType: 'disbursement',
    entityId: row.id,
    targetUserId: row.userId,
    summary: `Comprobante de transferencia adjunto · ${row.receiptNumber}`,
    changes: { proofUrl, reference: reference || null },
  })

  revalidateOps()
  revalidatePath('/admin')
  return { ok: true, proofUrl }
}
