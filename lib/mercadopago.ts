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
  kind?: 'installment' | 'early_settlement'
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

export function mercadoPagoNotificationUrl(siteBase: string) {
  const raw = (process.env.MERCADO_PAGO_NOTIFICATION_URL ?? `${siteBase}/api/webhooks/mercadopago`).trim()
  try {
    const u = new URL(raw)
    if (u.hostname === 'unicreditos.com') u.hostname = 'www.unicreditos.com'
    if (u.protocol !== 'https:') return undefined
    return u.toString()
  } catch {
    return undefined
  }
}

const TICKET_EXCLUDED_TYPES = ['credit_card', 'debit_card', 'prepaid_card', 'atm', 'bank_transfer', 'digital_currency']
const CARD_EXCLUDED_TYPES = ['ticket', 'atm', 'bank_transfer', 'prepaid_card']

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
      excluded_payment_types: TICKET_EXCLUDED_TYPES.map((id) => ({ id })),
      excluded_payment_methods: [] as { id: string }[],
      installments: 1,
    }
  }
  if (channel === 'pago_facil') {
    return {
      excluded_payment_types: TICKET_EXCLUDED_TYPES.map((id) => ({ id })),
      excluded_payment_methods: [{ id: 'rapipago' }],
      installments: 1,
    }
  }
  if (channel === 'rapipago') {
    return {
      excluded_payment_types: TICKET_EXCLUDED_TYPES.map((id) => ({ id })),
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
    excluded_payment_types: ['credit_card', 'debit_card', 'prepaid_card', 'ticket', 'atm'].map((id) => ({ id })),
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
    const notification_url = mercadoPagoNotificationUrl(siteBase)

    const channel = params.channel ?? 'all'
    const payment_methods = paymentMethodsForChannel(channel)
    const allowsPendingTicket = channel === 'all' || channel === 'ticket' || channel === 'pago_facil' || channel === 'rapipago'

    const body: any = {
      items,
      external_reference: externalReference,
      back_urls,
      statement_descriptor: params.kind === 'early_settlement' ? 'UNICRED CANCELAC' : 'UNICRED PAGO CUOTA',
      payment_methods,
      metadata: {
        loan_id: params.loanId ?? null,
        user_id: params.userId,
        installment_ids: params.installmentsIds ?? [],
        platform: 'unicred-nextjs',
        channel,
        kind: params.kind ?? 'installment',
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    }
    if (notification_url) {
      body.notification_url = notification_url
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
    const useSandbox = accessToken.startsWith('TEST-')
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

export async function cancelMercadoPagoPayment(mpPaymentId: string) {
  const id = String(mpPaymentId ?? '').replace(/\D/g, '')
  if (!id) return { ok: false as const, reason: 'sin_id' }
  const res = await mpApiFetch<Record<string, unknown>>(`/v1/payments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  })
  const status = String((res.data as { status?: string } | null)?.status ?? '')
  if (res.ok && (status === 'cancelled' || status === 'rejected')) {
    return { ok: true as const, status }
  }
  const current = await getPaymentMP(id)
  const currentStatus = String((current as { status?: string } | null)?.status ?? '')
  if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
    return { ok: true as const, status: currentStatus }
  }
  if (currentStatus === 'approved') {
    return { ok: false as const, reason: 'already_paid', status: currentStatus }
  }
  return { ok: false as const, reason: status || `http_${res.status}`, status: currentStatus || null }
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

export type MpOfflineTicketNetwork = 'pagofacil' | 'rapipago'

export type MpOfflineTicketResult = {
  paymentId: string
  barcode: string | null
  operationNumber: string | null
  ticketUrl: string | null
  status: string
  expiresAt: string | null
}

function firstTicketString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

export function extractMpTicketFields(data: unknown): MpOfflineTicketResult | null {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const td =
    rec.transaction_details && typeof rec.transaction_details === 'object'
      ? (rec.transaction_details as Record<string, unknown>)
      : {}
  const poi =
    rec.point_of_interaction && typeof rec.point_of_interaction === 'object'
      ? (rec.point_of_interaction as Record<string, unknown>)
      : {}
  const poiTx =
    poi.transaction_data && typeof poi.transaction_data === 'object'
      ? (poi.transaction_data as Record<string, unknown>)
      : {}
  const barcodeObj = rec.barcode && typeof rec.barcode === 'object' ? (rec.barcode as Record<string, unknown>) : {}
  const tdBarcode = td.barcode && typeof td.barcode === 'object' ? (td.barcode as Record<string, unknown>) : {}
  const id = rec.id != null ? String(rec.id) : null
  if (!id) return null
  const barcode = firstTicketString(
    barcodeObj.content,
    tdBarcode.content,
    rec.barcode_content,
    poiTx.barcode_content,
    poiTx.barcode,
  )
  const operationNumber = firstTicketString(
    td.payment_method_reference_id,
    poiTx.payment_method_reference_id,
    rec.payment_method_reference_id,
    poiTx.reference,
  )
  const ticketUrl = firstTicketString(
    td.external_resource_url,
    poiTx.ticket_url,
    poiTx.external_resource_url,
    rec.ticket_url,
  )
  if (!barcode && !operationNumber && !ticketUrl) return null
  const cleanBarcode = barcode ? barcode.replace(/\s+/g, '') : null
  const cleanOperation = operationNumber ? operationNumber.replace(/\s+/g, '') : null
  return {
    paymentId: id,
    barcode: cleanBarcode,
    operationNumber: cleanOperation,
    ticketUrl,
    status: String(rec.status ?? ''),
    expiresAt: firstTicketString(rec.date_of_expiration),
  }
}

export async function createOfflineTicketPayment(input: {
  amount: number
  network: MpOfflineTicketNetwork
  description: string
  externalReference: string
  expiresAt: Date
  payerEmail: string
  payerFirstName?: string
  payerLastName?: string
  identificationType?: string
  identificationNumber?: string
  metadata?: Record<string, unknown>
  idempotencyKey: string
}): Promise<MpOfflineTicketResult> {
  const amount = Number(input.amount.toFixed(2))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Importe inválido para el cupón de red.')
  if (!input.payerEmail?.includes('@')) {
    throw new Error('Falta el email del titular para emitir Pago Fácil / Rapipago.')
  }

  const notification_url = mercadoPagoNotificationUrl(getSiteBaseUrl())
  const identificationNumber = input.identificationNumber?.replace(/\D/g, '') || undefined
  const body: Record<string, unknown> = {
    transaction_amount: amount,
    description: input.description,
    payment_method_id: input.network,
    date_of_expiration: input.expiresAt.toISOString(),
    external_reference: input.externalReference.slice(0, 64),
    binary_mode: false,
    payer: {
      email: input.payerEmail,
      first_name: input.payerFirstName || undefined,
      last_name: input.payerLastName || undefined,
      identification: identificationNumber
        ? {
            type: input.identificationType || (identificationNumber.length === 11 ? 'CUIT' : 'DNI'),
            number: identificationNumber,
          }
        : undefined,
    },
    metadata: input.metadata ?? {},
  }
  if (notification_url) body.notification_url = notification_url

  const created = await mpApiFetch('/v1/payments', {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey: input.idempotencyKey,
  })
  if (!created.ok) {
    const rec = created.data && typeof created.data === 'object' ? (created.data as Record<string, unknown>) : {}
    const cause = Array.isArray(rec.cause) ? rec.cause[0] : null
    const detail =
      (cause && typeof cause === 'object' && 'description' in cause
        ? String((cause as { description?: string }).description)
        : '') ||
      (typeof rec.message === 'string' ? rec.message : '') ||
      'Mercado Pago no emitió el cupón de Pago Fácil / Rapipago.'
    throw new Error(detail)
  }
  const ticket = extractMpTicketFields(created.data)
  if (!ticket) {
    throw new Error('Mercado Pago no devolvió el código de barras ni el ticket de la red.')
  }
  return ticket
}

export async function ensureMercadoPagoCustomer(email: string) {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed.includes('@')) return null
  try {
    const found = await mpApiFetch<{ results?: Array<{ id?: string; cards?: Array<{ id?: string }> }> }>(
      `/v1/customers/search?email=${encodeURIComponent(trimmed)}`,
    )
    const existing = found.ok ? found.data?.results?.find((row) => row.id) : null
    if (existing?.id) {
      const cards = await listMercadoPagoCustomerCards(existing.id)
      return { id: String(existing.id), cardIds: cards }
    }
    const created = await mpApiFetch<{ id?: string }>('/v1/customers', {
      method: 'POST',
      body: JSON.stringify({ email: trimmed }),
      idempotencyKey: `cust-${trimmed.slice(0, 48)}`,
    })
    if (!created.ok || !created.data?.id) return null
    return { id: String(created.data.id), cardIds: [] as string[] }
  } catch (err) {
    console.error('[mercadopago] customer:', err)
    return null
  }
}

export async function listMercadoPagoCustomerCards(customerId: string) {
  try {
    const res = await mpApiFetch<Array<{ id?: string }> | { data?: Array<{ id?: string }> }>(
      `/v1/customers/${encodeURIComponent(customerId)}/cards`,
    )
    if (!res.ok) return [] as string[]
    const rows = Array.isArray(res.data) ? res.data : res.data?.data
    return (rows ?? []).map((row) => String(row.id ?? '')).filter(Boolean)
  } catch {
    return [] as string[]
  }
}

export async function saveMercadoPagoCustomerCard(customerId: string, token: string) {
  try {
    const res = await mpApiFetch(`/v1/customers/${encodeURIComponent(customerId)}/cards`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function mpApiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string },
): Promise<{ ok: boolean; status: number; data: T; raw: string }> {
  if (!accessToken) throw new Error('Mercado Pago no está configurado.')
  const { idempotencyKey, headers: initHeaders, ...rest } = init ?? {}
  const headers = new Headers(initHeaders)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (rest.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (idempotencyKey) headers.set('X-Idempotency-Key', idempotencyKey)
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { ...rest, headers })
  const raw = await res.text()
  let data = null as T
  try {
    data = (raw ? JSON.parse(raw) : null) as T
  } catch {
    /* cuerpo no JSON */
  }
  return { ok: res.ok, status: res.status, data, raw }
}
