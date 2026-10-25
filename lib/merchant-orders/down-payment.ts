/**
 * Cobro del anticipo del 30%: QR dinámico de Mercado Pago (se acredita solo por webhook) o transferencia a
 * la cuenta de UNICRÉDITOS con comprobante (la acredita tesorería). Nunca se le paga al comercio.
 */
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { merchantOrder } from '@/lib/db/schema'
import { getPaymentMP } from '@/lib/mercadopago'
import { createMercadoPagoQrOrder, getMercadoPagoQrOrder, paymentIdsFromQrOrder } from '@/lib/mercadopago-qr'
import { touchDesk } from '@/lib/merchant-orders/desk-cache'
import { notifyDownPaymentConfirmed } from '@/lib/merchant-orders/notify'
import { downPaymentExternalRef, isDownPaymentRef } from '@/lib/merchant-orders/rules'
import { confirmDownPayment, getOrder, OrderError } from '@/lib/merchant-orders/service'
import { and, eq } from 'drizzle-orm'

const QR_TTL_MS = 24 * 60 * 60 * 1000

function payableOrThrow(o: Awaited<ReturnType<typeof getOrder>>, customerUserId: string) {
  if (!o || o.customerUserId !== customerUserId) throw new OrderError('Operación no encontrada.')
  if (o.cancelledAt || o.loanStatus === 'rejected' || o.loanStatus === 'cancelled') throw new OrderError('La operación está cerrada.')
  if (o.loanStatus !== 'approved') throw new OrderError('Podés pagar el anticipo cuando la mesa apruebe la operación.')
  if (o.downPaymentStatus === 'confirmed') throw new OrderError('El anticipo ya está acreditado.')
  return o
}

/** QR de Mercado Pago por el importe exacto del anticipo. Reutiliza el vigente si quedan más de 30 minutos. */
export async function downPaymentQr(orderId: string, customerUserId: string) {
  const o = payableOrThrow(await getOrder(orderId), customerUserId)
  if (o.mpQrData && o.mpQrExpiresAt && new Date(o.mpQrExpiresAt).getTime() - Date.now() > 30 * 60 * 1000) {
    return { qrData: o.mpQrData, expiresAt: new Date(o.mpQrExpiresAt) }
  }
  const externalReference = downPaymentExternalRef(o.id)
  const created = await createMercadoPagoQrOrder({
    amount: Number(o.downPaymentAmount),
    title: `Anticipo ${o.code} · ${o.merchantName}`.slice(0, 150),
    description: `Anticipo 30% compra ${o.code} en ${o.merchantName}`,
    externalReference,
    expiresAt: new Date(Date.now() + QR_TTL_MS),
    idempotencyKey: `${o.id}-${externalReference}`,
  })
  await db
    .update(merchantOrder)
    .set({
      mpOrderId: created.orderId,
      mpExternalRef: externalReference,
      mpQrData: created.qrData,
      mpQrExpiresAt: created.expiresAt,
      downPaymentMethod: 'mp_qr',
      updatedAt: new Date(),
    })
    .where(eq(merchantOrder.id, o.id))
  return { qrData: created.qrData, expiresAt: created.expiresAt }
}

/** El cliente informa la transferencia con su comprobante: queda para que tesorería la acredite. */
export async function reportDownPaymentTransfer(input: {
  orderId: string
  customerUserId: string
  reference: string
  proofDataUrl: string
}) {
  payableOrThrow(await getOrder(input.orderId), input.customerUserId)
  const reference = input.reference.trim().slice(0, 80)
  if (reference.length < 4) throw new OrderError('Cargá el número de operación de la transferencia.')
  await db
    .update(merchantOrder)
    .set({
      downPaymentStatus: 'reported',
      downPaymentMethod: 'transferencia',
      downPaymentReference: reference,
      downPaymentProof: input.proofDataUrl,
      downPaymentReportedAt: new Date(),
      downPaymentNote: null,
      updatedAt: new Date(),
    })
    .where(and(eq(merchantOrder.id, input.orderId), eq(merchantOrder.customerUserId, input.customerUserId)))
}

/**
 * Webhook de Mercado Pago: si la referencia es de un anticipo, acredita la operación. Verifica el pago
 * contra la API (estado aprobado e importe), no confía en el cuerpo del aviso.
 */
export async function settleDownPaymentFromMp(input: { externalReference?: string | null; orderId?: string | null; mpPaymentIds?: string[] }) {
  let ref = input.externalReference ?? null
  let paymentIds = input.mpPaymentIds ?? []
  if (input.orderId && (!ref || !paymentIds.length)) {
    const order = await getMercadoPagoQrOrder(input.orderId)
    ref = ref ?? (order?.external_reference ? String(order.external_reference) : null)
    if (!paymentIds.length) paymentIds = paymentIdsFromQrOrder(order).filter((id) => !id.startsWith('ORD'))
  }
  if (!isDownPaymentRef(ref)) return { matched: false as const }
  const [row] = await db.select({ id: merchantOrder.id }).from(merchantOrder).where(eq(merchantOrder.mpExternalRef, ref!)).limit(1)
  if (!row) return { matched: false as const }
  for (const id of paymentIds) {
    const p = (await getPaymentMP(id)) as Record<string, unknown> | null
    if (!p || String(p.status) !== 'approved') continue
    if (p.external_reference && String(p.external_reference) !== ref) continue
    const res = await confirmDownPayment({
      orderId: row.id,
      by: 'mercadopago',
      method: 'mp_qr',
      reference: `MP ${id}`,
      mpPaymentId: String(id),
      paidAmount: Number(p.transaction_amount ?? 0),
    })
    if (res.refundNeeded) {
      await recordAudit({
        actorUserId: '',
        action: 'DOWN_PAYMENT_REFUND_PENDING',
        entityType: 'merchant_order',
        entityId: row.id,
        targetUserId: res.order.customerUserId,
        severity: 'warning',
        summary: `Pago ${id} de $ ${res.order.downPaymentAmount} recibido con la operación anulada: queda para devolver`,
      })
      touchDesk()
    }
    if (res.changed) {
      await recordAudit({
        actorUserId: '',
        action: 'DOWN_PAYMENT_CONFIRMED',
        entityType: 'merchant_order',
        entityId: row.id,
        targetUserId: res.order.customerUserId,
        summary: `Anticipo $ ${res.order.downPaymentAmount} acreditado por Mercado Pago (pago ${id})`,
      })
      await notifyDownPaymentConfirmed(row.id)
      touchDesk()
    }
    return { matched: true as const, credited: res.changed, orderId: row.id }
  }
  return { matched: true as const, credited: false, orderId: row.id }
}

/** Para el webhook de pagos sueltos: averigua si el pago es de un anticipo y lo acredita. */
export async function settleDownPaymentByMpPayment(mpPaymentId: string) {
  const p = (await getPaymentMP(mpPaymentId)) as Record<string, unknown> | null
  const ref = p?.external_reference ? String(p.external_reference) : null
  if (!isDownPaymentRef(ref)) return { matched: false as const }
  return settleDownPaymentFromMp({ externalReference: ref, mpPaymentIds: [mpPaymentId] })
}
