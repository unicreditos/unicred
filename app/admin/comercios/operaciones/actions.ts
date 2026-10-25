'use server'

/** Backoffice de ventas en comercios: anticipos, anulaciones y pago de liquidaciones. */
import { recordAudit } from '@/lib/audit'
import {
  notifyDownPaymentConfirmed,
  notifyDownPaymentRejected,
  notifyOrderCancelled,
  notifyRefunded,
  notifySettlementPaid,
} from '@/lib/merchant-orders/notify'
import { cancelOrder, confirmDownPayment, markSettlementPaid, OrderError, refundDownPayment, rejectDownPayment } from '@/lib/merchant-orders/service'
import { requirePermission } from '@/lib/rbac'
import { touchDesk } from '@/lib/merchant-orders/desk-cache'
import { revalidatePath } from 'next/cache'

export type OpsResult = { ok: true } | { ok: false; error: string }

function fail(err: unknown): OpsResult {
  const message = err instanceof Error ? err.message : ''
  if (err instanceof OrderError || /^No autorizado|permiso/i.test(message)) return { ok: false, error: message }
  console.error('[admin/comercios/operaciones]', message)
  return { ok: false, error: 'No se pudo completar la acción. Reintentá en unos segundos.' }
}

const refresh = (orderId?: string) => {
  touchDesk()
  revalidatePath('/admin/comercios/operaciones')
  revalidatePath('/admin/comercios/liquidaciones')
  if (orderId) revalidatePath(`/admin/comercios/operaciones/${orderId}`)
}

export async function adminConfirmDownPayment(input: { orderId: string; reference: string }): Promise<OpsResult> {
  try {
    const adminId = await requirePermission('payments.reconcile')
    const reference = input.reference.trim()
    if (reference.length < 4) throw new OrderError('Anotá el número de operación que ves en el extracto.')
    const res = await confirmDownPayment({ orderId: input.orderId, by: adminId, method: 'transferencia', reference })
    if (res.refundNeeded) {
      await recordAudit({
        actorUserId: adminId,
        action: 'DOWN_PAYMENT_REFUND_PENDING',
        entityType: 'merchant_order',
        entityId: input.orderId,
        targetUserId: res.order.customerUserId,
        severity: 'warning',
        summary: `Transferencia ref. ${reference} recibida con la operación anulada: queda para devolver`,
      })
    }
    if (res.changed) {
      await recordAudit({
        actorUserId: adminId,
        action: 'DOWN_PAYMENT_CONFIRMED',
        entityType: 'merchant_order',
        entityId: input.orderId,
        targetUserId: res.order.customerUserId,
        severity: 'warning',
        summary: `Anticipo $ ${res.order.downPaymentAmount} acreditado · ref. ${reference}`,
      })
      await notifyDownPaymentConfirmed(input.orderId)
    }
    refresh(input.orderId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function adminRejectDownPayment(input: { orderId: string; note: string }): Promise<OpsResult> {
  try {
    const adminId = await requirePermission('payments.reconcile')
    const note = input.note.trim()
    if (note.length < 8) throw new OrderError('Contale al cliente por qué no se acredita (mínimo 8 caracteres).')
    await rejectDownPayment({ orderId: input.orderId, by: adminId, note })
    await recordAudit({ actorUserId: adminId, action: 'DOWN_PAYMENT_REJECTED', entityType: 'merchant_order', entityId: input.orderId, summary: note })
    await notifyDownPaymentRejected(input.orderId, note)
    refresh(input.orderId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function adminCancelOrder(input: { orderId: string; reason: string }): Promise<OpsResult> {
  try {
    const adminId = await requirePermission('merchants.write')
    const res = await cancelOrder({ orderId: input.orderId, by: adminId, reason: input.reason, asAdmin: true })
    await recordAudit({
      actorUserId: adminId,
      action: 'MERCHANT_ORDER_CANCELLED',
      entityType: 'merchant_order',
      entityId: input.orderId,
      severity: 'warning',
      summary: `Anulada por UNICRÉDITOS: ${input.reason.trim()}${res?.refundPending ? ' · anticipo a devolver' : ''}`,
    })
    if (res) await notifyOrderCancelled(input.orderId)
    refresh(input.orderId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function adminMarkSettlementPaid(input: { settlementId: string; transferReference: string; notes?: string }): Promise<OpsResult> {
  try {
    const adminId = await requirePermission('disbursements.credit')
    const s = await markSettlementPaid({ settlementId: input.settlementId, by: adminId, transferReference: input.transferReference, notes: input.notes })
    await recordAudit({
      actorUserId: adminId,
      action: 'MERCHANT_SETTLEMENT_PAID',
      entityType: 'merchant_settlement',
      entityId: s.id,
      severity: 'warning',
      summary: `${s.code} · $ ${s.netAmount} · op. ${s.transferReference}`,
    })
    await notifySettlementPaid({ merchantId: s.merchantId, code: s.code, netAmount: s.netAmount, transferReference: s.transferReference ?? '' })
    refresh()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function adminRefundDownPayment(input: { orderId: string; method: 'mp' | 'transferencia'; reference?: string }): Promise<OpsResult> {
  try {
    const adminId = await requirePermission('disbursements.credit')
    const res = await refundDownPayment({ orderId: input.orderId, by: adminId, method: input.method, reference: input.reference })
    if (res.changed) {
      await recordAudit({
        actorUserId: adminId,
        action: 'DOWN_PAYMENT_REFUNDED',
        entityType: 'merchant_order',
        entityId: input.orderId,
        targetUserId: res.order.customerUserId,
        severity: 'warning',
        summary: `Anticipo $ ${res.order.refundAmount ?? res.order.downPaymentAmount} devuelto · ${res.order.refundReference ?? ''}`.trim(),
      })
      await notifyRefunded(input.orderId)
    }
    refresh(input.orderId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
