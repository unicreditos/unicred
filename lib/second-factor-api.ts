import { eq } from 'drizzle-orm'
import { OtpError, issueAdminOtp, verifyAdminOtp } from '@/lib/admin-otp'
import { adminJson, authFailure, rejectCrossOrigin, requestMeta } from '@/lib/admin-api'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { getSession } from '@/lib/session'

const MESSAGE = {
  none: 'No hay un código vigente. Pedí uno nuevo.',
  expired: 'El código venció. Pedí uno nuevo.',
  locked: 'Demasiados intentos. Pedí un código nuevo.',
  invalid: 'Código incorrecto.',
  no_session: 'Tu sesión no es válida. Ingresá de nuevo.',
} as const

/** Usuario de la sesión actual (sin exigir el segundo factor: es el paso que lo concede). */
export async function sessionUser() {
  const s = await getSession()
  if (!s?.user?.id || !s.session?.id) return null
  const [u] = await db.select({ email: user.email, banned: user.banned }).from(user).where(eq(user.id, s.user.id)).limit(1)
  if (!u || u.banned) return null
  return { userId: s.user.id, sessionId: s.session.id, email: u.email }
}

export async function handleSendCode(req: Request, resolveUserId?: () => Promise<string>) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (resolveUserId) {
    try {
      if ((await resolveUserId()) !== who.userId) return adminJson({ ok: false, message: 'No autorizado' }, 403)
    } catch (err) {
      return authFailure(err)
    }
  }
  try {
    const { ip } = requestMeta(req)
    const { expiresAt, resendAfterSec } = await issueAdminOtp({ userId: who.userId, email: who.email, ip })
    return adminJson({ ok: true, expiresAt: expiresAt.toISOString(), resendAfterSec })
  } catch (err) {
    if (err instanceof OtpError) {
      const status = err.code === 'cooldown' || err.code === 'rate_limited' ? 429 : 503
      return adminJson({ ok: false, code: err.code, message: err.message, retryAfterSec: err.retryAfterSec ?? null }, status)
    }
    return adminJson({ ok: false, message: 'No pudimos enviar el código.' }, 503)
  }
}

export async function handleVerifyCode(req: Request, resolveUserId?: () => Promise<string>) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (resolveUserId) {
    try {
      if ((await resolveUserId()) !== who.userId) return adminJson({ ok: false, message: 'No autorizado' }, 403)
    } catch (err) {
      return authFailure(err)
    }
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown }
  const { ip } = requestMeta(req)
  const res = await verifyAdminOtp({ userId: who.userId, code: String(body.code ?? ''), ip, sessionId: who.sessionId })
  if (!res.ok) return adminJson({ ok: false, reason: res.reason, message: MESSAGE[res.reason] }, 400)
  return adminJson({ ok: true })
}