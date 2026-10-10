import { createHmac, timingSafeEqual } from 'node:crypto'
import { installmentPayPath } from '@/lib/coupon'
import { publicBrandWebsite } from '@/lib/brand'

/**
 * QR impreso en cada talón de la cuponera. Un QR de Mercado Pago vence a las 3 horas como máximo,
 * así que el papel lleva un enlace firmado a /pagar/<cuota>: al escanearlo se revisa que la cuota
 * siga impaga y recién ahí se abre el checkout de Mercado Pago con el importe exacto.
 * La firma evita que alguien arme el enlace de una cuota ajena solo conociendo el id.
 */

function couponSecret(env: Record<string, string | undefined> = process.env) {
  const secret = (env.BETTER_AUTH_SECRET || '').trim()
  return secret.length >= 16 ? secret : null
}

export function couponPayToken(installmentId: string, env?: Record<string, string | undefined>) {
  const secret = couponSecret(env)
  if (!secret) return null
  return createHmac('sha256', secret).update(`coupon-pay:${installmentId}`).digest('base64url').slice(0, 22)
}

export function verifyCouponPayToken(installmentId: string, token: string | null | undefined, env?: Record<string, string | undefined>) {
  const expected = couponPayToken(installmentId, env)
  const given = String(token ?? '')
  if (!expected || given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

export function couponPayUrl(installmentId: string, origin?: string, env?: Record<string, string | undefined>) {
  const token = couponPayToken(installmentId, env)
  if (!token) return null
  const base = (origin || publicBrandWebsite()).replace(/\/$/, '')
  return `${base}${installmentPayPath(installmentId)}?t=${token}`
}
