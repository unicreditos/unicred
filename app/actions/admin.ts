'use server'

import { getPrincipalesVariables } from '@/lib/bcra'
import { db } from '@/lib/db'
import {
  loan,
  installment,
  merchant,
  merchantDocument,
  profile,
  bcraVariable,
  bankAccount,
  loanContract,
  payment,
  paymentReceipt,
  user as userTable,
} from '@/lib/db/schema'
import { getSession, syncUserRole } from '@/lib/session'
import { requirePermission } from '@/lib/rbac'
import { desc, eq, sql, and, ne, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { persistBankLookup } from '@/lib/bank-lookup'
import { validateBankAccountAuto } from '@/lib/argenapi'
import { computeFrenchAmortization, isValidBankAlias, normalizeBankAlias } from '@/lib/finance'
import { assertAdminTransition, assertTransition } from '@/lib/loan-state'
import { ensureLoanContract, notifyContractReady } from '@/lib/legal/expediente'
import { ensurePendingDisbursement, ensureInstallmentPlan } from '@/lib/loan-schedule'
import { recordAudit, diffFields, getAuditLog } from '@/lib/audit'
import { ensureOriginacionSchema } from '@/lib/db/ensure-originacion'
import { diditApprovedForUser } from '@/lib/didit'
import { arcaConfigured, lookupPersonaByCuit } from '@/lib/arca/padron'
import {
  evaluateMerchantKyb,
  type MerchantDocType,
  type RepresentativeRole,
} from '@/lib/merchant-kyb'
import { syncBcraVariablesFromApi } from '@/app/actions/bcra'
import { notifyLoanRejected } from '@/lib/notify-email'
import { disburseAndActivateLoan } from '@/app/actions/banking'

type ActionFail = { ok: false; error: string }

function actionFail(err: unknown): ActionFail {
  const msg = err instanceof Error ? err.message : 'No se pudo completar la operación'
  if (/Server Components render|Minified React error #441|digest/i.test(msg)) {
    return {
      ok: false,
      error:
        'El servidor rechazó el cambio de estado. Un crédito rechazado se puede aprobar a mano; para ponerlo vigente hay que acreditar el desembolso en Tesorería.',
    }
  }
  return { ok: false, error: msg }
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function requireAdmin() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  await ensureOriginacionSchema()
  const [p] = await db
    .select({ role: profile.role })
    .from(profile)
    .where(eq(profile.userId, session.user.id))
    .limit(1)
  if (!p || p.role !== 'admin') throw new Error('Forbidden')
  return session.user.id
}

export async function getAdminStats() {
  await requireAdmin()
  const [loans] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${loan.status} = 'active')::int`,
      pending: sql<number>`count(*) filter (where ${loan.status} = 'pending')::int`,
      rejected: sql<number>`count(*) filter (where ${loan.status} = 'rejected')::int`,
      paid: sql<number>`count(*) filter (where ${loan.status} = 'paid')::int`,
      volume: sql<number>`coalesce(sum(${loan.principal}) filter (where ${loan.status} in ('active','approved','paid')), 0)`,
      outstanding: sql<number>`coalesce(sum(${loan.principal}) filter (where ${loan.status} = 'active'), 0)`,
    })
    .from(loan)

  const [users] = await db
    .select({
      total: sql<number>`count(*)::int`,
      customers: sql<number>`count(*) filter (where ${profile.role} = 'customer')::int`,
      merchants: sql<number>`count(*) filter (where ${profile.role} = 'merchant')::int`,
      admins: sql<number>`count(*) filter (where ${profile.role} = 'admin')::int`,
    })
    .from(profile)

  const [merchants] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${merchant.status} = 'pending')::int`,
      active: sql<number>`count(*) filter (where ${merchant.status} = 'active')::int`,
      rejected: sql<number>`count(*) filter (where ${merchant.status} = 'rejected')::int`,
    })
    .from(merchant)

  return { loans, users, merchants }
}

export async function getAllLoans() {
  await requireAdmin()
  const rows = await db.select().from(loan).orderBy(desc(loan.createdAt)).limit(100)
  const ids = rows.map((r) => r.id)
  const contracts = ids.length
    ? await db
        .select({
          id: loanContract.id,
          loanId: loanContract.loanId,
          status: loanContract.status,
        })
        .from(loanContract)
        .where(inArray(loanContract.loanId, ids))
    : []
  const byLoan = new Map(contracts.map((c) => [c.loanId, c]))
  return rows.map((r) => {
    const c = byLoan.get(r.id)
    return {
      id: r.id,
      userId: r.userId,
      merchantId: r.merchantId,
      productId: r.productId,
      principal: r.principal,
      term: r.term,
      status: r.status,
      scoreAtApproval: r.scoreAtApproval,
      monthlyRate: r.monthlyRate,
      rejectionReason: r.rejectionReason,
      createdAt: isoDate(r.createdAt) ?? new Date().toISOString(),
      contractId: c?.id ?? null,
      contractStatus: c?.status ?? null,
    }
  })
}

export async function getPendingMerchants() {
  await requireAdmin()
  return db.select().from(merchant).orderBy(desc(merchant.createdAt))
}

