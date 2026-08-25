import { db } from '@/lib/db'
import { installment, loan, payment } from '@/lib/db/schema'
import { installmentPayUrl } from '@/lib/coupon'
import {
  createMercadoPagoQrOrder,
  isMercadoPagoEmvQr,
  qrExpirationIso,
  qrExpiresAtFromIso,
} from '@/lib/mercadopago-qr'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'

const QR_GRACE_DAYS = 20

export type InstallmentQrPayload = {
  installmentId: string
  qrData: string
  orderId: string
  expiresAt: string
  amount: number
}

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
  const withGrace = new Date(due.getTime() + QR_GRACE_DAYS * 24 * 60 * 60 * 1000)
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

export async function ensureInstallmentMpQr(opts: {
  userId: string
  loanId: string
  installmentId: string
  number: number
  amount: number
  dueDate: Date | string
  source?: string
}): Promise<InstallmentQrPayload> {
  const existing = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, opts.userId),
        eq(payment.loanId, opts.loanId),
        eq(payment.gateway, 'mercado_pago'),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date(Date.now() + 30 * 60 * 1000)),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(20)

  const reusable = existing.find((row) => {
    const ids = gatewayRecord(row.gatewayResponse).installment_ids
    const same =
      Array.isArray(ids) && ids.length === 1 && String(ids[0]) === opts.installmentId
        ? true
        : row.installmentId === opts.installmentId
    return same && qrStillValid(row)
  })
  if (reusable) {
    return {
      installmentId: opts.installmentId,
      qrData: qrDataFromGateway(reusable.gatewayResponse)!,
      orderId: String(gatewayRecord(reusable.gatewayResponse).qr_order_id ?? reusable.paymentLinkId ?? ''),
      expiresAt: new Date(reusable.expiresAt as Date).toISOString(),
      amount: opts.amount,
    }
  }

  const attachTo = existing.find((row) => {
    const ids = gatewayRecord(row.gatewayResponse).installment_ids
    return (
      row.installmentId === opts.installmentId ||
      (Array.isArray(ids) && ids.length === 1 && String(ids[0]) === opts.installmentId)
    )
  })
  if (attachTo) {
    const attached = await attachMercadoPagoQr({
      paymentId: attachTo.id,
      amount: opts.amount,
      title: `UNICRÉDITOS · Cuota #${opts.number}`,
      description: `Pago cuota ${opts.number} · UNICRÉDITOS`,
      installmentIds: [opts.installmentId],
      dueDate: opts.dueDate,
    })
    return {
      installmentId: opts.installmentId,
      qrData: attached.qrData,
      orderId: attached.orderId,
      expiresAt: attached.expiresAt.toISOString(),
      amount: opts.amount,
    }
  }

  const id = crypto.randomUUID()
  const qr = await createMercadoPagoQrOrder({
    amount: opts.amount,
    title: `UNICRÉDITOS · Cuota #${opts.number}`,
    description: `Pago cuota ${opts.number} · UNICRÉDITOS`,
    externalReference: externalRefForQr(opts.installmentId),
    expiresAt: qrValidUntil(opts.dueDate),
    idempotencyKey: `qr-new-${id}`,
  })
  await db.insert(payment).values({
    id,
    userId: opts.userId,
    loanId: opts.loanId,
    installmentId: opts.installmentId,
    amount: String(opts.amount),
    currency: 'ARS',
    status: 'pending',
    method: 'mercado_pago',
    source: opts.source ?? 'coupon_qr',
    gateway: 'mercado_pago',
    gatewayResponse: {
      qr_data: qr.qrData,
      qr_order_id: qr.orderId,
      qr_expiration_time: qr.expirationTime,
      external_reference: qr.externalReference,
      installment_ids: [opts.installmentId],
      kind: 'coupon_qr',
    },
    paymentLinkId: qr.orderId,
    paymentLinkUrl: installmentPayUrl(opts.installmentId),
    referenceNumber: qr.externalReference,
    expiresAt: qr.expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)

  return {
    installmentId: opts.installmentId,
    qrData: qr.qrData,
    orderId: qr.orderId,
    expiresAt: qr.expiresAt.toISOString(),
    amount: opts.amount,
  }
}

export async function ensureLoanCouponMpQrs(loanId: string, ownerUserId: string) {
  const [loanRow] = await db
    .select({ id: loan.id, userId: loan.userId, status: loan.status })
    .from(loan)
    .where(eq(loan.id, loanId))
    .limit(1)
  if (!loanRow || loanRow.userId !== ownerUserId) {
    throw new Error('Crédito no encontrado.')
  }
  const rows = await db
    .select()
    .from(installment)
    .where(eq(installment.loanId, loanId))
  const open = rows.filter((row) => row.status !== 'paid' && row.status !== 'cancelled')
  const out: Record<string, InstallmentQrPayload> = {}
  for (const row of open) {
    out[row.id] = await ensureInstallmentMpQr({
      userId: ownerUserId,
      loanId,
      installmentId: row.id,
      number: row.number,
      amount: Number(row.amount) || 0,
      dueDate: row.dueDate,
      source: 'coupon_book',
    })
  }
  return out
}

export function qrExpirationLabel(isoDuration: string) {
  return qrExpiresAtFromIso(isoDuration).toISOString()
}

export { qrExpirationIso }
