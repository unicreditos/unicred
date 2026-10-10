import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { installment, loan, payment } from '@/lib/db/schema'
import { createPaymentLinkMP, MP_CONFIG } from '@/lib/mercadopago'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'

export type CouponCheckoutResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'paid'; number: number }
  | { kind: 'unavailable'; reason: string }

const SOURCE = 'coupon_qr'
const LINK_HOURS = 72

function gatewayRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function onlyThisInstallment(gatewayResponse: unknown, installmentId: string) {
  const ids = gatewayRecord(gatewayResponse).installment_ids
  return Array.isArray(ids) && ids.length === 1 && String(ids[0]) === installmentId
}

/**
 * QR impreso en el talón: el enlace es permanente, pero el cobro se arma al escanearlo.
 * Si la cuota ya está paga no abre Mercado Pago (evita el pago doble de una cuponera vieja).
 * El checkout no lleva datos del titular porque cualquiera con el talón puede pagarlo.
 */
export async function openCouponCheckout(installmentId: string): Promise<CouponCheckoutResult> {
  const [row] = await db
    .select({
      id: installment.id,
      loanId: installment.loanId,
      number: installment.number,
      amount: installment.amount,
      status: installment.status,
      loanStatus: loan.status,
      userId: loan.userId,
    })
    .from(installment)
    .innerJoin(loan, eq(loan.id, installment.loanId))
    .where(eq(installment.id, installmentId))
    .limit(1)

  if (!row) return { kind: 'unavailable', reason: 'No encontramos esta cuota.' }
  if (row.status === 'paid') return { kind: 'paid', number: row.number }
  if (row.status === 'cancelled' || row.loanStatus !== 'active') {
    return { kind: 'unavailable', reason: 'Esta cuota no admite pagos. Comunicate con UNICRÉDITOS.' }
  }
  const amount = Number(row.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { kind: 'unavailable', reason: 'Importe de cuota inválido.' }
  if (!MP_CONFIG.accessTokenSet) return { kind: 'unavailable', reason: 'Mercado Pago no está disponible en este momento.' }

  const candidates = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.loanId, row.loanId),
        eq(payment.source, SOURCE),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date(Date.now() + 60 * 60 * 1000)),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(20)
  const reusable = candidates.find(
    (p) => p.paymentLinkUrl && Number(p.amount) === amount && onlyThisInstallment(p.gatewayResponse, installmentId),
  )
  if (reusable?.paymentLinkUrl) return { kind: 'redirect', url: reusable.paymentLinkUrl }

  const externalReference = `CQR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6)}`
  const link = await createPaymentLinkMP({
    amount,
    installmentsIds: [installmentId],
    loanId: row.loanId,
    userId: row.userId,
    externalReference,
    description: `Pago cuota ${row.number} · Préstamo ${row.loanId.slice(0, 8)}`,
    itemsTitle: `UNICRÉDITOS · Cuota #${row.number}`,
    channel: 'all',
  })
  if (!link.initPoint || !/^https?:\/\//i.test(link.initPoint)) {
    return { kind: 'unavailable', reason: 'Mercado Pago no devolvió un link de pago válido.' }
  }

  await db.insert(payment).values({
    id: randomUUID(),
    userId: row.userId,
    loanId: row.loanId,
    installmentId,
    amount: String(amount),
    currency: 'ARS',
    status: 'pending',
    method: 'mercado_pago',
    source: SOURCE,
    gateway: 'mercado_pago',
    gatewayResponse: {
      kind: 'coupon_checkout',
      preference_id: link.preferenceId,
      init_point: link.initPoint,
      sandbox_init_point: link.sandboxInitPoint,
      external_reference: link.externalReference,
      channel: 'all',
      installment_ids: [installmentId],
    },
    externalId: link.preferenceId,
    paymentLinkId: link.preferenceId,
    paymentLinkUrl: link.initPoint,
    referenceNumber: link.externalReference,
    expiresAt: new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as typeof payment.$inferInsert)

  return { kind: 'redirect', url: link.initPoint }
}