export async function setMerchantStatus(id: string, status: 'active' | 'rejected') {
  const adminUserId = await requirePermission('merchants.write')
  const [existing] = await db.select().from(merchant).where(eq(merchant.id, id)).limit(1)
  if (!existing) throw new Error('Comercio no encontrado')
  if (status === 'active') {
    if (!(await diditApprovedForUser(existing.userId))) {
      throw new Error('El titular no tiene Didit aprobado. No se puede habilitar el comercio.')
    }
    const [prof] = await db
      .select({ cuil: profile.cuil, dni: profile.dni })
      .from(profile)
      .where(eq(profile.userId, existing.userId))
      .limit(1)
    const docs = await db
      .select({ type: merchantDocument.type })
      .from(merchantDocument)
      .where(eq(merchantDocument.merchantId, existing.id))
    const configured = arcaConfigured()
    const padron = configured ? await lookupPersonaByCuit(existing.cuit) : null
    const evaluation = evaluateMerchantKyb({
      declaredCuit: existing.cuit,
      padron,
      padronConfigured: configured,
      titular: {
        diditApproved: true,
        dni: prof?.dni ?? null,
        cuil: prof?.cuil ?? null,
      },
      representativeRole: (existing.representativeRole as RepresentativeRole) || 'titular',
      uploadedDocTypes: docs.map((d) => d.type as MerchantDocType),
    })
    if (!evaluation.canActivate) {
      throw new Error(evaluation.blockers[0] || 'El comercio no supera el control ARCA / expediente.')
    }
    await db
      .update(merchant)
      .set({
        status: 'active',
        kybStatus: 'approved',
        kybBlockers: [],
        taxCondition: evaluation.taxCondition,
        taxStatus: evaluation.taxStatus,
        personType: evaluation.personType,
        legalName: evaluation.legalName || existing.legalName,
        titularMatch: evaluation.titularMatch,
        updatedAt: new Date(),
      })
      .where(eq(merchant.id, id))
  } else {
    await db
      .update(merchant)
      .set({ status: 'rejected', kybStatus: 'rejected', updatedAt: new Date() })
      .where(eq(merchant.id, id))
  }

  await syncUserRole(existing.userId, status === 'active' ? 'merchant' : 'customer')

  await recordAudit({
    actorUserId: adminUserId,
    action: status === 'active' ? 'MERCHANT_APPROVED' : 'MERCHANT_REJECTED',
    entityType: 'merchant',
    entityId: id,
    targetUserId: existing.userId,
    severity: status === 'active' ? 'info' : 'warning',
    summary: `Comercio ${existing.businessName} ${status === 'active' ? 'habilitado' : 'rechazado'}`,
    changes: diffFields(existing as any, { status }),
  })

  revalidatePath('/admin')
  return { ok: true, updatedBy: adminUserId }
}

const BOOK_LOAN_STATUSES = ['approved', 'active', 'paid', 'disbursed'] as const
const PURGEABLE_LOAN_STATUSES = ['pending', 'rejected', 'cancelled'] as const

function isBookLoan(status: string) {
  return (BOOK_LOAN_STATUSES as readonly string[]).includes(status)
}

function canPurgeLoan(status: string) {
  return (PURGEABLE_LOAN_STATUSES as readonly string[]).includes(status)
}

async function purgeUnbookedLoan(loanId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(paymentReceipt).where(eq(paymentReceipt.loanId, loanId))
    await tx.delete(payment).where(eq(payment.loanId, loanId))
    await tx.delete(loan).where(eq(loan.id, loanId))
  })
}

