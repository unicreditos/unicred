import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { randomUUID, createHmac, timingSafeEqual } from 'crypto'
import { publicSiteUrl } from '@/lib/site'
import { BRAND } from '@/lib/brand'

export type MPPaymentChannel =
  | 'all'
  | 'ticket'
  | 'pago_facil'
  | 'rapipago'
  | 'credit_card'
  | 'debit_card'
  | 'account_money'
  | 'bank_transfer'

export type MPCreateLinkParams = {
  amount: number
  installmentsIds?: string[]
  loanId?: string
  userId: string
  description?: string
  externalReference?: string
  itemsTitle?: string
  successUrl?: string
  failureUrl?: string
  pendingUrl?: string
  payerEmail?: string
  payerFirstName?: string
  payerLastName?: string
  payerIdentificationType?: string
  payerIdentificationNumber?: string
  channel?: MPPaymentChannel
}

export type MPLinkResult = {
  ok: boolean
  preferenceId: string
  initPoint: string
  sandboxInitPoint?: string
  externalReference: string
}

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ''
const baseUrl = process.env.MERCADO_PAGO_BASE_URL ?? 'https://api.mercadopago.com'
const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? ''
const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY

if (!accessToken) {
  console.warn('[mercadopago] ⚠ MERCADO_PAGO_ACCESS_TOKEN no configurado — usando modo fallback interno')
}
if (!webhookSecret) {
  console.error('[mercadopago] ❌ MERCADO_PAGO_WEBHOOK_SECRET no configurado — webhook rechazará todas las solicitudes')
}

let client: MercadoPagoConfig | null = null
let preferenceClient: Preference | null = null
let paymentClient: Payment | null = null

function getClients() {
  if (!accessToken) return null
  if (!client) {
    client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15000 },
    })
    preferenceClient = new Preference(client)
    paymentClient = new Payment(client)
  }
  return { client, preferenceClient: preferenceClient!, paymentClient: paymentClient! }
}

export function getSiteBaseUrl(): string {
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SITE_URL) {
    return 'http://localhost:3000'
  }
  return publicSiteUrl()
}

function buildRedirectUrl(kind: 'success' | 'failure' | 'pending', custom?: string) {
  if (custom) return custom
  const base = process.env.MERCADO_PAGO_REDIRECT_URL?.replace(/\/$/, '') ?? getSiteBaseUrl()
  return `${base}/dashboard?tab=pagos&mp_status=${kind}`
}

const ALL_TICKET_TYPES = ['credit_card', 'debit_card', 'prepaid_card', 'atm', 'bank_transfer', 'account_money', 'digital_currency']
const CARD_EXCLUDED_TYPES = ['ticket', 'atm', 'bank_transfer', 'account_money', 'prepaid_card']

function paymentMethodsForChannel(channel: MPPaymentChannel = 'all') {
  if (channel === 'all') {
    return {
      excluded_payment_types: [] as { id: string }[],
      excluded_payment_methods: [] as { id: string }[],
      installments: 12,
    }
  }
  if (channel === 'ticket') {
    return {
      excluded_payment_types: ALL_TICKET_TYPES.map((id) => ({ id })),
      excluded_payment_methods: [] as { id: string }[],
      installments: 1,
    }
  }
  if (channel === 'pago_facil') {
    return {
      excluded_payment_types: ALL_TICKET_TYPES.map((id) => ({ id })),
      excluded_payment_methods: [{ id: 'rapipago' }],
      installments: 1,
    }
  }
  if (channel === 'rapipago') {
    return {
      excluded_payment_types: ALL_TICKET_TYPES.map((id) => ({ id })),
      excluded_payment_methods: [{ id: 'pagofacil' }],
      installments: 1,
    }
  }
  if (channel === 'credit_card') {
    return {
      excluded_payment_types: CARD_EXCLUDED_TYPES.filter((id) => id !== 'credit_card').concat(['debit_card']).map((id) => ({ id })),
      excluded_payment_methods: [] as { id: string }[],
      installments: 12,
    }
  }
  if (channel === 'debit_card') {
    return {
      excluded_payment_types: CARD_EXCLUDED_TYPES.concat(['credit_card']).map((id) => ({ id })),
      excluded_payment_methods: [] as { id: string }[],
      installments: 1,
    }
  }
  if (channel === 'account_money') {
    return {
      excluded_payment_types: ['credit_card', 'debit_card', 'prepaid_card', 'ticket', 'atm', 'bank_transfer'].map((id) => ({ id })),
      excluded_payment_methods: [] as { id: string }[],
      installments: 1,
    }
  }
  return {
    excluded_payment_types: ['credit_card', 'debit_card', 'prepaid_card', 'ticket', 'atm', 'account_money'].map((id) => ({ id })),
    excluded_payment_methods: [] as { id: string }[],
    installments: 1,
  }
}

