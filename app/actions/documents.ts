'use server'

import { db } from '@/lib/db'
import {
  bcraReport,
  loanContract,
  bcraCheck,
  loan,
  installment,
  profile,
  disbursement,
  user as userTable,
} from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import {
  CONTRACT_VERSION,
  ensureLoanContract,
  lastRefinanceAt,
  notifyContractReady,
  persistIntimation,
  persistRefinance,
  notifyIntimation,
  readSignatureData,
  syncOverdueInstallments,
} from '@/lib/legal/expediente'
import { ensureInstallmentPlan, ensurePendingDisbursement } from '@/lib/loan-schedule'
import {
  addMonths,
  asMoraRows,
  evaluateIntimation,
  evaluateRefinance,
  MAX_REFINANCES,
  money,
  splitBalanceEvenly,
} from '@/lib/legal/mora'
import { assertRole, getRoleForUser } from '@/lib/session'
import { receiptBranding } from '@/lib/brand'
import { and, eq, desc, ne } from 'drizzle-orm'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'

type RuntimeBCRACheck = {
  id: string
  userId: string
  cuil: string | null
  worstSituation: number | null
  totalDebt: string | null
  entitiesCount: number | null
  hasRejectedChecks: boolean
  computedScore: number | null
  consultedAt: Date | null
  source: string | null
  [k: string]: any
}

async function safeTrySelectLastCheck(userId: string): Promise<RuntimeBCRACheck | null> {
  try {
    const rows = await db
      .select()
      .from(bcraCheck)
      .where(eq(bcraCheck.userId, userId))
      .orderBy(desc(bcraCheck.createdAt))
      .limit(1)
    return rows[0] as RuntimeBCRACheck | null ?? null
  } catch (e: any) {
    console.warn('[documents.safeLastCheck] using fallback bcra_check table mismatch:', e?.message ?? String(e))
    return null
  }
}

export async function generateBCRAReport(checkId?: string | null) {
  const userId = await assertRole('customer')

  let check: RuntimeBCRACheck | null = null

  if (checkId && String(checkId).trim().length > 0) {
    try {
      const [existing] = await db
        .select()
        .from(bcraCheck)
        .where(and(eq(bcraCheck.id, checkId), eq(bcraCheck.userId, userId)))
        .limit(1)
      check = (existing as RuntimeBCRACheck) || null
    } catch {
      check = null
    }
  }
  if (!check) {
    check = await safeTrySelectLastCheck(userId)
  }
  if (!check) {
    const [p] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
    if (p?.cuil) {
      const { persistBcraConsultation } = await import('@/lib/bcra-persist')
      const live = await persistBcraConsultation({
        userId,
        cuil: p.cuil,
        monthlyIncome: Number(p.monthlyIncome ?? 0),
      })
      if (live.ok) {
        check = await safeTrySelectLastCheck(userId)
      }
    }
  }
  if (!check) {
    throw new Error('No hay un informe BCRA real. Consultá tu situación desde Scoring e intentá de nuevo.')
  }

  const id = crypto.randomUUID()
  const reportNumber = `INF-BCRA-${Date.now().toString().slice(-8)}`
  const checkForReportId = check?.id ?? `synth-check-${id}`
  const raw = (check as any).rawResult ?? (check as any).rawResponse ?? {}
  const fullReportData = JSON.parse(
    JSON.stringify({
      ...check,
      cuil: check.cuil,
      consultedAt: check.consultedAt,
      deudas: raw.deudas,
      historicas: raw.historicas,
      chequesRechazados: raw.chequesRechazados,
      score: raw.score,
      denominacion: raw.denominacion,
      unavailable: false,
    }),
  )

  let report: any = null
  try {
    const inserted = await db
      .insert(bcraReport)
      .values({
        id,
        userId,
        bcraCheckId: checkForReportId,
        reportNumber,
        scoreAtGeneration: check?.computedScore ?? null,
        worstSituation: check?.worstSituation ?? null,
        totalDebt: check?.totalDebt ?? null,
        entitiesCount: check?.entitiesCount ?? null,
        hasRejectedChecks: check?.hasRejectedChecks ?? false,
        currency: 'ARS',
        fullReportData,
        branding: JSON.parse(
          JSON.stringify({
            ...receiptBranding(),
            reportType: 'Informe de Situación Crediticia BCRA',
          }),
        ),
        createdAt: new Date(),
      })
      .returning()
    report = inserted[0] ?? { id, reportNumber }
  } catch (e: any) {
    console.error('[documents.generateBCRAReport] insert bcraReport failed:', e?.message ?? String(e))
    throw new Error('No se pudo guardar el informe BCRA. Reintentá en unos minutos.')
  }

  revalidateCustomer()
  return { ok: true, reportId: report.id, reportNumber, fromCheckId: checkForReportId }
}

