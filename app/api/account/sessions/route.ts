import { adminJson, rejectCrossOrigin, requestMeta, serverError } from '@/lib/admin-api'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { sessionUser } from '@/lib/second-factor-api'
import { sessionSecondFactorOk } from '@/lib/session'
import { listSessionsWith, revokeOtherSessionsWith, revokeSessionWith } from '@/lib/sessions-store'

export const dynamic = 'force-dynamic'

/** Sesiones activas de la propia cuenta (dispositivo, IP, ultima actividad; la actual marcada). */
export async function GET() {
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (!(await sessionSecondFactorOk(who.userId))) return adminJson({ ok: false, message: 'Falta la verificaci\u00f3n en dos pasos.' }, 403)
  try {
    return adminJson({ ok: true, sessions: await listSessionsWith(db, who.userId, who.sessionId) })
  } catch (err) {
    return serverError(err, 'sessions-list')
  }
}

/** Cierra una sesion ({ id }) o todas las demas ({ all: true }). Queda en la auditoria. */
export async function POST(req: Request) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  const who = await sessionUser()
  if (!who) return adminJson({ ok: false, message: 'No autorizado' }, 401)
  if (!(await sessionSecondFactorOk(who.userId))) return adminJson({ ok: false, message: 'Falta la verificaci\u00f3n en dos pasos.' }, 403)
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown }
  const { ip } = requestMeta(req)
  try {
    if (b.all === true) {
      const { count } = await revokeOtherSessionsWith(db, who.userId, who.sessionId)
      await recordAudit({ actorUserId: who.userId, action: 'SESSIONS_REVOKED_ALL', entityType: 'session', targetUserId: who.userId, severity: 'warning', summary: `Cerr\u00f3 ${count} sesi\u00f3n(es) en otros dispositivos`, changes: { count, ip } })
      return adminJson({ ok: true, count })
    }
    const id = typeof b.id === 'string' ? b.id.slice(0, 200) : ''
    if (!id) return adminJson({ ok: false, message: 'Falta la sesi\u00f3n a cerrar.' }, 400)
    const out = await revokeSessionWith(db, who.userId, id, who.sessionId)
    if (!out.ok) return adminJson({ ok: false, message: out.reason === 'current' ? 'Esta es tu sesi\u00f3n actual: us\u00e1 "Salir".' : 'No encontramos esa sesi\u00f3n.' }, out.reason === 'current' ? 400 : 404)
    await recordAudit({ actorUserId: who.userId, action: 'SESSION_REVOKED', entityType: 'session', entityId: id, targetUserId: who.userId, severity: 'warning', summary: 'Cerr\u00f3 una sesi\u00f3n en otro dispositivo', changes: { ip } })
    return adminJson({ ok: true })
  } catch (err) {
    return serverError(err, 'sessions-revoke')
  }
}