export async function createPaymentLinkMP(params: MPCreateLinkParams): Promise<MPLinkResult> {
  const amount = Number(params.amount)
  if (!amount || isNaN(amount) || amount <= 0) throw new Error('Monto inválido')
  const externalReference = params.externalReference ?? `UNCRD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6)}`
  const description = params.description ?? params.itemsTitle ?? `Pago de cuota ${BRAND.company}`

  const c = getClients()
  if (!c) {
    throw new Error(
      `Mercado Pago no está configurado. Falta MERCADO_PAGO_ACCESS_TOKEN (token TEST de ${BRAND.company}).`,
    )
  }

  try {
    const itemsTitle = params.itemsTitle ?? `Pago cuota préstamo ${BRAND.company}`
    const siteBase = getSiteBaseUrl()
    const items = [
      {
        id: externalReference,
        title: itemsTitle,
        description,
        picture_url: `${siteBase}/logo.svg`,
        quantity: 1,
        unit_price: amount,
        currency_id: 'ARS',
      },
    ]

    const back_urls = {
      success: buildRedirectUrl('success', params.successUrl),
      failure: buildRedirectUrl('failure', params.failureUrl),
      pending: buildRedirectUrl('pending', params.pendingUrl),
    }

    // El webhook se autentica con la firma HMAC de Mercado Pago; el secreto no
    // viaja en la URL para que no quede registrado en logs ni en el panel de MP.
    const notification_url =
      process.env.MERCADO_PAGO_NOTIFICATION_URL ?? `${siteBase}/api/webhooks/mercadopago`

    const channel = params.channel ?? 'all'
    const payment_methods = paymentMethodsForChannel(channel)
    const allowsPendingTicket = channel === 'all' || channel === 'ticket' || channel === 'pago_facil' || channel === 'rapipago'

    const body: any = {
      items,
      external_reference: externalReference,
      notification_url,
      back_urls,
      statement_descriptor: 'UNICRED PAGO CUOTA',
      payment_methods,
      metadata: {
        loan_id: params.loanId ?? null,
        user_id: params.userId,
        installment_ids: params.installmentsIds ?? [],
        platform: 'unicred-nextjs',
        channel,
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    }
    // auto_return exige back_urls.success HTTPS (Mercado Pago lo rechaza con localhost http).
    if (String(back_urls.success).startsWith('https://')) {
      body.auto_return = 'approved'
    }
    // binary_mode:true rechaza tickets (Pago Fácil / Rapipago) porque quedan pending.
    body.binary_mode = !allowsPendingTicket

    if (params.payerEmail || params.payerFirstName || params.payerIdentificationNumber) {
      body.payer = {
        email: params.payerEmail ?? undefined,
        first_name: params.payerFirstName ?? undefined,
        last_name: params.payerLastName ?? undefined,
        identification: params.payerIdentificationNumber
          ? {
              type: params.payerIdentificationType ?? 'DNI',
              number: params.payerIdentificationNumber,
            }
          : undefined,
      }
    }

    const pref = await c.preferenceClient.create({ body })
    if (!pref?.id) {
      throw new Error('Mercado Pago no devolvió preference id')
    }
    const useSandbox = accessToken.startsWith('TEST-') || process.env.NODE_ENV === 'development'
    const initPoint =
      (useSandbox && pref.sandbox_init_point ? pref.sandbox_init_point : null) ??
      pref.init_point
    if (!initPoint) {
      throw new Error('Mercado Pago no devolvió init_point')
    }
    return {
      ok: true,
      preferenceId: pref.id,
      initPoint,
      sandboxInitPoint: pref.sandbox_init_point,
      externalReference,
    }
  } catch (err: any) {
    console.error('[mercadopago] createPreference error:', err?.message ?? err)
    throw new Error(
      err?.message?.includes('Mercado Pago')
        ? err.message
        : `No se pudo crear el link de Mercado Pago: ${err?.message ?? 'error desconocido'}`,
    )
  }
}

export async function createPaymentFromBrick(body: Record<string, unknown>) {
  const c = getClients()
  if (!c) throw new Error('Mercado Pago no está configurado.')
  return c.paymentClient.create({ body: body as any })
}

export async function getPaymentMP(id: string | number) {
  const c = getClients()
  if (!c) return null
  try {
    const p = await c.paymentClient.get({ id: String(id) })
    return p
  } catch (err: any) {
    console.error('[mercadopago] getPayment error:', err?.message ?? err)
    return null
  }
}

export function validateWebhookSecret(querySecret?: string) {
  if (!webhookSecret || !querySecret) return false
  try {
    const a = Buffer.from(querySecret)
    const b = Buffer.from(webhookSecret)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export type MPWebhookSignatureHeaders = {
  'x-signature'?: string
  'x-request-id'?: string
}

export function validateWebhookSignature(opts: {
  headers: MPWebhookSignatureHeaders
  queryDataId?: string | null
  body?: any
  toleranceSeconds?: number
}): boolean {
  if (!webhookSecret) return false
  const xSig = opts.headers['x-signature']
  // Sin firma HMAC no validamos con data.id (eso no es el secret).
  if (!xSig) return false

  const parts = new Map<string, string>()
  xSig.split(',').forEach((part) => {
    const [k, v] = part.split('=', 2)
    if (k && v !== undefined) parts.set(k.trim(), v)
  })
  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  if (!ts || !v1) return false
  const dataId = opts.queryDataId ?? (opts.body?.data?.id ?? opts.body?.id)
  const requestId = opts.headers['x-request-id'] ?? ''
  if (!dataId) return false

  if (opts.toleranceSeconds && opts.toleranceSeconds > 0) {
    const diff = Math.abs(Date.now() / 1000 - Number(ts))
    if (diff > opts.toleranceSeconds) return false
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`
  try {
    const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex')
    const a = Buffer.from(expected)
    const b = Buffer.from(v1)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const MP_CONFIG = {
  accessTokenSet: !!accessToken,
  isTestToken: accessToken.startsWith('TEST-'),
  baseUrl,
  webhookSecretSet: !!webhookSecret,
  publicKey:
    publicKey ||
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ||
    null,
}

export function getMercadoPagoPublicKey() {
  return MP_CONFIG.publicKey
}
