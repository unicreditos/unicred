/**
 * Acreditación Payway: la cuota y el recibo se emiten cuando el webhook o la
 * simulación sandbox confirman approved + importe suficiente. Idempotente.
 */

import { db } from '@/lib/db'
import { installment, loan, payment as paymentTable, paymentReceipt } from '@/lib/db/schema'
import { receiptBranding } from '@/lib/brand'
import { mapPaywayStatus } from '@/lib/payway'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import type { SettleResult } from '@/lib/payments/settle-mp'

type PaywaySettleDb = {
  select: typeof db.select
  insert: typeof db.insert
  update: typeof db.update
}

const RECEIPT_BRANDING = receiptBranding()

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v)).filter(Boolean)
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function findLocalPaywayPaymentId(input: {
  paywayId?: string | null
  localPaymentId?: string | null
  externalReference?: string | null
}) {
  const ids = []
  if (input.localPaymentId) ids.push(eq(paymentTable.id, input.localPaymentId))
  if (input.paywayId) {
    ids.push(eq(paymentTable.externalId, input.paywayId))
    ids.push(eq(paymentTable.paymentLinkId, input.paywayId))
    ids.push(eq(paymentTable.referenceNumber, input.paywayId))
  }
  if (input.externalReference) ids.push(eq(paymentTable.referenceNumber, String(input.externalReference)))
  if (!ids.length) return null
  const [row] = await db
    .select({ id: paymentTable.id })
    .from(paymentTable)
    .where(and(eq(paymentTable.gateway, 'payway'), or(...ids)))
    .limit(1)
  return row?.id ?? null
}

