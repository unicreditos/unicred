import { addDaysAR, endOfDayAR } from '@/lib/date-ar'
import { db } from '@/lib/db'
import { payment } from '@/lib/db/schema'
import {
  createMercadoPagoQrOrder,
  isMercadoPagoEmvQr,
  qrExpirationIso,
} from '@/lib/mercadopago-qr'
import { eq } from 'drizzle-orm'

const QR_GRACE_DAYS = 20

function gatewayRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function qrDataFromGateway(value: unknown) {
  const g = gatewayRecord(value)
  const candidate = g.qr_data ?? (g.type_response as { qr_data?: string } | undefined)?.qr_data
  return isMercadoPagoEmvQr(String(candidate ?? '')) ? String(candidate) : null
}

function qrStillValid(row: { expiresAt?: Date | string | null; gatewayResponse?: unknown }) {
  const data = qrDataFromGateway(row.gatewayResponse)
  if (!data) return false
  const exp = row.expiresAt ? new Date(row.expiresAt) : null
  if (!exp || Number.isNaN(exp.getTime())) return false
  return exp.getTime() - Date.now() > 30 * 60 * 1000
}

export function qrValidUntil(dueDate: Date | string) {
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)
  const withGrace = addDaysAR(endOfDayAR(due), QR_GRACE_DAYS)
  const min = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const max = new Date(Date.now() + 3600 * 60 * 60 * 1000)
  const target = withGrace > min ? withGrace : min
  return target > max ? max : target
}

function externalRefForQr(installmentId: string) {
  const compact = installmentId.replace(/[^A-Za-z0-9]/g, '').slice(0, 18)
  return `QR_${compact}_${Date.now().toString(36)}`.slice(0, 64)
}

export async function attachMercadoPagoQr(opts: {
  paymentId: string
  amount: number
  title: string
  description?: string
  installmentIds: string[]
  dueDate?: Date | string | null
}) {
  const [row] = await db.select().from(payment).where(eq(payment.id, opts.paymentId)).limit(1)
  if (!row) throw new Error('Pago local no encontrado para emitir el QR.')
  if (qrStillValid(row)) {
    return {
      qrData: qrDataFromGateway(row.gatewayResponse)!,
      orderId: String(gatewayRecord(row.gatewayResponse).qr_order_id ?? ''),
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : qrValidUntil(opts.dueDate ?? new Date()),
    }
  }

  const until = qrValidUntil(opts.dueDate ?? new Date())
  const existingRef = row.referenceNumber && /^[A-Za-z0-9_-]+$/.test(row.referenceNumber)
    ? row.referenceNumber.slice(0, 64)
    : externalRefForQr(opts.installmentIds[0] ?? row.id)
  const qr = await createMercadoPagoQrOrder({
    amount: opts.amount,
    title: opts.title,
    description: opts.description,
    externalReference: existingRef,
    expiresAt: until,
    idempotencyKey: `qr-${row.id}`,
  })
  const previous = gatewayRecord(row.gatewayResponse)
  const expiresAt = qr.expiresAt
  await db
    .update(payment)
    .set({
      referenceNumber: qr.externalReference,
      expiresAt,
      updatedAt: new Date(),
      gatewayResponse: {
        ...previous,
        qr_data: qr.qrData,
        qr_order_id: qr.orderId,
        qr_expiration_time: qr.expirationTime,
        installment_ids: opts.installmentIds,
      },
    } as any)
    .where(eq(payment.id, row.id))
  return { qrData: qr.qrData, orderId: qr.orderId, expiresAt }
}

export { qrExpirationIso }
