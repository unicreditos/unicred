import { eq } from 'drizzle-orm'
import { issueAdminOtp, verifyAdminOtp } from '@/lib/admin-otp'
import { adminJson, requestMeta } from '@/lib/admin-api'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { getSession } from '@/lib/session'

const MESSAGE = {
  none: 'No hay un código vigente. Pedí uno nuevo.',
  expired: 'El código venció. Pedí uno nuevo.',
  locked: 'Demasiados intentos. Pedí un código nuevo.',
  invalid: 'Código incorrecto.',
} as const

/** Usuario de la sesión actual (sin exigir el segundo factor: es el paso que lo concede). */
async function sessionUser() {
  const s = await getSession()
  if (!s?.user?.id || !s.session?.id) return null
  const [u] = await db.select({ email: user.email, banned: user.banned }).from(user).where(eq(user.id, s.user.id)).limit(1)
  if (!u || u.banned) return null
  return { userId: s.user.id, sessionId: s.session.id, email: u.email }
}

export async function handleSendCode(req: Request, resolveUserId?: () => Promise<string>) {
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (resolveUserId) {
    try {
      if ((await resolveUserId()) !== who.userId) return adminJson({ ok: false, message: 'No autorizado' }, 403)
    } catch (err) {
      return adminJson({ ok: false, message: (err as Error).message }, 403)
    }
  }
  try {
    const { ip } = requestMeta(req)
    const { expiresAt } = await issueAdminOtp({ userId: who.userId, email: who.email, ip })
    return adminJson({ ok: true, expiresAt: expiresAt.toISOString() })
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, 400)
  }
}

export async function handleVerifyCode(req: Request, resolveUserId?: () => Promise<string>) {
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (resolveUserId) {
    try {
      if ((await resolveUserId()) !== who.userId) return adminJson({ ok: false, message: 'No autorizado' }, 403)
    } catch (err) {
      return adminJson({ ok: false, message: (err as Error).message }, 403)
    }
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown }
  const { ip } = requestMeta(req)
  const res = await verifyAdminOtp({ userId: who.userId, code: String(body.code ?? ''), ip, sessionId: who.sessionId })
  if (!res.ok) return adminJson({ ok: false, reason: res.reason, message: MESSAGE[res.reason] }, 400)
  return adminJson({ ok: true })
}