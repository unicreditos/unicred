/**
 * Mantenimiento diario de la venta en comercios (cron): recordatorios y vencimiento del plazo del cliente,
 * conciliación de QR de anticipos por si se perdió un webhook, feriados del año y resumen para tesorería.
 */
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import { loan, merchantOrder } from '@/lib/db/schema'
import { formatARS } from '@/lib/finance'
import { touchDesk } from '@/lib/merchant-orders/desk-cache'
import { settleDownPaymentFromMp } from '@/lib/merchant-orders/down-payment'
import { loadBankHolidays, refreshBankHolidays } from '@/lib/merchant-orders/holidays'
import { notifyOpsDigest, notifyOrderCancelled, notifyPendingStepsReminder } from '@/lib/merchant-orders/notify'
import { arDateKey } from '@/lib/date-ar'
import { DOWN_PAYMENT_WINDOW_DAYS, followUpFor, formatPayDate, isBusinessDay, lastHolidayYear } from '@/lib/merchant-orders/rules'
import { cancelOrder, listSettlements, loadOrders } from '@/lib/merchant-orders/service'
import { and, eq, gt, isNotNull, isNull, ne, sql } from 'drizzle-orm'

const DAY_MS = 24 * 60 * 60 * 1000

/** Operaciones aprobadas que esperan al cliente: recordatorios y anulación al vencer el plazo. */
export async function followUpWaitingOrders(now: Date = new Date()) {
  await ensureMerchantCommerceSchema()
  const rows = await db
    .select({ id: merchantOrder.id })
    .from(merchantOrder)
    .innerJoin(loan, eq(loan.id, merchantOrder.loanId))
    .where(and(eq(loan.status, 'approved'), isNull(merchantOrder.cancelledAt), isNull(merchantOrder.deliveredAt)))
    .limit(500)
  const out = { checked: rows.length, reminded: 0, expired: 0, errors: 0 }
  for (const { id } of rows) {
    try {
      const [o] = await loadOrders({ orderId: id, limit: 1 })
      if (!o || o.stage !== 'esperando_cliente') continue
      const since = new Date(o.approvedAt ?? o.createdAt).getTime()
      const ageDays = (now.getTime() - since) / DAY_MS
      const action = followUpFor({ ageDays, remindersSent: o.remindersSent, downPaymentStatus: o.downPaymentStatus, contractSigned: o.contractSigned })
      if (!action) continue
      if (action.kind === 'expire') {
        const reason = `Venció el plazo de ${DOWN_PAYMENT_WINDOW_DAYS} días para firmar y pagar el anticipo`
        await cancelOrder({ orderId: o.id, by: 'sistema', reason, asAdmin: true })
        await recordAudit({
          actorUserId: '',
          action: 'MERCHANT_ORDER_EXPIRED',
          entityType: 'merchant_order',
          entityId: o.id,
          targetUserId: o.customerUserId,
          summary: `${o.code}: ${reason}`,
        })
        await notifyOrderCancelled(o.id)
        out.expired++
      } else {
        // Primero se marca (así un reintento del cron no duplica el mail).
        const marked = await db
          .update(merchantOrder)
          .set({ remindersSent: o.remindersSent + 1, updatedAt: now })
          .where(and(eq(merchantOrder.id, o.id), eq(merchantOrder.remindersSent, o.remindersSent)))
          .returning({ id: merchantOrder.id })
        if (!marked.length) continue
        await notifyPendingStepsReminder(o.id, action.daysLeft)
        out.reminded++
      }
    } catch (err) {
      out.errors++
      console.error('[merchant-orders/maintenance] seguimiento', id, err instanceof Error ? err.message : err)
    }
  }
  if (out.expired) touchDesk()
  return out
}

