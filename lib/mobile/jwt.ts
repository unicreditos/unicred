import { createHmac, timingSafeEqual } from 'node:crypto'

function secret() {
  const s = process.env.MOBILE_JWT_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim()
  if (!s || s.length < 16) {
    throw new Error('Falta BETTER_AUTH_SECRET (o MOBILE_JWT_SECRET) para tokens mobile')
  }
  return s
}

function b64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export type MobileTokenPayload = {
  sub: string
  email: string
  iat: number
  exp: number
}

/** JWT HS256 propio para la app Expo (Bearer). Misma DB que Better Auth. */
export function signMobileToken(input: { userId: string; email: string }, expiresInSec = 60 * 60 * 24 * 14) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJson({
    sub: input.userId,
    email: input.email,
    iat: now,
    exp: now + expiresInSec,
  } satisfies MobileTokenPayload)
  const sig = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as MobileTokenPayload
    if (!payload?.sub || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function bearerFromRequest(req: Request): string | null {
  const raw = req.headers.get('authorization') ?? ''
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}