export async function getLastBCRAReport() {
  const userId = await assertRole('customer')
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

export async function getBCRAReport(id: string) {
  const userId = await assertRole('customer', 'admin')
  const role = await getRoleForUser(userId)
  const rows = await db
    .select()
    .from(bcraReport)
    .where(
      role === 'admin'
        ? eq(bcraReport.id, id)
        : and(eq(bcraReport.id, id), eq(bcraReport.userId, userId)),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function listBCRAReports(limit = 10) {
  const userId = await assertRole('customer')
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
    .select({ status: loan.status })
    .from(loan)
    .where(and(eq(loan.id, c.loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow) throw new Error('Crédito no encontrado')
  if (loanRow.status !== 'approved' && loanRow.status !== 'active') {
    throw new Error('El contrato sólo se puede aceptar sobre un crédito aprobado.')
  }

  const identRows = await db
    .select({ cuil: profile.cuil, fullName: userTable.name })
    .from(profile)
    .innerJoin(userTable, eq(userTable.id, profile.userId))
    .where(eq(profile.userId, userId))
    .limit(1)
  const ident = identRows[0] ?? { cuil: null, fullName: null }

  await db.transaction(async (tx) => {
    await tx
      .update(loanContract)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedIp: opts?.ip,
        acceptedUserAgent: opts?.ua,
        signatureType: opts?.signatureType ?? 'clickwrap',
        signerName: ident.fullName ?? null,
        signerCuil: ident.cuil ?? null,
        signatureData: {
          ...((c.signatureData as Record<string, unknown> | null) ?? {}),
          instruments: ['contrato_mutuo', 'pagare', 'cronograma', 'liquidaciones'],
          version: CONTRACT_VERSION,
          acceptedAs: 'deudor_y_librador',
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

  revalidateCustomer()
  return { ok: true }
}

export async function rejectLoanContract(contractId: string, reason: string) {
  const userId = await assertRole('customer')
  if (!reason?.trim()) throw new Error('Motivo de rechazo obligatorio')

  const [c] = await db
    .select({ loanId: loanContract.loanId })
    .from(loanContract)
    .where(and(eq(loanContract.id, contractId), eq(loanContract.userId, userId)))
    .limit(1)

  await db.transaction(async (tx) => {
    await tx
      .update(loanContract)
      .set({
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(loanContract.id, contractId), eq(loanContract.userId, userId)))
    if (c?.loanId) {
      await tx
        .update(loan)
        .set({ status: 'rejected', rejectionReason: reason.trim(), updatedAt: new Date() })
        .where(eq(loan.id, c.loanId))
      await tx
        .update(disbursement)
        .set({
          status: 'cancelled',
          failureReason: 'Contrato rechazado por el cliente',
          updatedAt: new Date(),
        })
        .where(and(eq(disbursement.loanId, c.loanId), ne(disbursement.status, 'credited')))
    }
  })

  revalidateCustomer()
  return { ok: true }
}

export async function issueIntimation(contractId: string) {
  const userId = await assertRole('admin')

  const [c] = await db
    .select({
      id: loanContract.id,
      userId: loanContract.userId,
      loanId: loanContract.loanId,
      signatureData: loanContract.signatureData,
    })
    .from(loanContract)
    .where(eq(loanContract.id, contractId))
    .limit(1)
  if (!c) throw new Error('Contrato no encontrado')

  await syncOverdueInstallments({ loanId: c.loanId })
  const plan = await db
    .select({
      number: installment.number,
      amount: installment.amount,
      dueDate: installment.dueDate,
      status: installment.status,
    })
    .from(installment)
    .where(eq(installment.loanId, c.loanId))
    .orderBy(installment.number)

  const decision = evaluateIntimation(asMoraRows(plan), lastRefinanceAt(c.signatureData))
  if (!decision.ok) throw new Error(decision.message)

  const noticeNumber = await persistIntimation(c.id, {
    overdueCount: decision.items.length,
    amount: decision.amount,
    installments: decision.items.map((row) => ({
      number: row.number,
      dueDate: new Date(row.dueDate).toISOString(),
      amount: row.amount,
      daysLate: row.daysLate,
    })),
  })

  await recordAudit({
    actorUserId: userId,
    action: 'INTIMATION_ISSUED',
    entityType: 'loan_contract',
    entityId: c.id,
    targetUserId: c.userId,
    severity: 'warning',
    summary: `Intimación ${noticeNumber} · ${decision.items.length} cuota(s) · ${decision.amount.toFixed(2)} ARS`,
  })
  await notifyIntimation({
    userId: c.userId,
    contractId: c.id,
    amount: decision.amount,
    overdueCount: decision.items.length,
  })

  revalidateOps()
  return { ok: true, noticeNumber, overdueCount: decision.items.length, amount: decision.amount }
}

export async function refinanceLoan(loanId: string) {
  const userId = await assertRole('customer', 'admin')
  const role = await getRoleForUser(userId)

  const [loanRow] = await db.select().from(loan).where(eq(loan.id, loanId)).limit(1)
  if (!loanRow) throw new Error('Crédito no encontrado.')
  if (role !== 'admin' && loanRow.userId !== userId) throw new Error('No autorizado.')
  if (loanRow.status === 'paid' || loanRow.status === 'rejected' || loanRow.status === 'cancelled') {
    throw new Error('Este crédito no admite refinanciación.')
  }

  const [contract] = await db
    .select()
    .from(loanContract)
    .where(eq(loanContract.loanId, loanId))
    .limit(1)
  if (!contract) throw new Error('Emití el contrato antes de refinanciar.')

  const used = readSignatureData(contract.signatureData).refinanciaciones?.length ?? 0
  const plan = await db
    .select()
    .from(installment)
    .where(eq(installment.loanId, loanId))
    .orderBy(installment.number)
  const decision = evaluateRefinance(asMoraRows(plan), used)
  if (!decision.ok) throw new Error(decision.message)

  const unpaid = plan.filter((row) => row.status !== 'paid')

  const outstanding = money(unpaid.reduce((sum, row) => sum + Number(row.amount), 0))
  const amounts = splitBalanceEvenly(outstanding, unpaid.length)
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const number = await db.transaction(async (tx) => {
    for (const [index, row] of unpaid.entries()) {
      await tx
        .update(installment)
        .set({
          amount: amounts[index].toFixed(2),
          dueDate: addMonths(start, index + 1),
          status: 'pending',
        })
        .where(eq(installment.id, row.id))
    }
    await tx
      .update(loan)
      .set({
        installmentAmount: amounts[0].toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(loan.id, loanId))
    return persistRefinance(
      contract.id,
      {
        outstanding,
        installmentAmount: amounts[0],
        remainingCount: unpaid.length,
      },
      tx,
    )
  })

  await recordAudit({
    actorUserId: userId,
    action: 'LOAN_REFINANCED',
    entityType: 'loan',
    entityId: loanId,
    targetUserId: loanRow.userId,
    summary: `Refinanciación ${number}/${MAX_REFINANCES} · saldo ${outstanding.toFixed(2)} en ${unpaid.length} cuotas`,
  })

  revalidateOps()
  revalidateCustomer()
  return {
    ok: true,
    number,
    remaining: MAX_REFINANCES - number,
    installmentAmount: amounts[0],
    remainingCount: unpaid.length,
    outstanding,
  }
}

export async function getContractForLoan(loanId: string) {
  const userId = await assertRole('customer')
  const rows = await db
    .select()
    .from(loanContract)
    .where(and(eq(loanContract.loanId, loanId), eq(loanContract.userId, userId)))
    .orderBy(desc(loanContract.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function getLoanDetailsForContract(loanId: string) {
  const userId = await assertRole('customer')

  const [loanRow] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow) return null

  const installments = await db
    .select()
    .from(installment)
    .where(and(eq(installment.loanId, loanId), eq(installment.userId, userId)))
    .orderBy(installment.number)

  const [customer] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1)

  return {
    loan: loanRow,
    installments,
    customer: customer ?? null,
  }
}