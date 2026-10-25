'use server'

import { recordAudit } from '@/lib/audit'
import { contractContentHash, signatureRecordHash } from '@/lib/legal/contract-hash'
import { db } from '@/lib/db'
import {
  bcraReport,
  loanContract,
  loan,
  profile,
  bankAccount,
  user as userTable,
} from '@/lib/db/schema'
import {
  CONTRACT_VERSION,
  ensureLoanContract,
  notifyContractReady,
} from '@/lib/legal/expediente'
import { ensureInstallmentPlan, ensurePendingDisbursement } from '@/lib/loan-schedule'

import { persistBcraReportForUser } from '@/lib/bcra-report'
import { assertRole } from '@/lib/session'
import { and, eq, desc } from 'drizzle-orm'
import { revalidateCustomer } from '@/lib/revalidate'

export async function generateBCRAReport(checkId?: string | null) {
  const userId = await assertRole('customer', 'merchant', 'admin')
  return persistBcraReportForUser(userId, checkId)
}

export async function getLastBCRAReport() {
  const userId = await assertRole('customer', 'merchant')
  try {
    const rows = await db
      .select()
      .from(bcraReport)
      .where(eq(bcraReport.userId, userId))
      .orderBy(desc(bcraReport.createdAt))
      .limit(1)
    return rows[0] ?? null
  } catch (e: any) {
    console.warn('[documents.getLastBCRAReport] fallback bcra_report read:', e?.message ?? String(e))
    return null
  }
}

export async function listBCRAReports(limit = 10) {
  const userId = await assertRole('customer', 'merchant')
  try {
    return await db
      .select()
      .from(bcraReport)
      .where(eq(bcraReport.userId, userId))
      .orderBy(desc(bcraReport.createdAt))
      .limit(limit)
  } catch (e: any) {
    console.warn('[documents.listBCRAReports] returning empty bcra_report mismatch:', e?.message ?? String(e))
    return []
  }
}

export async function generateLoanContract(loanId: string) {
  const userId = await assertRole('customer')

  const [loanRow] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow) throw new Error('Préstamo no encontrado')
  if (loanRow.status !== 'approved' && loanRow.status !== 'active') {
    throw new Error('El contrato se emite cuando el crédito está aprobado.')
  }

  const now = new Date()
  let contractId: string | null = null
  await db.transaction(async (tx) => {
    // Solo contrato. Cuotas y desembolso se crean al firmar (acceptLoanContract).
    const contract = await ensureLoanContract(
      tx,
      { id: loanRow.id, userId, type: loanRow.type, status: loanRow.status },
      { generatedBy: userId, now },
    )
    contractId = contract?.id ?? null
  })
  if (!contractId) throw new Error('No se pudo emitir el contrato')

  if (loanRow.status === 'approved') {
    await notifyContractReady({
      userId,
      contractId,
      principal: loanRow.principal,
      term: loanRow.term,
    })
  }

  await recordAudit({
    actorUserId: userId,
    action: 'CONTRACT_GENERATED',
    entityType: 'loan_contract',
    entityId: contractId,
    targetUserId: userId,
    summary: 'Se generó el contrato del crédito',
    changes: { loanId },
  })
  revalidateCustomer()
  return { ok: true, contractId }
}

