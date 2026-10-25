import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ensureAppTables } from '@/lib/db/ensure'
import { mpQrOrder } from '@/lib/db/schema'
import { settleQrPayment, syncQrOrder } from '@/lib/mercadopago/settle'

export type QrDispatch = { handled: boolean; body?: Record<string, unknown> }

/**
 * Mercado Pago permite UNA sola dirección de avisos por aplicación: acá llegan tanto los cobros con QR de las
 * billeteras como los pagos de cuotas. Esto resuelve los primeros; si el aviso no es de una caja ni de una orden
 * QR de billetera devuelve `handled: false` y el webhook sigue con el circuito de cuotas.
 */
export async function dispatchWalletQrNotification(input: { dataId: string; isOrder: boolean; topic: string }): Promise<QrDispatch> {
  const { dataId, isOrder, topic } = input
  if (!dataId) return { handled: false }
  try {
    await ensureAppTables()
    if (isOrder) {
      const [o] = await db.select({ id: mpQrOrder.id }).from(mpQrOrder).where(eq(mpQrOrder.mpOrderId, dataId)).limit(1)
      if (!o) return { handled: false }
      const r = await syncQrOrder(o.id)
      return { handled: true, body: { ok: true, matched: true, wallet: true, status: r.status, credited: r.creditedCents / 100 } }
    }
    if (topic && !topic.startsWith('payment')) return { handled: false }
    const r = await settleQrPayment(dataId)
    if (!r.matched) return { handled: false }
    return { handled: true, body: { ok: true, matched: true, wallet: true, status: r.status ?? null, credited: r.creditedCents / 100 } }
  } catch (err) {
    // No debe frenar el circuito de cuotas; la conciliación (cron) levanta lo que quede pendiente.
    console.error('[mp-webhook] cobro QR de billetera:', err instanceof Error ? err.message : err)
    return { handled: false }
  }
}
