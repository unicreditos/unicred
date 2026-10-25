import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import QRCode from 'qrcode'
import { publicSiteUrl } from '@/lib/site'

/**
 * QR de cobro. El código es un token firmado (HMAC-SHA256 con BETTER_AUTH_SECRET) que lleva la billetera destino,
 * un importe opcional, un concepto y un vencimiento opcional. Al ir firmado nadie puede cambiar el destino ni el
 * importe de un QR ajeno. Un QR con importe fijo se puede cobrar más de una vez (como el de un comercio); cada pago
 * es un asiento propio.
 */

export type QrPayload = {
  /** id de la billetera destino */
  w: string
  /** importe en centavos; ausente = lo elige quien paga */
  a?: number
  /** concepto */
  c?: string
  /** vencimiento (epoch en segundos) */
  e?: number
  /** nonce, para que dos QR iguales no compartan token */
  n: string
}

const PREFIX = 'UCQ1'

function secret() {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('Falta BETTER_AUTH_SECRET.')
  return s
}

function b64url(buf: Buffer) {
  return buf.toString('base64url')
}

function sign(body: string) {
  return b64url(createHmac('sha256', secret()).update(`${PREFIX}.${body}`).digest())
}

export function createQrToken(input: { walletId: string; cents?: number; concept?: string; ttlMinutes?: number }) {
  const payload: QrPayload = { w: input.walletId, n: b64url(randomBytes(6)) }
  if (input.cents && input.cents > 0) payload.a = input.cents
  const concept = input.concept?.trim().slice(0, 60)
  if (concept) payload.c = concept
  if (input.ttlMinutes && input.ttlMinutes > 0) payload.e = Math.floor(Date.now() / 1000) + Math.round(input.ttlMinutes * 60)
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${PREFIX}.${body}.${sign(body)}`
}

export type QrVerification = { ok: true; payload: QrPayload } | { ok: false; reason: 'invalid' | 'expired' }

export function verifyQrToken(raw: string): QrVerification {
  const token = String(raw ?? '').trim()
  const [prefix, body, sig] = token.split('.')
  if (prefix !== PREFIX || !body || !sig) return { ok: false, reason: 'invalid' }
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'invalid' }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QrPayload
    if (typeof payload.w !== 'string' || typeof payload.n !== 'string') return { ok: false, reason: 'invalid' }
    if (payload.e && payload.e < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' }
    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

/** URL que codifica el QR: al escanearlo con la cámara del celular abre la app en la pantalla de pago. */
export function qrPayUrl(token: string) {
  return `${publicSiteUrl()}/dashboard/billetera/pagar?c=${encodeURIComponent(token)}`
}

/** ¿Es el texto de un QR interoperable (EMV, como los de Mercado Pago) y no un QR interno de UNICRÉDITOS? */
export function isEmvText(input: string): boolean {
  return String(input ?? '').trim().startsWith('000201')
}

/** El texto pegado puede ser el token solo o la URL completa del QR. */
export function extractQrToken(input: string): string {
  const text = String(input ?? '').trim()
  try {
    const u = new URL(text)
    return u.searchParams.get('c') ?? ''
  } catch {
    return text
  }
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', width: 280 })
}
