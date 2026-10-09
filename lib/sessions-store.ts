/** Sesiones activas del usuario (tabla `session` de better-auth) con cierre remoto. Ejecutor de SQL inyectado. */
import { sql } from 'drizzle-orm'
import type { SqlExecutor } from '@/lib/otp-pg-store'

export type SessionInfo = {
  id: string
  device: string
  ip: string | null
  createdAt: Date
  lastSeen: Date
  expiresAt: Date
  current: boolean
}

/** "Chrome en Windows" a partir del user agent; sin datos devuelve "Dispositivo desconocido". */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return 'Dispositivo desconocido'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'sistema desconocido'
  return `${browser} en ${os}`
}

export async function listSessionsWith(db: SqlExecutor, userId: string, currentId: string | null, now: Date = new Date()): Promise<SessionInfo[]> {
  // Nunca se selecciona el token de la sesion.
  const r = await db.execute(sql`SELECT id, "ipAddress", "userAgent", "createdAt", "updatedAt", "expiresAt" FROM session
    WHERE "userId" = ${userId} AND "expiresAt" > ${now.toISOString()} ORDER BY "updatedAt" DESC`)
  return (r.rows as Array<Record<string, unknown>>).map((s) => ({
    id: String(s.id),
    device: describeDevice(s.userAgent as string | null),
    ip: (s.ipAddress as string | null) ?? null,
    createdAt: new Date(s.createdAt as string),
    lastSeen: new Date(s.updatedAt as string),
    expiresAt: new Date(s.expiresAt as string),
    current: String(s.id) === currentId,
  }))
}

/** Cierra UNA sesion ajena de este usuario. Nunca la actual (para eso esta el cierre normal) ni la de otra persona. */
export async function revokeSessionWith(db: SqlExecutor, userId: string, sessionId: string, currentId: string | null) {
  if (sessionId === currentId) return { ok: false as const, reason: 'current' as const }
  const r = await db.execute(sql`DELETE FROM session WHERE id = ${sessionId} AND "userId" = ${userId} RETURNING id`)
  return r.rows.length ? { ok: true as const } : { ok: false as const, reason: 'not_found' as const }
}

/** Cierra todas las demas sesiones del usuario y devuelve cuantas. */
export async function revokeOtherSessionsWith(db: SqlExecutor, userId: string, currentId: string | null) {
  const r = currentId
    ? await db.execute(sql`DELETE FROM session WHERE "userId" = ${userId} AND id <> ${currentId} RETURNING id`)
    : await db.execute(sql`DELETE FROM session WHERE "userId" = ${userId} RETURNING id`)
  return { count: r.rows.length }
}