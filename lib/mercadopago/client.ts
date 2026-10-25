import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Cliente mínimo de la API de Mercado Pago (sin SDK: solo `fetch`). Las credenciales se leen en el momento de usarse,
 * con los mismos nombres de variable que `unicred`, para poder probar con una configuración falsa. Si falta el token,
 * `mpConfigured()` es false y la pantalla del QR lo explica en vez de emitir un código que no cobra.
 */

export type MpConfig = { token: string; userId: string; baseUrl: string; webhookSecret: string }

export function mpConfig(): MpConfig {
  return {
    token: (process.env.MERCADO_PAGO_ACCESS_TOKEN ?? '').trim(),
    userId: (process.env.MERCADO_PAGO_USER_ID ?? '').trim(),
    baseUrl: (process.env.MERCADO_PAGO_BASE_URL ?? 'https://api.mercadopago.com').trim().replace(/\/$/, ''),
    webhookSecret: (process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? '').trim(),
  }
}

/** Lo mínimo para emitir QR: token y número de la cuenta cobradora. */
export function mpConfigured() {
  const c = mpConfig()
  return Boolean(c.token && /^\d+$/.test(c.userId))
}

/** Error de la API de Mercado Pago o de la conexión. `transient` = vale la pena reintentar (red, 5xx, 429). */
export class MpError extends Error {
  constructor(message: string, readonly status: number, readonly transient: boolean) {
    super(message)
    this.name = 'MpError'
  }
}

export type MpResponse<T> = { ok: boolean; status: number; data: T; raw: string }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>
let fetchImpl: FetchLike = (input, init) => fetch(input, init)

/** Solo para pruebas: reemplaza la red por una simulación. */
export function _setMpFetch(impl: FetchLike | null) {
  fetchImpl = impl ?? ((input, init) => fetch(input, init))
}

export async function mpFetch<T = Record<string, unknown>>(
  path: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown; idempotencyKey?: string },
): Promise<MpResponse<T>> {
  const cfg = mpConfig()
  if (!cfg.token) throw new MpError('Mercado Pago no está configurado en este entorno.', 0, false)
  const { idempotencyKey, body, headers: initHeaders, ...rest } = init ?? {}
  const headers = new Headers(initHeaders)
  headers.set('Authorization', `Bearer ${cfg.token}`)
  headers.set('Accept', 'application/json')
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (idempotencyKey) headers.set('X-Idempotency-Key', idempotencyKey)
  let res: Response
  try {
    res = await fetchImpl(`${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...rest,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    throw new MpError(`No pudimos comunicarnos con Mercado Pago (${err instanceof Error ? err.message : 'sin conexión'}).`, 0, true)
  }
  const raw = await res.text()
  let data = null as T
  try {
    data = (raw ? JSON.parse(raw) : null) as T
  } catch {
    /* cuerpo que no es JSON */
  }
  return { ok: res.ok, status: res.status, data, raw }
}

/** Mensaje legible a partir de la respuesta de error de Mercado Pago. */
export function mpErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const rec = data as Record<string, unknown>
  if (Array.isArray(rec.errors) && rec.errors[0] && typeof rec.errors[0] === 'object') {
    const first = rec.errors[0] as { message?: string; code?: string }
    if (first.message || first.code) return first.message || first.code || fallback
  }
  if (Array.isArray(rec.cause) && rec.cause[0] && typeof rec.cause[0] === 'object') {
    const first = rec.cause[0] as { description?: string; code?: string }
    if (first.description || first.code) return first.description || first.code || fallback
  }
  const msg = rec.message ?? rec.error
  return typeof msg === 'string' && msg.trim() ? msg : fallback
}

/** Convierte una respuesta no exitosa en un error con la bandera de reintento correcta. */
export function mpFail(res: MpResponse<unknown>, fallback: string): never {
  throw new MpError(mpErrorMessage(res.data, fallback), res.status, res.status >= 500 || res.status === 429)
}

/* ------------------------------ Webhook -------------------------------- */

/**
 * Firma de las notificaciones: `x-signature: ts=…,v1=…` con HMAC-SHA256 del texto
 * `id:<data.id en minúsculas>;request-id:<x-request-id>;ts:<ts>` usando el secreto de la aplicación.
 * Las órdenes llegan con un id alfanumérico (ORD…): Mercado Pago lo firma en minúsculas.
 */
export function verifyMpWebhookSignature(input: {
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  dataId: string | null | undefined
  secret?: string
  toleranceSeconds?: number
  nowSeconds?: number
}): boolean {
  const secret = input.secret ?? mpConfig().webhookSecret
  if (!secret || !input.xSignature || !input.dataId) return false
  const parts = new Map<string, string>()
  for (const part of input.xSignature.split(',')) {
    const i = part.indexOf('=')
    if (i > 0) parts.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  if (!ts || !v1) return false
  if (input.toleranceSeconds && input.toleranceSeconds > 0) {
    const now = input.nowSeconds ?? Date.now() / 1000
    if (!Number.isFinite(Number(ts)) || Math.abs(now - Number(ts)) > input.toleranceSeconds) return false
  }
  const manifest = `id:${String(input.dataId).toLowerCase()};request-id:${input.xRequestId ?? ''};ts:${ts}`
  const expected = Buffer.from(createHmac('sha256', secret).update(manifest).digest('hex'))
  const given = Buffer.from(v1)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