export async function settlePaywayPayment(input: {
  status: string
  amount: number
  localPaymentId?: string | null
  paywayId?: string | null
  externalReference?: string | null
  method?: string | null
  gatewayPayload?: Record<string, unknown> | null
  tx?: PaywaySettleDb
}): Promise<SettleResult> {
  const localStatus = mapPaywayStatus(input.status)
  const paidAmount = toNumber(input.amount)
  const localPaymentId =
    input.localPaymentId ??
    (await findLocalPaywayPaymentId({
      paywayId: input.paywayId,
      externalReference: input.externalReference,
    }))

  if (!localPaymentId) {
    return { matched: false, credited: 0, reason: 'sin_correspondencia' }
  }
  if (!localStatus) {
    return { matched: true, credited: 0, localPaymentId, reason: 'estado_desconocido', localStatus: undefined }
  }

  const run = async (tx: PaywaySettleDb) => {
    const [localPay] = await tx
      .select()
      .from(paymentTable)
      .where(eq(paymentTable.id, localPaymentId))
      .for('update')
      .limit(1)
    if (!localPay) return { matched: false as const, credited: 0 }
    if (localPay.gateway !== 'payway') {
      return { matched: false as const, credited: 0, reason: 'gateway_distinto' }
    }

    const previousGateway = (localPay.gatewayResponse as Record<string, unknown>) ?? {}
    const installmentIds = asIdList(previousGateway.installment_ids ?? (localPay.installmentId ? [localPay.installmentId] : []))
    const now = new Date()
    const gatewayResponse = {
      ...previousGateway,
      paywayPayload: input.gatewayPayload ?? previousGateway.paywayPayload,
      processedAt: now.toISOString(),
      payway_status: input.status,
      payway_id: input.paywayId ?? previousGateway.payway_id,
      installment_ids: installmentIds,
    }
    const baseUpdate: Record<string, unknown> = {
      gatewayResponse,
      updatedAt: now,
      externalId: String(input.paywayId ?? localPay.externalId ?? localPay.id),
    }
    if (input.method) baseUpdate.method = input.method

    if (localStatus !== 'paid') {
      const nextStatus = localStatus
      await tx
        .update(paymentTable)
        .set({
          ...baseUpdate,
          status: nextStatus,
          ...(nextStatus === 'failed' ? { failureReason: String(input.status) } : {}),
          ...(nextStatus === 'refunded' ? { refundedAt: now } : {}),
        } as any)
        .where(eq(paymentTable.id, localPay.id))
      const newlyFailed = nextStatus === 'failed' && localPay.status !== 'failed'
      return {
        matched: true as const,
        credited: 0,
        localPaymentId: localPay.id,
        userId: localPay.userId,
        rejected: newlyFailed,
        amount: paidAmount || toNumber(localPay.amount),
        reason: newlyFailed ? String(input.status) : undefined,
        localStatus: nextStatus,
      }
    }

    if (!installmentIds.length) {
      await tx
        .update(paymentTable)
        .set({ ...baseUpdate, status: 'processing', notes: 'Payway approved sin cuotas asociadas.' } as any)
        .where(eq(paymentTable.id, localPay.id))
      return { matched: true as const, credited: 0, localPaymentId: localPay.id, localStatus: 'processing' }
    }

    const insts = await tx
      .select()
      .from(installment)
      .where(and(inArray(installment.id, installmentIds), eq(installment.userId, localPay.userId)))
      .for('update')
    const unpaid = insts.filter((i) => i.status !== 'paid')
    const expected = (unpaid.length ? unpaid : insts).reduce((acc, i) => acc + toNumber(i.amount), 0)
    const creditAmount = paidAmount > 0 ? paidAmount : toNumber(localPay.amount)

    if (!(creditAmount > 0)) {
      await tx.update(paymentTable).set({ ...baseUpdate, status: 'processing' } as any).where(eq(paymentTable.id, localPay.id))
      return { matched: true as const, credited: 0, amountMissing: true as const, localPaymentId: localPay.id, localStatus: 'processing' }
    }
    if (unpaid.length && creditAmount + 0.01 < expected) {
      await tx
        .update(paymentTable)
        .set({
          ...baseUpdate,
          status: 'processing',
          notes: `Importe insuficiente Payway: cobrado ${creditAmount} < esperado ${expected}`,
        } as any)
        .where(eq(paymentTable.id, localPay.id))
      return {
        matched: true as const,
        credited: 0,
        underpaid: true as const,
        localPaymentId: localPay.id,
        amount: creditAmount,
        localStatus: 'processing',
      }
    }

    if (!unpaid.length) {
      await tx
        .update(paymentTable)
        .set({ ...baseUpdate, status: 'paid', paidAt: localPay.paidAt ?? now } as any)
        .where(eq(paymentTable.id, localPay.id))
      return {
        matched: true as const,
        duplicate: true as const,
        credited: 0,
        localPaymentId: localPay.id,
        userId: localPay.userId,
        amount: creditAmount,
        localStatus: 'paid',
      }
    }

    const loanId = String(previousGateway.loanId ?? unpaid[0]?.loanId ?? localPay.loanId ?? '')
    const [loanRow] = loanId ? await tx.select().from(loan).where(eq(loan.id, loanId)).limit(1) : [null]

    for (const inst of unpaid) {
      await tx.update(installment).set({ status: 'paid', paidAt: now }).where(eq(installment.id, inst.id))
    }

    let allInsts = insts
    if (loanId) {
      allInsts = await tx.select().from(installment).where(eq(installment.loanId, loanId))
      const paidCount = allInsts.filter((i) => i.status === 'paid').length
      const nextLoan = paidCount === allInsts.length && allInsts.length > 0 ? 'paid' : 'active'
      if (loanRow && loanRow.status !== nextLoan && loanRow.status !== 'paid') {
        await tx.update(loan).set({ status: nextLoan, updatedAt: now }).where(eq(loan.id, loanId))
      }
    }

    const pending = allInsts.filter((i) => i.status !== 'paid')
    const totalRemaining = pending.reduce((a, i) => a + toNumber(i.amount), 0)
    const totalPaid = allInsts.filter((i) => i.status === 'paid').reduce((a, i) => a + toNumber(i.amount), 0)
    const principalTotal = allInsts.reduce((a, i) => a + toNumber(i.amount), 0)
    const opId = String(input.paywayId ?? localPay.referenceNumber ?? localPay.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)

    let firstReceiptId: string | null = null
    for (const inst of unpaid) {
      const receiptNumber = `REC-PW-${opId}-${String(inst.number ?? 0).padStart(2, '0')}`
      const receiptId = crypto.randomUUID()
      const inserted = await tx
        .insert(paymentReceipt)
        .values({
          id: receiptId,
          receiptNumber,
          receiptType: 'payment',
          userId: localPay.userId,
          paymentId: localPay.id,
          loanId: inst.loanId ?? null,
          installmentId: inst.id,
          amount: String(inst.amount),
          currency: 'ARS',
          loanSnapshot: loanRow ? JSON.parse(JSON.stringify(loanRow)) : null,
          installmentSnapshot: JSON.parse(JSON.stringify(inst)),
          previousBalance: String(principalTotal),
          newBalance: String(totalRemaining),
          pendingInstallments: pending.length,
          totalPaidToDate: String(totalPaid),
          method: input.method || localPay.method || 'payway_qr',
          referenceNumber: localPay.referenceNumber ?? opId,
          paidAt: now,
          issuedAt: now,
          branding: RECEIPT_BRANDING,
          createdAt: now,
        })
        .onConflictDoNothing({ target: paymentReceipt.receiptNumber })
        .returning({ id: paymentReceipt.id })
      if (!firstReceiptId) firstReceiptId = inserted[0]?.id ?? receiptId
    }

    await tx
      .update(paymentTable)
      .set({ ...baseUpdate, status: 'paid', paidAt: now } as any)
      .where(eq(paymentTable.id, localPay.id))

    return {
      matched: true as const,
      credited: unpaid.length,
      localPaymentId: localPay.id,
      userId: localPay.userId,
      amount: creditAmount,
      installmentNumber: unpaid.length === 1 ? unpaid[0].number : undefined,
      receiptId: firstReceiptId,
      localStatus: 'paid',
    }
  }

  const result = input.tx ? await run(input.tx) : await db.transaction(run)

  if (!result.receiptId && result.localPaymentId && result.credited > 0) {
    const [rcpt] = await db
      .select({ id: paymentReceipt.id })
      .from(paymentReceipt)
      .where(eq(paymentReceipt.paymentId, result.localPaymentId))
      .limit(1)
    return { ...result, receiptId: rcpt?.id ?? null }
  }

  return result
}

export async function reconcileOpenPaywayPayments(limit = 40) {
  const open = await db
    .select({
      id: paymentTable.id,
      externalId: paymentTable.externalId,
      status: paymentTable.status,
    })
    .from(paymentTable)
    .where(and(eq(paymentTable.gateway, 'payway'), inArray(paymentTable.status, ['pending', 'processing'])))
    .orderBy(desc(paymentTable.createdAt))
    .limit(limit)

  return open.map((row) => ({
    matched: true,
    credited: 0,
    localPaymentId: row.id,
    localStatus: row.status,
    reason: 'sandbox_sin_consulta_live',
  })) as SettleResult[]
}
