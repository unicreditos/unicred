import { db } from '@/lib/db'
import { payment } from '@/lib/db/schema'
import { couponCode } from '@/lib/coupon'
import {
  createPaywayQrAttempt,
  isPaywayConfigured,
  isPaywayMethod,
  paywayAllowsSimulate,
} from '@/lib/payway'
import { getSiteBaseUrl } from '@/lib/mercadopago'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { sameInstallmentSet } from '@/lib/payments/settle-mp'

export type PaywayCheckoutResult = {
  ok: true
  paymentId: string
  paymentLinkUrl: string
  gateway: 'payway'
  externalPreferenceId: string
  publicKey: null
  amount: number
  qrData: string
  simulateAllowed: boolean
  coupon: string | null
  mpCustomerId: null
  mpCardIds: string[]
}

export async function openPaywayCheckout(input: {
  userId: string
  loanId: string
  installmentIds: string[]
  method: string
  amount: number
  source: 'web' | 'coupon'
  coupon?: { loanId: string; number: number; dueDate: Date | string; amount: string | number }
  firstInstallmentId: string
  firstDueDate?: Date | string | null
}) {
  if (!isPaywayMethod(input.method)) {
    throw new Error('Método Payway inválido.')
  }
  if (!isPaywayConfigured()) {
    throw new Error('Payway no está configurado en este entorno. Cargá las keys sandbox en .env.local.')
  }

  const existing = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, input.userId),
        eq(payment.loanId, input.loanId),
        eq(payment.gateway, 'payway'),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(12)

  const reusable = existing.find((row) => {
    if (row.method !== input.method) return false
    if (!row.paymentLinkUrl) return false
    return sameInstallmentSet(
      (row.gatewayResponse as { installment_ids?: unknown } | null)?.installment_ids,
      input.installmentIds,
    )
  })
  if (reusable) {
    const qrData =
      String((reusable.gatewayResponse as { qr_data?: string } | null)?.qr_data ?? reusable.paymentLinkUrl ?? '')
    return {
      ok: true as const,
      paymentId: reusable.id,
      paymentLinkUrl: reusable.paymentLinkUrl!,
      gateway: 'payway' as const,
      externalPreferenceId: reusable.paymentLinkId ?? reusable.id,
      publicKey: null,
      amount: input.amount,
      qrData,
      simulateAllowed: paywayAllowsSimulate(),
      coupon: input.coupon ? couponCode(input.coupon) : null,
      mpCustomerId: null,
      mpCardIds: [] as string[],
    } satisfies PaywayCheckoutResult
  }

  const id = crypto.randomUUID()
  const reference = `PW-${Date.now().toString().slice(-8)}`
  const site = getSiteBaseUrl().replace(/\/$/, '')
  const checkoutUrl = `${site}/pagar/${input.firstInstallmentId}?method=${encodeURIComponent(input.method)}&pay=${id}`
  let liveAttempt: unknown = null
  try {
    liveAttempt = await createPaywayQrAttempt({
      amount: input.amount,
      reference,
      description: `UNICRÉDITOS · ${input.installmentIds.length} cuota(s)`,
    })
  } catch (err) {
    liveAttempt = { error: err instanceof Error ? err.message : 'payway_live_omitido' }
  }

  await db.insert(payment).values({
    id,
    userId: input.userId,
    loanId: input.loanId,
    installmentId: input.firstInstallmentId,
    amount: String(input.amount),
    currency: 'ARS',
    status: 'pending',
    method: input.method,
    source: input.source,
    gateway: 'payway',
    gatewayResponse: {
      installment_ids: input.installmentIds,
      loanId: input.loanId,
      qr_data: checkoutUrl,
      sandbox: true,
      live_attempt: liveAttempt,
    },
    externalId: id,
    paymentLinkId: id,
    paymentLinkUrl: checkoutUrl,
    referenceNumber: reference,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)

  return {
    ok: true as const,
    paymentId: id,
    paymentLinkUrl: checkoutUrl,
    gateway: 'payway' as const,
    externalPreferenceId: id,
    publicKey: null,
    amount: input.amount,
    qrData: checkoutUrl,
    simulateAllowed: paywayAllowsSimulate(),
    coupon: input.coupon ? couponCode(input.coupon) : null,
    mpCustomerId: null,
    mpCardIds: [] as string[],
  } satisfies PaywayCheckoutResult
}