export async function acceptLoanContract(
  contractId: string,
  opts?: { ip?: string; ua?: string; signatureType?: 'clickwrap' | 'firma_digital' },
) {
  const userId = await assertRole('customer')

  const [c] = await db
    .select()
    .from(loanContract)
    .where(and(eq(loanContract.id, contractId), eq(loanContract.userId, userId)))
    .limit(1)
  if (!c) throw new Error('Contrato no encontrado')
  if (c.status === 'accepted') return { ok: true }
  if (c.status === 'rejected') throw new Error('Este contrato ya fue rechazado')
  if (c.expirationDate && new Date(c.expirationDate).getTime() < Date.now()) {
    throw new Error('La oferta de este contrato venció. Solicitá un crédito nuevo.')
  }

  const [loanRow] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, c.loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow) throw new Error('Crédito no encontrado')
  if (loanRow.status !== 'approved' && loanRow.status !== 'active') {
    throw new Error('El contrato sólo se puede aceptar sobre un crédito aprobado.')
  }

  const [destination] = await db
    .select({
      id: bankAccount.id,
      cbu: bankAccount.cbu,
      cvu: bankAccount.cvu,
      alias: bankAccount.alias,
      isActive: bankAccount.isActive,
    })
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
    .orderBy(desc(bankAccount.isPrimary))
    .limit(1)
  if (!destination || !(destination.cbu || destination.cvu || destination.alias)) {
    throw new Error(
      'Cargá un CBU, CVU o alias a tu nombre en Cuentas de desembolso antes de firmar. El crédito no se gira a terceros ni a la billetera interna.',
    )
  }

  const identRows = await db
    .select({ cuil: profile.cuil, fullName: userTable.name })
    .from(profile)
    .innerJoin(userTable, eq(userTable.id, profile.userId))
    .where(eq(profile.userId, userId))
    .limit(1)
  const ident = identRows[0] ?? { cuil: null, fullName: null }

  // Huella SHA-256 del contenido congelado + registro de firma (IP, agente de usuario y CUIL).
  const acceptedAt = new Date()
  const signatureType = opts?.signatureType ?? 'clickwrap'
  const contentHash = contractContentHash({
    contractId,
    loanId: c.loanId,
    userId,
    version: CONTRACT_VERSION,
    templateName: c.templateName,
    loan: loanRow,
    signer: { name: ident.fullName ?? null, cuil: ident.cuil ?? null },
  })
  const signatureHash = signatureRecordHash({
    contentHash,
    acceptedAt,
    ip: opts?.ip,
    userAgent: opts?.ua,
    cuil: ident.cuil,
    userId,
    signatureType,
  })

  await db.transaction(async (tx) => {
    await tx
      .update(loanContract)
      .set({
        status: 'accepted',
        contentHash,
        acceptedAt,
        acceptedIp: opts?.ip,
        acceptedUserAgent: opts?.ua,
        signatureType,
        signerName: ident.fullName ?? null,
        signerCuil: ident.cuil ?? null,
        signatureData: {
          ...((c.signatureData as Record<string, unknown> | null) ?? {}),
          instruments: ['contrato_mutuo', 'pagare', 'cronograma', 'liquidaciones'],
          version: CONTRACT_VERSION,
          acceptedAs: 'deudor_y_librador',
          hashAlgorithm: 'SHA-256',
          contentHash,
          signatureHash,
          signedIp: opts?.ip ?? null,
          signedUserAgent: String(opts?.ua ?? '').slice(0, 300) || null,
          signerCuil: ident.cuil ?? null,
        },
        updatedAt: new Date(),
      })
      .where(eq(loanContract.id, contractId))

    // Tras la firma: se habilita el cronograma y la orden de desembolso (aún pendiente de tesorería).
    const [loanFull] = await tx
      .select()
      .from(loan)
      .where(and(eq(loan.id, c.loanId), eq(loan.userId, userId)))
      .limit(1)
    if (loanFull && loanFull.status === 'approved') {
      const now = new Date()
      await ensureInstallmentPlan(tx, {
        loanId: loanFull.id,
        userId,
        principal: Number(loanFull.principal),
        term: loanFull.term,
        monthlyRate: Number(loanFull.monthlyRate),
        from: now,
      })
      await ensurePendingDisbursement(tx, {
        loanId: loanFull.id,
        userId,
        amount: Number(loanFull.principal),
        now,
      })
    }
  })

  await recordAudit({
    actorUserId: userId,
    action: 'CONTRACT_SIGNED',
    entityType: 'loan_contract',
    entityId: contractId,
    targetUserId: userId,
    severity: 'warning',
    summary: 'El cliente aceptó el contrato y el pagaré (firma electrónica)',
    changes: { ua: String(opts?.ua ?? '').slice(0, 200), contentHash, signatureHash },
  })
  revalidateCustomer()
  return { ok: true }
}

