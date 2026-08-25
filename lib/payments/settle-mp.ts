/**
 * Conciliación Mercado Pago: la cuota y el recibo se emiten recién cuando
 * la API de MP confirma approved + importe suficiente. Idempotente.
 */

import { db } from '@/lib/db'
import { installment, loan, payment as paymentTable, paymentReceipt } from '@/lib/db/schema'
import { receiptBranding } from '@/lib/brand'
import { getPaymentMP } from '@/lib/mercadopago'
import { and, eq, inArray, or } from 'drizzle-orm'

const RECEIPT_BRANDING = receiptBranding()

export type SettleResult = {
  matched: boolean
  duplicate?: boolean
  credited: number
  localPaymentId?: string
  userId?: string
  amount?: number
  installmentNumber?: number
  receiptId?: string | null
  rejected?: boolean
  reason?: string
  localStatus?: string
  amountMissing?: boolean
  underpaid?: boolean
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v)).filter(Boolean)
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function mapMpStatus(mpStatus: string | null | undefined): string | null {
  switch (mpStatus) {
    case 'approved':
      return 'paid'
    case 'rejected':
    case 'cancelled':
      return 'failed'
    case 'refunded':
    case 'charged_back':
      return 'refunded'
    case 'in_process':
    case 'pending':
    case 'authorized':
      return 'processing'
    default:
      return null
  }
}