/** Si un webhook de Mercado Pago no llegó, el anticipo pagado con QR se acredita igual. */
export async function reconcileDownPaymentQrs(now: Date = new Date()) {
  await ensureMerchantCommerceSchema()
  const rows = await db
    .select({ id: merchantOrder.id, mpOrderId: merchantOrder.mpOrderId })
    .from(merchantOrder)
    .where(
      and(
        isNotNull(merchantOrder.mpOrderId),
        ne(merchantOrder.downPaymentStatus, 'confirmed'),
        gt(merchantOrder.mpQrExpiresAt, new Date(now.getTime() - 2 * DAY_MS)),
      ),
    )
    .limit(80)
  const out = { checked: rows.length, credited: 0, errors: 0 }
  for (const r of rows) {
    try {
      const res = await settleDownPaymentFromMp({ orderId: r.mpOrderId })
      if (res.matched && res.credited) out.credited++
    } catch (err) {
      out.errors++
      console.error('[merchant-orders/maintenance] QR', r.id, err instanceof Error ? err.message : err)
    }
  }
  return out
}

/** Resumen para tesorería y la mesa, solo en días hábiles y solo si hay algo pendiente. */
export async function sendOpsDigest(now: Date = new Date()) {
  await ensureMerchantCommerceSchema()
  await loadBankHolidays()
  const today = arDateKey(now)
  if (!isBusinessDay(today)) return { sent: false, reason: 'no hábil' }

  const due = (await listSettlements({ status: 'scheduled', limit: 500 })).filter((r) => r.s.payDate <= today && Number(r.s.netAmount) > 0)
  const [counts] = await db
    .select({
      reported: sql<number>`count(*) filter (where ${merchantOrder.downPaymentStatus} = 'reported' and ${merchantOrder.cancelledAt} is null)::int`,
      refunds: sql<number>`count(*) filter (where ${merchantOrder.refundStatus} = 'pending')::int`,
      refundsAmount: sql<string>`coalesce(sum(${merchantOrder.refundAmount}) filter (where ${merchantOrder.refundStatus} = 'pending'), 0)`,
    })
    .from(merchantOrder)
  const [review] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(merchantOrder)
    .innerJoin(loan, eq(loan.id, merchantOrder.loanId))
    .where(and(eq(loan.status, 'pending'), isNull(merchantOrder.cancelledAt)))

  const lines: string[] = []
  if (due.length) {
    const total = due.reduce((s, r) => s + Number(r.s.netAmount), 0)
    lines.push(`Liquidaciones para pagar hoy (${formatPayDate(today)}): ${due.length} por ${formatARS(total)}.`)
    for (const r of due.slice(0, 20)) {
      const late = r.s.payDate < today ? ` · vencida desde el ${formatPayDate(r.s.payDate)}` : ''
      const account = r.payoutCbu ? `CBU …${r.payoutCbu.slice(-4)}` : 'SIN CUENTA DE COBRO'
      lines.push(`• ${r.merchantName}: ${formatARS(r.s.netAmount)} (${r.s.orderCount} ventas) · ${account}${late}`)
    }
  }
  if (Number(review?.n ?? 0)) lines.push(`Ventas en comercios esperando a la mesa: ${review!.n}.`)
  if (Number(counts?.reported ?? 0)) lines.push(`Anticipos por transferencia para revisar: ${counts!.reported}.`)
  if (Number(counts?.refunds ?? 0)) lines.push(`Anticipos para devolver (ventas anuladas): ${counts!.refunds} por ${formatARS(counts!.refundsAmount)}.`)
  const year = Number(today.slice(0, 4))
  if (lastHolidayYear() <= year && today.slice(5) >= '11-15') {
    lines.push(`Todavía no hay feriados cargados para ${year + 1}: revisá que la fuente oficial los haya publicado.`)
  }
  if (!lines.length) return { sent: false, reason: 'nada pendiente' }
  await notifyOpsDigest({ title: `Comercios: pendientes del ${formatPayDate(today)}`, lines })
  return { sent: true, lines: lines.length }
}

export async function runMerchantMaintenance(now: Date = new Date()) {
  const safe = async <T>(label: string, fn: () => Promise<T>) => {
    try {
      return await fn()
    } catch (err) {
      console.error(`[merchant-orders/maintenance] ${label}:`, err instanceof Error ? err.message : err)
      return { error: err instanceof Error ? err.message : 'error' }
    }
  }
  const holidays = await safe('feriados', () => refreshBankHolidays(now))
  const qr = await safe('QR', () => reconcileDownPaymentQrs(now))
  const followUp = await safe('seguimiento', () => followUpWaitingOrders(now))
  const digest = await safe('resumen', () => sendOpsDigest(now))
  return { holidays, qr, followUp, digest }
}