export async function updateMerchantAdmin(
  id: string,
  input: {
    businessName?: string
    legalName?: string
    cuit?: string
    category?: string
    phone?: string
    city?: string
    province?: string
    address?: string
    commissionRate?: string | number
  },
) {
  const adminUserId = await requireAdmin()
  const [existing] = await db.select().from(merchant).where(eq(merchant.id, id)).limit(1)
  if (!existing) throw new Error('Comercio no encontrado')

  const businessName = input.businessName?.trim()
  if (businessName !== undefined && businessName.length < 2) {
    throw new Error('El nombre de fantasía no puede quedar vacío.')
  }

  let cuit = existing.cuit
  if (input.cuit !== undefined) {
    const digits = input.cuit.replace(/\D/g, '')
    if (digits.length !== 11) throw new Error('El CUIT tiene que tener 11 dígitos.')
    const formatted = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
    const [dup] = await db
      .select({ id: merchant.id })
      .from(merchant)
      .where(and(or(eq(merchant.cuit, digits), eq(merchant.cuit, formatted)), ne(merchant.id, id)))
      .limit(1)
    if (dup) throw new Error('Ese CUIT ya está en otro comercio.')
    cuit = formatted
  }

  let commissionRate = existing.commissionRate
  if (input.commissionRate !== undefined && input.commissionRate !== '') {
    const n = typeof input.commissionRate === 'number' ? input.commissionRate : Number(String(input.commissionRate).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('La comisión tiene que estar entre 0 y 100.')
    commissionRate = n.toFixed(2)
  }

  const patch = {
    businessName: businessName ?? existing.businessName,
    legalName: input.legalName !== undefined ? input.legalName.trim() || null : existing.legalName,
    cuit,
    category: input.category !== undefined ? input.category.trim() || null : existing.category,
    phone: input.phone !== undefined ? input.phone.trim() || null : existing.phone,
    city: input.city !== undefined ? input.city.trim() || null : existing.city,
    province: input.province !== undefined ? input.province.trim() || null : existing.province,
    address: input.address !== undefined ? input.address.trim() || null : existing.address,
    commissionRate,
    updatedAt: new Date(),
  }

  await db.update(merchant).set(patch).where(eq(merchant.id, id))

  await recordAudit({
    actorUserId: adminUserId,
    action: 'MERCHANT_EDITED',
    entityType: 'merchant',
    entityId: id,
    targetUserId: existing.userId,
    severity: 'info',
    summary: `Comercio ${patch.businessName} editado`,
    changes: diffFields(existing as any, patch as any),
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/comercios/${id}`)
  return { ok: true, by: adminUserId }
}

export async function deleteMerchantAdmin(id: string) {
  const adminUserId = await requireAdmin()
  const [existing] = await db.select().from(merchant).where(eq(merchant.id, id)).limit(1)
  if (!existing) throw new Error('Comercio no encontrado')

  const linked = await db.select({ id: loan.id, status: loan.status }).from(loan).where(eq(loan.merchantId, id))
  const book = linked.filter((l) => isBookLoan(l.status))
  if (book.length > 0) {
    throw new Error('Este comercio tiene créditos calificados o vigentes. No se borra: rechazalo o liquidá la cartera.')
  }

  await db.transaction(async (tx) => {
    if (linked.length) {
      await tx.update(loan).set({ merchantId: null, updatedAt: new Date() }).where(eq(loan.merchantId, id))
    }
    await tx.update(payment).set({ merchantId: null, updatedAt: new Date() }).where(eq(payment.merchantId, id))
    await tx.delete(merchant).where(eq(merchant.id, id))
  })

  await syncUserRole(existing.userId, 'customer')

  await recordAudit({
    actorUserId: adminUserId,
    action: 'MERCHANT_DELETED',
    entityType: 'merchant',
    entityId: id,
    targetUserId: existing.userId,
    severity: 'error',
    summary: `Comercio eliminado: ${existing.businessName}`,
  })

  revalidatePath('/admin')
  return { ok: true, by: adminUserId }
}

export async function getMerchantDocumentsForAdmin(merchantId: string) {
  await requireAdmin()
  return db
    .select({
      id: merchantDocument.id,
      type: merchantDocument.type,
      fileName: merchantDocument.fileName,
      mime: merchantDocument.mime,
      size: merchantDocument.size,
      status: merchantDocument.status,
      createdAt: merchantDocument.createdAt,
    })
    .from(merchantDocument)
    .where(eq(merchantDocument.merchantId, merchantId))
}

export async function getBcraVariables() {
  await requireAdmin()
  try {
    let stored = await db.select().from(bcraVariable).orderBy(desc(bcraVariable.effectiveDate)).limit(40)
    if (!stored.length) {
      try {
        await syncBcraVariablesFromApi()
        stored = await db.select().from(bcraVariable).orderBy(desc(bcraVariable.effectiveDate)).limit(40)
      } catch (e) {
        console.warn('[admin] sync BCRA variables skipped:', (e as Error).message)
      }
    }
    if (stored && stored.length > 0) {
      return stored.map((v) => ({
        id: v.idVariable,
        variable: v.variableName,
        fecha: v.effectiveDate ? new Date(v.effectiveDate).toISOString().split('T')[0] : null,
        valor: v.value,
        manualOverride: !!v.manualOverride,
        overrideNote: v.overrideNote,
        updatedBy: v.updatedBy,
        updatedAt: v.updatedAt,
      }))
    }
    const live = await getPrincipalesVariables()
    return live.slice(0, 24)
  } catch {
    const live = await getPrincipalesVariables()
    return live.slice(0, 24)
  }
}

export async function approveLoan(
  id: string,
  opts?: {
    score?: number
    principal?: string
    term?: number
    monthlyRate?: string
    notes?: string
  },
) {
  try {
  const adminUserId = await requirePermission('credits.approve')
  const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')
  assertAdminTransition(existing.status, 'approved')

  // Las condiciones finales las fija el admin; si cambian, el plan de cuotas se recalcula.
  const principal =
    opts?.principal !== undefined && opts.principal !== null && opts.principal !== ''
      ? Number(opts.principal)
      : Number(existing.principal)
  const term = opts?.term !== undefined && opts.term !== null ? Number(opts.term) : existing.term
  const monthlyRate =
    opts?.monthlyRate !== undefined && opts.monthlyRate !== null && opts.monthlyRate !== ''
      ? Number(opts.monthlyRate)
      : Number(existing.monthlyRate)

  if (!Number.isFinite(principal) || principal <= 0) throw new Error('Capital inválido')
  if (!Number.isInteger(term) || term < 1 || term > 120) {
    throw new Error('Plazo inválido: debe estar entre 1 y 120 cuotas')
  }
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0 || monthlyRate > 100) {
    throw new Error('Tasa mensual inválida')
  }

  const amort = computeFrenchAmortization(principal, term, monthlyRate)
  const now = new Date()
  let contractId: string | null = null

  await db.transaction(async (tx) => {
    await tx
      .update(loan)
      .set({
        status: 'approved',
        scoreAtApproval: opts?.score ?? existing.scoreAtApproval ?? 0,
        principal: principal.toFixed(2),
        term,
        monthlyRate: String(monthlyRate),
        tna: String(amort.tna),
        tea: String(amort.tea),
        cft: String(amort.cft),
        installmentAmount: amort.installmentAmount.toFixed(2),
        totalAmount: amort.totalAmount.toFixed(2),
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(loan.id, id))

    // Calificación admin: emite contrato. Cuotas/desembolso se habilitan al firmar.
    const contract = await ensureLoanContract(
      tx,
      { id, userId: existing.userId, type: existing.type, status: 'approved' },
      { generatedBy: adminUserId, now },
    )
    contractId = contract?.id ?? null
  })

  if (contractId) {
    await notifyContractReady({
      userId: existing.userId,
      contractId,
      principal,
      term,
    })
  }

  await recordAudit({
    actorUserId: adminUserId,
    action: 'LOAN_APPROVED',
    entityType: 'loan',
    entityId: id,
    targetUserId: existing.userId,
    summary: `Crédito aprobado por ${principal.toFixed(2)} ARS en ${term} cuotas`,
    changes: diffFields(existing as any, {
      status: 'approved',
      principal: principal.toFixed(2),
      term,
      monthlyRate: String(monthlyRate),
      scoreAtApproval: opts?.score ?? existing.scoreAtApproval ?? 0,
    }),
  })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { ok: true as const, approvedBy: adminUserId }
  } catch (err) {
    return actionFail(err)
  }
}

export async function rejectLoan(id: string, reason: string) {
  try {
  const adminUserId = await requirePermission('credits.reject')
  if (!reason || !reason.trim()) throw new Error('Motivo de rechazo obligatorio')
  const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')
  assertAdminTransition(existing.status, 'rejected')

  await db.transaction(async (tx) => {
    await tx
      .update(loan)
      .set({
        status: 'rejected',
        rejectionReason: reason.trim(),
        disbursedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(loan.id, id))
    // Un crédito rechazado no genera deuda: se descarta el plan de cuotas provisorio.
    await tx.delete(installment).where(eq(installment.loanId, id))
  })

  await recordAudit({
    actorUserId: adminUserId,
    action: 'LOAN_REJECTED',
    entityType: 'loan',
    entityId: id,
    targetUserId: existing.userId,
    severity: 'warning',
    summary: `Crédito rechazado: ${reason.trim()}`,
    changes: diffFields(existing as any, { status: 'rejected', rejectionReason: reason.trim() }),
  })

  await notifyLoanRejected({ userId: existing.userId, reason: reason.trim() })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { ok: true as const, rejectedBy: adminUserId }
  } catch (err) {
    return actionFail(err)
  }
}

export async function updateLoanManual(
  id: string,
  opts: {
    principal?: string
    term?: number
    status?: 'pending' | 'approved' | 'rejected' | 'active' | 'paid' | 'cancelled'
    monthlyRate?: string
    scoreAtApproval?: number
    rejectionReason?: string
    disbursedAt?: string
  },
) {
  try {
  const adminUserId = await requirePermission('credits.edit')
  const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (opts.principal !== undefined && opts.principal !== null && opts.principal !== '') {
    updates.principal = String(opts.principal)
  }
  if (opts.term !== undefined && opts.term !== null) updates.term = opts.term
  if (opts.status !== undefined && opts.status !== null) {
    if (opts.status === 'active') {
      throw new Error(
        'No se puede marcar “activo” desde edición manual. Usá Tesorería → acreditar desembolso (requiere contrato firmado).',
      )
    }
    assertAdminTransition(existing.status, opts.status)
    updates.status = opts.status
  }
  if (opts.monthlyRate !== undefined && opts.monthlyRate !== null && opts.monthlyRate !== '') {
    updates.monthlyRate = String(opts.monthlyRate)
  }
  if (opts.scoreAtApproval !== undefined && opts.scoreAtApproval !== null) {
    updates.scoreAtApproval = opts.scoreAtApproval
  }
  if (opts.disbursedAt !== undefined && opts.disbursedAt !== null && opts.disbursedAt !== '') {
    updates.disbursedAt = new Date(opts.disbursedAt)
  }

  const nextStatus = (updates.status ?? existing.status) as string
  // El motivo de rechazo solo vale si el crédito queda "rejected": al salir de
  // ese estado se limpia siempre, sin importar qué haya quedado escrito en el
  // formulario, para que un crédito aprobado/activo no arrastre un motivo viejo.
  updates.rejectionReason = nextStatus === 'rejected' ? (opts.rejectionReason ?? existing.rejectionReason) : null

  const nextPrincipal = Number(updates.principal ?? existing.principal)
  const nextTerm = Number(updates.term ?? existing.term)
  const nextRate = Number(updates.monthlyRate ?? existing.monthlyRate)
  const termsChanged =
    updates.principal !== undefined || updates.term !== undefined || updates.monthlyRate !== undefined
  if (termsChanged && Number.isFinite(nextPrincipal) && Number.isFinite(nextTerm) && Number.isFinite(nextRate)) {
    const amort = computeFrenchAmortization(nextPrincipal, nextTerm, nextRate)
    updates.tna = String(amort.tna)
    updates.cft = String(amort.cft)
    updates.installmentAmount = amort.installmentAmount.toFixed(2)
    updates.totalAmount = amort.totalAmount.toFixed(2)
  }

  let contractId: string | null = null

  await db.transaction(async (tx) => {
    await tx.update(loan).set(updates).where(eq(loan.id, id))
    if (nextStatus === 'rejected' || nextStatus === 'cancelled') {
      await tx.delete(installment).where(eq(installment.loanId, id))
      return
    }
    if (nextStatus === 'approved') {
      if (termsChanged) {
        await tx.delete(installment).where(eq(installment.loanId, id))
      }
      const contract = await ensureLoanContract(
        tx,
        { id, userId: existing.userId, type: existing.type, status: 'approved' },
        { generatedBy: adminUserId },
      )
      contractId = contract?.id ?? null
    }
  })

  if (contractId && existing.status !== 'approved') {
    await notifyContractReady({
      userId: existing.userId,
      contractId,
      principal: nextPrincipal,
      term: nextTerm,
    })
  }

  await recordAudit({
    actorUserId: adminUserId,
    action: 'LOAN_EDITED_MANUAL',
    entityType: 'loan',
    entityId: id,
    targetUserId: existing.userId,
    severity: 'warning',
    summary: 'Edición manual de las condiciones del crédito',
    changes: diffFields(existing as any, updates),
  })

  revalidatePath('/admin')
  return { ok: true as const, updatedBy: adminUserId }
  } catch (err) {
    return actionFail(err)
  }
}

export async function deleteLoanAdmin(id: string) {
  try {
    const adminUserId = await requireAdmin()
    const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
    if (!existing) throw new Error('Préstamo no encontrado')
    if (!canPurgeLoan(existing.status)) {
      throw new Error('Solo se borran créditos pendientes, rechazados o anulados. Uno vigente o calificado no se elimina.')
    }

    await purgeUnbookedLoan(id)

    await recordAudit({
      actorUserId: adminUserId,
      action: 'LOAN_DELETED',
      entityType: 'loan',
      entityId: id,
      targetUserId: existing.userId,
      severity: 'error',
      summary: `Crédito ${existing.status} eliminado · ${existing.principal} ARS`,
    })

    revalidatePath('/admin')
    return { ok: true as const, by: adminUserId }
  } catch (err) {
    return actionFail(err)
  }
}

export async function markLoanAsActive(id: string) {
  return disburseAndActivateLoan(id)
}

export async function markLoanAsPaid(id: string) {
  try {
  const adminUserId = await requireAdmin()
  const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')
  assertTransition(existing.status, 'paid')

  const pending = await db
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.loanId, id), ne(installment.status, 'paid')))
  if (pending.length) {
    throw new Error(
      `No se puede cancelar el crédito: quedan ${pending.length} cuota(s) impaga(s). Acreditalas primero.`,
    )
  }

  await db.update(loan).set({ status: 'paid', updatedAt: new Date() }).where(eq(loan.id, id))

  await recordAudit({
    actorUserId: adminUserId,
    action: 'LOAN_SETTLED',
    entityType: 'loan',
    entityId: id,
    targetUserId: existing.userId,
    summary: 'Crédito marcado como cancelado',
    changes: diffFields(existing as any, { status: 'paid' }),
  })

  revalidatePath('/admin')
  return { ok: true as const, markedPaidBy: adminUserId }
  } catch (err) {
    return actionFail(err)
  }
}

export async function ensureLoanExpediente(loanId: string) {
  try {
  const adminUserId = await requireAdmin()
  const [existing] = await db.select().from(loan).where(eq(loan.id, loanId)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')
  if (existing.status !== 'approved' && existing.status !== 'active') {
    throw new Error('El expediente se emite sobre un crédito calificado o vigente.')
  }

  const now = new Date()
  let contractId: string | null = null
  await db.transaction(async (tx) => {
    // Siempre: contrato. Cuotas/desembolso solo si ya firmó (o el crédito ya está vigente).
    const contract = await ensureLoanContract(
      tx,
      { id: loanId, userId: existing.userId, type: existing.type, status: existing.status },
      { generatedBy: adminUserId, now },
    )
    contractId = contract?.id ?? null

    const signed = contract?.status === 'accepted' || existing.status === 'active'
    if (signed) {
      await ensureInstallmentPlan(tx, {
        loanId,
        userId: existing.userId,
        principal: Number(existing.principal),
        term: existing.term,
        monthlyRate: Number(existing.monthlyRate),
        from: now,
      })
      await ensurePendingDisbursement(tx, {
        loanId,
        userId: existing.userId,
        amount: Number(existing.principal),
        now,
      })
    }
  })

  if (contractId) {
    await notifyContractReady({
      userId: existing.userId,
      contractId,
      principal: existing.principal,
      term: existing.term,
    })
  }

  await recordAudit({
    actorUserId: adminUserId,
    action: 'LOAN_EXPEDIENTE_ENSURED',
    entityType: 'loan',
    entityId: loanId,
    targetUserId: existing.userId,
    summary: 'Expediente (contrato, pagaré y cronograma) emitido o actualizado',
  })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { ok: true as const, contractId }
  } catch (err) {
    return actionFail(err)
  }
}

export async function updateBcraVariable(
  idVariable: string,
  opts: {
    variableName?: string
    value?: string | number
    effectiveDate?: string
    overrideNote?: string
  },
) {
  const adminUserId = await requireAdmin()
  if (!idVariable) throw new Error('ID variable BCRA requerido')

  const now = new Date()
  const existing = await db
    .select()
    .from(bcraVariable)
    .where(eq(bcraVariable.idVariable, idVariable))
    .limit(1)

  if (existing && existing.length > 0) {
    await db
      .update(bcraVariable)
      .set({
        variableName: opts.variableName ?? existing[0].variableName,
        value: opts.value !== undefined && opts.value !== null ? String(opts.value) : existing[0].value,
        effectiveDate: opts.effectiveDate ? new Date(opts.effectiveDate) : existing[0].effectiveDate,
        manualOverride: true,
        overrideNote: opts.overrideNote ?? existing[0].overrideNote,
        updatedBy: adminUserId,
        updatedAt: now,
      })
      .where(eq(bcraVariable.idVariable, idVariable))
  } else {
    const id = crypto.randomUUID()
    await db.insert(bcraVariable).values({
      id,
      idVariable,
      variableName: opts.variableName ?? idVariable,
      value: opts.value !== undefined && opts.value !== null ? String(opts.value) : '0',
      effectiveDate: opts.effectiveDate ? new Date(opts.effectiveDate) : now,
      manualOverride: true,
      overrideNote: opts.overrideNote ?? null,
      updatedBy: adminUserId,
      createdAt: now,
      updatedAt: now,
    })
  }

  revalidatePath('/admin')
  return { ok: true, updatedBy: adminUserId }
}

export async function resetBcraVariableToLive(idVariable: string) {
  const adminUserId = await requireAdmin()
  const [existing] = await db
    .select()
    .from(bcraVariable)
    .where(eq(bcraVariable.idVariable, idVariable))
    .limit(1)
  if (!existing) return { ok: true, skipped: true }

  await db
    .update(bcraVariable)
    .set({
      manualOverride: false,
      overrideNote: null,
      updatedBy: adminUserId,
      updatedAt: new Date(),
    })
    .where(eq(bcraVariable.idVariable, idVariable))

  revalidatePath('/admin')
  return { ok: true, resetBy: adminUserId }
}

export async function getAllBankAccounts() {
  await requireAdmin()
  const rows = await db
    .select({
      id: bankAccount.id,
      userId: bankAccount.userId,
      accountType: bankAccount.accountType,
      bankName: bankAccount.bankName,
      cbu: bankAccount.cbu,
      cvu: bankAccount.cvu,
      alias: bankAccount.alias,
      holderName: bankAccount.holderName,
      holderCuil: bankAccount.holderCuil,
      bankCode: bankAccount.bankCode,
      branch: bankAccount.branch,
      scheme: bankAccount.scheme,
      currency: bankAccount.currency,
      networkStatus: bankAccount.networkStatus,
      networkBlocked: bankAccount.networkBlocked,
      extractedProfile: bankAccount.extractedProfile,
      extractedAt: bankAccount.extractedAt,
      isPrimary: bankAccount.isPrimary,
      isVerified: bankAccount.isVerified,
      isActive: bankAccount.isActive,
      verificationData: bankAccount.verificationData,
      verifiedAt: bankAccount.verifiedAt,
      verifiedBy: bankAccount.verifiedBy,
      createdAt: bankAccount.createdAt,
      updatedAt: bankAccount.updatedAt,
      userEmail: userTable.email,
      userName: userTable.name,
      userCuil: profile.cuil,
      userRole: profile.role,
    })
    .from(bankAccount)
    .innerJoin(userTable, eq(userTable.id, bankAccount.userId))
    .leftJoin(profile, eq(profile.userId, bankAccount.userId))
    .orderBy(desc(bankAccount.createdAt))
  return rows
}

export async function verifyBankAccountArgenapi(bankAccountId: string) {
  const adminUserId = await requireAdmin()
  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.id, bankAccountId))
    .limit(1)
  if (!acc) throw new Error('Cuenta bancaria no encontrada')

  const res = await validateBankAccountAuto({
    cbu: acc.cbu,
    cvu: acc.cvu,
    alias: acc.alias ? normalizeBankAlias(acc.alias) : acc.alias,
  })

  const persisted = await persistBankLookup({
    bankAccountId,
    lookup: res,
    actorUserId: adminUserId,
    source: 'unicred_admin',
  })
  const best = res.best
  const ok = persisted.ok

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {
    ok,
    matchedData: persisted.extracted,
    message: ok
      ? `Ficha actualizada · ${persisted.extracted?.entidad || persisted.extracted?.banco || 'entidad'} · Titular: ${persisted.extracted?.titular || 'N/D'}`
      : best?.message || 'No se pudo validar la cuenta',
    bestStatus: best?.status,
  }
}

export async function setBankAccountVerificationManual(
  bankAccountId: string,
  isVerified: boolean,
  note?: string,
) {
  const adminUserId = await requireAdmin()
  const [acc] = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.id, bankAccountId))
    .limit(1)
  if (!acc) throw new Error('Cuenta bancaria no encontrada')

  const now = new Date()
  const raw = (acc.verificationData ?? {}) as any
  const updatedRaw: any = {
    ...raw,
    manualOverride: true,
    manualNote: note ?? null,
    manualBy: adminUserId,
    manualAt: now.toISOString(),
  }

  await db
    .update(bankAccount)
    .set({
      isVerified,
      verifiedAt: now,
      verifiedBy: adminUserId,
      verificationData: updatedRaw,
      updatedAt: now,
    })
    .where(eq(bankAccount.id, bankAccountId))

  revalidatePath('/admin')
  return { ok: true, verified: isVerified, by: adminUserId, note: note ?? null }
}

export async function updateBankAccountAdmin(
  bankAccountId: string,
  input: {
    bankName?: string
    accountType?: 'cbu' | 'cvu' | 'alias' | 'cci'
    cbu?: string | null
    cvu?: string | null
    alias?: string | null
    holderName?: string
    holderCuil?: string
    isPrimary?: boolean
    isActive?: boolean
  },
) {
  const adminUserId = await requireAdmin()
  const [acc] = await db.select().from(bankAccount).where(eq(bankAccount.id, bankAccountId)).limit(1)
  if (!acc) throw new Error('Cuenta bancaria no encontrada')

  const alias = input.alias != null && input.alias !== '' ? normalizeBankAlias(input.alias) : input.alias === '' ? null : acc.alias
  if (alias && !isValidBankAlias(alias)) {
    throw new Error('Alias inválido: 6 a 20 caracteres, letras, números y punto. Sin @.')
  }
  const cbu = input.cbu != null ? String(input.cbu).replace(/\D/g, '').slice(0, 22) || null : acc.cbu
  const cvu = input.cvu != null ? String(input.cvu).replace(/\D/g, '').slice(0, 22) || null : acc.cvu
  if (cbu && cbu.length !== 22) throw new Error('CBU inválido: 22 dígitos')
  if (cvu && cvu.length !== 22) throw new Error('CVU inválido: 22 dígitos')

  const now = new Date()
  const identifiersChanged =
    (alias ?? null) !== (acc.alias ?? null) || (cbu ?? null) !== (acc.cbu ?? null) || (cvu ?? null) !== (acc.cvu ?? null)

  if (input.isPrimary === true) {
    await db
      .update(bankAccount)
      .set({ isPrimary: false, updatedAt: now })
      .where(and(eq(bankAccount.userId, acc.userId), ne(bankAccount.id, bankAccountId)))
  }

  await db
    .update(bankAccount)
    .set({
      bankName: input.bankName?.trim() || acc.bankName,
      accountType: input.accountType ?? acc.accountType,
      cbu,
      cvu,
      alias,
      holderName: input.holderName?.trim() || acc.holderName,
      holderCuil: input.holderCuil?.replace(/\D/g, '').slice(0, 11) || acc.holderCuil,
      isPrimary: input.isPrimary ?? acc.isPrimary,
      isActive: input.isActive ?? acc.isActive,
      isVerified: identifiersChanged ? false : acc.isVerified,
      verificationData: {
        ...((acc.verificationData as any) ?? {}),
        lastAdminEdit: { at: now.toISOString(), by: adminUserId, identifiersChanged },
      } as any,
      updatedAt: now,
    })
    .where(eq(bankAccount.id, bankAccountId))

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { ok: true, needsRevalidation: identifiersChanged }
}

export async function deactivateBankAccountAdmin(bankAccountId: string) {
  const adminUserId = await requireAdmin()
  const [acc] = await db.select().from(bankAccount).where(eq(bankAccount.id, bankAccountId)).limit(1)
  if (!acc) throw new Error('Cuenta bancaria no encontrada')

  await db.transaction(async (tx) => {
    if (acc.isPrimary) {
      const [other] = await tx
        .select({ id: bankAccount.id })
        .from(bankAccount)
        .where(and(eq(bankAccount.userId, acc.userId), eq(bankAccount.isActive, true), ne(bankAccount.id, bankAccountId)))
        .limit(1)
      await tx.update(bankAccount).set({ isPrimary: false, isActive: false, updatedAt: new Date() }).where(eq(bankAccount.id, bankAccountId))
      if (other) {
        await tx.update(bankAccount).set({ isPrimary: true, updatedAt: new Date() }).where(eq(bankAccount.id, other.id))
      }
    } else {
      await tx.update(bankAccount).set({ isActive: false, updatedAt: new Date() }).where(eq(bankAccount.id, bankAccountId))
    }
  })

  revalidatePath('/admin')
  return { ok: true, by: adminUserId }
}

export type AdminUserRow = {
  id: string
  name: string
  email: string
  banned: boolean | null
  createdAt: Date
  role: string | null
  adminRoleId: string | null
  cuil: string | null
  dni: string | null
  phone: string | null
  kycStatus: string | null
  city: string | null
  province: string | null
  loansCount: number
  activeLoans: number
}

export async function getAllUsers(): Promise<AdminUserRow[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      banned: userTable.banned,
      createdAt: userTable.createdAt,
      role: profile.role,
      adminRoleId: profile.adminRoleId,
      cuil: profile.cuil,
      dni: profile.dni,
      phone: profile.phone,
      kycStatus: profile.kycStatus,
      city: profile.city,
      province: profile.province,
      loansCount: sql<number>`coalesce((select count(*)::int from loan where loan."userId" = ${userTable.id}), 0)`,
      activeLoans: sql<number>`coalesce((select count(*)::int from loan where loan."userId" = ${userTable.id} and loan.status in ('pending','approved','active','disbursed')), 0)`,
    })
    .from(userTable)
    .leftJoin(profile, eq(profile.userId, userTable.id))
    .orderBy(desc(userTable.createdAt))
    .limit(500)
  return rows
}

export async function updateUserAdmin(
  userId: string,
  input: {
    name?: string
    email?: string
    phone?: string
    cuil?: string
    dni?: string
    role?: 'customer' | 'merchant' | 'admin'
    kycStatus?: string
    city?: string
    province?: string
  },
) {
  // Cambiar el rol (customer/merchant/admin) es más sensible que editar datos de contacto:
  // exige users.manage además de ser admin. El resto de los campos alcanza con requireAdmin().
  const adminUserId = input.role ? await requirePermission('users.manage') : await requireAdmin()
  if (userId === adminUserId && input.role && input.role !== 'admin') {
    throw new Error('No podés quitarte el rol admin a vos mismo')
  }
  const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  if (!u) throw new Error('Usuario no encontrado')

  const now = new Date()
  if (input.name?.trim() || input.email?.trim()) {
    await db
      .update(userTable)
      .set({
        name: input.name?.trim() || u.name,
        email: input.email?.trim().toLowerCase() || u.email,
        updatedAt: now,
      })
      .where(eq(userTable.id, userId))
  }

  const [p] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  if (p) {
    await db
      .update(profile)
      .set({
        phone: input.phone !== undefined ? input.phone.replace(/\D/g, '') || null : p.phone,
        cuil: input.cuil !== undefined ? input.cuil.replace(/\D/g, '').slice(0, 11) || null : p.cuil,
        dni: input.dni !== undefined ? input.dni.replace(/\D/g, '') || null : p.dni,
        role: input.role ?? p.role,
        kycStatus: input.kycStatus ?? p.kycStatus,
        city: input.city !== undefined ? input.city.trim() || null : p.city,
        province: input.province !== undefined ? input.province.trim() || null : p.province,
        updatedAt: now,
      })
      .where(eq(profile.userId, userId))
  } else {
    await db.insert(profile).values({
      id: crypto.randomUUID(),
      userId,
      role: input.role ?? 'customer',
      phone: input.phone?.replace(/\D/g, '') || null,
      cuil: input.cuil?.replace(/\D/g, '').slice(0, 11) || null,
      dni: input.dni?.replace(/\D/g, '') || null,
      kycStatus: input.kycStatus ?? 'pending',
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
    })
  }
  if (input.role) {
    await db.update(userTable).set({ role: input.role, updatedAt: now }).where(eq(userTable.id, userId))
  }

  await recordAudit({
    actorUserId: adminUserId,
    action: input.role && input.role !== p?.role ? 'USER_ROLE_CHANGED' : 'USER_EDITED',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    severity: input.role && input.role !== p?.role ? 'warning' : 'info',
    summary: `Datos de ${u.email} actualizados desde administración`,
    changes: diffFields({ ...(p ?? {}), name: u.name, email: u.email } as any, input as any),
  })

  revalidatePath('/admin')
  return { ok: true, by: adminUserId }
}

export async function setUserBanned(userId: string, banned: boolean) {
  const adminUserId = await requirePermission('users.manage')
  if (userId === adminUserId) throw new Error('No podés bloquear tu propia sesión')
  const [p] = await db.select({ role: profile.role }).from(profile).where(eq(profile.userId, userId)).limit(1)
  if (p?.role === 'admin' && banned) throw new Error('No se bloquea un administrador. Primero cambiale el rol.')

  await db.update(userTable).set({ banned, updatedAt: new Date() }).where(eq(userTable.id, userId))

  await recordAudit({
    actorUserId: adminUserId,
    action: banned ? 'USER_BANNED' : 'USER_UNBANNED',
    entityType: 'user',
    entityId: userId,
    targetUserId: userId,
    severity: 'warning',
    summary: banned ? 'Usuario bloqueado' : 'Usuario desbloqueado',
  })

  revalidatePath('/admin')
  return { ok: true, banned, by: adminUserId }
}

export async function deleteUserAdmin(userId: string) {
  const adminUserId = await requirePermission('users.manage')
  if (userId === adminUserId) throw new Error('No podés eliminar tu propia cuenta')
  const [p] = await db.select({ role: profile.role, kycStatus: profile.kycStatus }).from(profile).where(eq(profile.userId, userId)).limit(1)
  if (p?.role === 'admin') throw new Error('No se elimina un administrador')

  const loans = await db.select({ id: loan.id, status: loan.status }).from(loan).where(eq(loan.userId, userId))
  const bookAsBorrower = loans.filter((l) => isBookLoan(l.status))
  if (bookAsBorrower.length > 0) {
    throw new Error('Este usuario tiene créditos calificados o vigentes. No se elimina: bloquealo.')
  }

  const [shop] = await db.select({ id: merchant.id }).from(merchant).where(eq(merchant.userId, userId)).limit(1)
  if (shop) {
    const originated = await db.select({ id: loan.id, status: loan.status }).from(loan).where(eq(loan.merchantId, shop.id))
    if (originated.some((l) => isBookLoan(l.status))) {
      throw new Error('El comercio de este usuario tiene cartera viva. No se elimina.')
    }
    await db.update(loan).set({ merchantId: null, updatedAt: new Date() }).where(eq(loan.merchantId, shop.id))
    await db.update(payment).set({ merchantId: null, updatedAt: new Date() }).where(eq(payment.merchantId, shop.id))
  }

  for (const row of loans.filter((l) => canPurgeLoan(l.status))) {
    await purgeUnbookedLoan(row.id)
  }

  const leftover = await db.select({ id: loan.id, status: loan.status }).from(loan).where(eq(loan.userId, userId))
  if (leftover.length > 0) {
    throw new Error('Quedaron créditos que no se pueden borrar. Bloqueá al usuario.')
  }

  const [target] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  await db.delete(userTable).where(eq(userTable.id, userId))

  await recordAudit({
    actorUserId: adminUserId,
    action: 'USER_DELETED',
    entityType: 'user',
    entityId: userId,
    severity: 'error',
    summary: `Usuario eliminado: ${target?.email ?? userId}${p?.kycStatus === 'rejected' ? ' (KYC rechazado)' : ''}`,
  })

  revalidatePath('/admin')
  return { ok: true, by: adminUserId }
}

export async function getAdminAuditLog(limit = 100) {
  await requireAdmin()
  return getAuditLog(limit)
}

export async function getDashboardPaymentsSummary(limit = 20) {
  await requireAdmin()
  const { payment } = await import('@/lib/db/schema')
  const total = await db
    .select({
      total: sql<number>`count(*)::int`,
      volume: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'paid'), 0)`,
      pending: sql<number>`count(*) filter (where ${payment.status} in ('pending','processing'))::int`,
      failed: sql<number>`count(*) filter (where ${payment.status} = 'failed')::int`,
    })
    .from(payment)
  const rows = await db
    .select()
    .from(payment)
    .orderBy(desc(payment.createdAt))
    .limit(limit)
  return { total: total[0], latest: rows }
}