export function sameInstallmentSet(stored: unknown, expected: string[]) {
  const a = asIdList(stored).slice().sort()
  const b = expected.slice().sort()
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export async function findLocalPaymentId(input: {
  mpPaymentId?: string | null
  preferenceId?: string | null
  externalReference?: string | null
  metadataPaymentId?: string | null
}) {
  const conds = []
  if (input.metadataPaymentId) conds.push(eq(paymentTable.id, input.metadataPaymentId))
  if (input.mpPaymentId) {
    conds.push(eq(paymentTable.externalId, input.mpPaymentId))
    conds.push(eq(paymentTable.paymentLinkId, input.mpPaymentId))
  }
  if (input.externalReference) conds.push(eq(paymentTable.referenceNumber, String(input.externalReference)))
  if (input.preferenceId) conds.push(eq(paymentTable.paymentLinkId, String(input.preferenceId)))
  if (!conds.length) return null

  const [row] = await db
    .select({ id: paymentTable.id })
    .from(paymentTable)
    .where(or(...conds))
    .limit(1)
  return row?.id ?? null
}

export async function settleMercadoPagoPayment(input: {
  mpPaymentId: string
  localPaymentId?: string | null
  webhookBody?: Record<string, unknown> | null
}): Promise<SettleResult> {
  const fetched = (await getPaymentMP(input.mpPaymentId)) as Record<string, unknown> | null
  if (!fetched) {
    return { matched: false, credited: 0, reason: 'mp_api_unavailable' }
  }

  const mpStatus = String(fetched.status ?? '')
  const localStatus = mapMpStatus(mpStatus)
  const paidAmount = toNumber(fetched.transaction_amount)
  const preferenceId = fetched.preference_id ? String(fetched.preference_id) : null
  const externalReference = fetched.external_reference ? String(fetched.external_reference) : null
  const meta = (fetched.metadata as Record<string, unknown> | null) ?? {}
  const metadataPaymentId = meta.local_payment_id ? String(meta.local_payment_id) : null

  const localPaymentId =
    input.localPaymentId ??
    (await findLocalPaymentId({
      mpPaymentId: input.mpPaymentId,
      preferenceId,
      externalReference,
      metadataPaymentId,
    }))

  if (!localPaymentId) {
    return { matched: false, credited: 0, reason: 'sin_correspondencia' }
  }

  const result = await db.transaction(async (tx) => {
    const [localPay] = await tx
      .select()
      .from(paymentTable)
      .where(eq(paymentTable.id, localPaymentId))
      .for('update')
      .limit(1)
    if (!localPay) return { matched: false as const, credited: 0 }

    const previousGateway = (localPay.gatewayResponse as Record<string, unknown>) ?? {}
    const installmentIds = asIdList(
      previousGateway.installment_ids ?? meta.installment_ids ?? (localPay.installmentId ? [localPay.installmentId] : []),
    )

    const now = new Date()
    const mpMethodId = String(fetched.payment_method_id ?? '').toLowerCase()
    const methodUpdate =
      mpMethodId === 'pagofacil'
        ? 'pago_facil'
        : mpMethodId === 'rapipago'
          ? 'rapipago'
          : mpMethodId === 'account_money'
            ? 'mercadopago_wallet'
            : undefined

    const ticketUrl = (fetched.transaction_details as { external_resource_url?: string } | undefined)
      ?.external_resource_url

    const gatewayResponse = {
      ...previousGateway,
      webhookBody: input.webhookBody ?? previousGateway.webhookBody,
      fetchedPayment: fetched,
      processedAt: now.toISOString(),
      mpPaymentId: input.mpPaymentId,
      externalReference,
      installment_ids: installmentIds,
      preference_id: previousGateway.preference_id ?? preferenceId,
    }

    const baseUpdate: Record<string, unknown> = {
      gatewayResponse,
      updatedAt: now,
      externalId: input.mpPaymentId,
    }
    if (methodUpdate) baseUpdate.method = methodUpdate
    if (ticketUrl) {
      baseUpdate.paymentLinkUrl = ticketUrl
      baseUpdate.notes = `Cupón ${mpMethodId || 'ticket'} generado. Pagá en Pago Fácil, Rapipago u otra red habilitada.`
    }

    if (localStatus !== 'paid') {
      const nextStatus = localStatus ?? localPay.status
      await tx
        .update(paymentTable)
        .set({
          ...baseUpdate,
          status: nextStatus,
          ...(nextStatus === 'failed'
            ? {
                failureReason:
                  String(fetched.status_detail ?? '') || 'rechazado por gateway',
              }
            : {}),
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
        reason: newlyFailed ? String(fetched.status_detail ?? 'rechazado por gateway') : undefined,
        localStatus: nextStatus,
      }
    }

    if (!installmentIds.length) {
      await tx
        .update(paymentTable)
        .set({
          ...baseUpdate,
          status: 'processing',
          notes: 'MP approved pero el pago local no tiene cuotas asociadas.',
        } as any)
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

    if (!(paidAmount > 0)) {
      await tx
        .update(paymentTable)
        .set({ ...baseUpdate, status: 'processing' } as any)
        .where(eq(paymentTable.id, localPay.id))
      return {
        matched: true as const,
        credited: 0,
        amountMissing: true as const,
        localPaymentId: localPay.id,
        localStatus: 'processing',
      }
    }
    if (unpaid.length && paidAmount + 0.01 < expected) {
      await tx
        .update(paymentTable)
        .set({
          ...baseUpdate,
          status: 'processing',
          notes: `Importe insuficiente: cobrado ${paidAmount} < esperado ${expected}`,
        } as any)
        .where(eq(paymentTable.id, localPay.id))
      return {
        matched: true as const,
        credited: 0,
        underpaid: true as const,
        localPaymentId: localPay.id,
        amount: paidAmount,
        localStatus: 'processing',
      }
    }

    if (!unpaid.length) {
      await tx
        .update(paymentTable)
        .set({
          ...baseUpdate,
          status: 'paid',
          paidAt: localPay.paidAt ?? now,
        } as any)
        .where(eq(paymentTable.id, localPay.id))
      return {
        matched: true as const,
        duplicate: true as const,
        credited: 0,
        localPaymentId: localPay.id,
        userId: localPay.userId,
        amount: paidAmount,
        localStatus: 'paid',
      }
    }

    const loanId = unpaid[0].loanId
    const [loanRow] = loanId
      ? await tx.select().from(loan).where(eq(loan.id, loanId)).limit(1)
      : [null]

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

    let firstReceiptId: string | null = null
    for (const inst of unpaid) {
      const receiptNumber = `REC-MP-${input.mpPaymentId}-${String(inst.number ?? 0).padStart(2, '0')}`
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
          method: 'mercado_pago',
          referenceNumber: localPay.referenceNumber ?? input.mpPaymentId,
          paidAt: now,
          issuedAt: now,
          branding: RECEIPT_BRANDING,
          createdAt: now,
        })
        .onConflictDoNothing({ target: paymentReceipt.receiptNumber })
        .returning({ id: paymentReceipt.id })
      if (!firstReceiptId) firstReceiptId = inserted[0]?.id ?? null
    }

    await tx
      .update(paymentTable)
      .set({
        ...baseUpdate,
        status: 'paid',
        paidAt: now,
      } as any)
      .where(eq(paymentTable.id, localPay.id))

    return {
      matched: true as const,
      credited: unpaid.length,
      localPaymentId: localPay.id,
      userId: localPay.userId,
      amount: paidAmount,
      installmentNumber: unpaid.length === 1 ? unpaid[0].number : undefined,
      receiptId: firstReceiptId,
      localStatus: 'paid',
    }
  })

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

export async function reconcileOpenMercadoPagoPayments(limit = 40) {
  const open = await db
    .select({
      id: paymentTable.id,
      externalId: paymentTable.externalId,
      gatewayResponse: paymentTable.gatewayResponse,
      status: paymentTable.status,
    })
    .from(paymentTable)
    .where(inArray(paymentTable.status, ['pending', 'processing']))
    .limit(limit)

  const results: SettleResult[] = []
  for (const row of open) {
    const gw = (row.gatewayResponse as Record<string, unknown> | null) ?? {}
    const raw = String(row.externalId || gw.mp_payment_id || '')
    const mpId = /^\d+$/.test(raw) ? raw : ''
    if (!mpId) continue
    try {
      results.push(await settleMercadoPagoPayment({ mpPaymentId: mpId, localPaymentId: row.id }))
    } catch (err) {
      console.error('[reconcile-mp]', row.id, err instanceof Error ? err.message : err)
    }
  }
  return results
}
