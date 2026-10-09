import { auth } from '@/lib/auth'
import { db, isPlaceholderDbUrl } from '@/lib/db'
import { profile, user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { consumeRateLimit } from '@/lib/rate-limit'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { secondFactorRequiredFor, type FactorRole } from '@/lib/second-factor-core'
import { sessionPassedSecondFactor } from '@/lib/second-factor'

export type Role = 'customer' | 'merchant' | 'admin'

const DASHBOARD_BY_ROLE: Record<Role, string> = {
  customer: '/dashboard',
  merchant: '/merchant',
  admin: '/admin',
}

export function getDashboardUrlByRole(role: Role | null | undefined): string {
  if (role && DASHBOARD_BY_ROLE[role]) return DASHBOARD_BY_ROLE[role]
  return '/dashboard'
}

export async function syncUserRole(userId: string, role: Role) {
  if (isPlaceholderDbUrl(process.env.DATABASE_URL)) return
  await db.update(userTable).set({ role, updatedAt: new Date() }).where(eq(userTable.id, userId)).catch(() => {})
  await db.update(profile).set({ role, updatedAt: new Date() }).where(eq(profile.userId, userId)).catch(() => {})
}

/**
 * Memoizado con React cache(): dentro de una misma navegación se llama muchas
 * veces para el mismo userId (una vez por cada requirePermission() de las
 * ~7 queries que se piden siempre en /admin), y sin esto cada una repetía
 * las 2 consultas desde cero.
 */
export const getRoleForUser = cache(async (userId: string): Promise<Role> => {
  if (isPlaceholderDbUrl(process.env.DATABASE_URL)) {
    return 'customer'
  }
  try {
    // Antes eran 2 round-trips secuenciales — no dependen una de la otra, así
    // que corren en paralelo. En una base remota cada round-trip pesa, y esta
    // función se llama en casi cualquier acción autenticada.
    const [rows, [u]] = await Promise.all([
      db.select({ role: profile.role }).from(profile).where(eq(profile.userId, userId)).limit(1),
      db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1),
    ])
    const fromProfile = rows[0]?.role as Role | undefined
    const fromUser = (u?.role as Role | undefined) || undefined
    const role = fromProfile || fromUser || 'customer'

    if (fromProfile && fromUser !== fromProfile) {
      await db
        .update(userTable)
        .set({ role: fromProfile, updatedAt: new Date() })
        .where(eq(userTable.id, userId))
        .catch(() => {})
    }

    return role
  } catch (err) {
    const msg = (err as Error)?.message || ''
    if (!msg.includes('ENOTFOUND') && !msg.includes('ECONNREFUSED')) {
      console.warn('[session] getRoleForUser failed (db offline?):', msg)
    }
    return 'customer'
  }
})

export async function getDashboardUrlForUser(userId: string): Promise<string> {
  const role = await getRoleForUser(userId)
  return getDashboardUrlByRole(role)
}

let _sessionOverride: any = null
const ALLOW_SESSION_OVERRIDE =
  process.env.NODE_ENV === 'test' ||
  (process.env.NODE_ENV !== 'production' && process.env.ALLOW_SESSION_OVERRIDE === 'true')

export function _setSessionOverride(session: any) {
  if (!ALLOW_SESSION_OVERRIDE) {
    throw new Error('_setSessionOverride solo está permitido en entorno test')
  }
  _sessionOverride = session
}
export function _clearSessionOverride() {
  if (!ALLOW_SESSION_OVERRIDE) return
  _sessionOverride = null
}

function isAuthSessionCookieName(name: string) {
  return name.includes('session_token') || name.includes('better-auth.session')
}

export const getSession = cache(async () => {
  if (_sessionOverride && ALLOW_SESSION_OVERRIDE) return _sessionOverride
  try {
    const jar = await cookies()
    const hasSessionCookie = jar.getAll().some((c) => isAuthSessionCookieName(c.name))
    if (!hasSessionCookie) {
      return null
    }
    if (isPlaceholderDbUrl(process.env.DATABASE_URL)) {
      return null
    }
    return await auth.api.getSession({ headers: await headers() })
  } catch (err) {
    const msg = (err as Error)?.message || ''
    if (!msg.includes('ENOTFOUND') && !msg.includes('ECONNREFUSED')) {
      console.warn('[session] getSession failed (db offline?):', msg)
    }
    return null
  }
})

/** Cookie huérfana: el proxy la trata como sesión y el panel no la valida. */
async function clearStaleAuthCookies() {
  try {
    const jar = await cookies()
    for (const cookie of jar.getAll()) {
      if (isAuthSessionCookieName(cookie.name)) jar.delete(cookie.name)
    }
  } catch {
    /* el redirect sigue igual si no se pudo borrar */
  }
}

const isBanned = cache(async (userId: string) => {
  const [u] = await db
    .select({ banned: userTable.banned })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  return !!u?.banned
})

export async function requireUserId() {
  const session = await getSession()
  if (!session?.user) {
    await clearStaleAuthCookies()
    redirect('/sign-in')
  }
  if (await isBanned(session.user.id)) {
    redirect('/sign-in?error=banned')
  }
  return session.user.id
}

/**
 * Las sesiones de administrador son más estrictas que las de un cliente:
 *  - Se valida contra la base en cada pedido, sin la caché de cookie de 5 minutos: un cierre de sesión
 *    o una baja se aplica al instante.
 *  - Vencen a las ADMIN_SESSION_MAX_HOURS horas (12 por defecto) de iniciadas, aunque se sigan usando.
 */
const ADMIN_SESSION_MAX_MS = Math.max(1, Number(process.env.ADMIN_SESSION_MAX_HOURS) || 12) * 3_600_000

async function adminSessionExpired(): Promise<boolean> {
  if (_sessionOverride && ALLOW_SESSION_OVERRIDE) return false
  try {
    const fresh = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })
    if (!fresh?.session) return true
    const started = new Date(fresh.session.createdAt as Date | string).getTime()
    return Number.isFinite(started) && Date.now() - started > ADMIN_SESSION_MAX_MS
  } catch {
    return true
  }
}

/** Intento de entrar a un área sin el rol: queda registrado (con tope, para no inundar el registro). */
async function auditDenied(userId: string, role: Role, area: string, kind: 'ACCESS_DENIED' | 'ACTION_DENIED') {
  try {
    const gate = await consumeRateLimit(`denied:${userId}:${area}`, 5, 15 * 60 * 1000)
    if (!gate.ok) return
    await recordAudit({
      actorUserId: userId,
      action: kind,
      entityType: area,
      severity: 'warning',
      summary: `${kind === 'ACCESS_DENIED' ? 'Intento de ingreso' : 'Intento de acción'} en ${area} con rol "${role}"`,
      changes: { role },
    })
  } catch {
    /* la denegación igual se aplica */
  }
}

/** Segundo factor por correo ligado a ESTA sesion (se enciende con ADMIN_2FA_LOGIN / CUSTOMER_2FA_LOGIN). */
async function secondFactorSatisfied(userId: string, role: FactorRole): Promise<boolean> {
  if (!secondFactorRequiredFor(role)) return true
  if (_sessionOverride && ALLOW_SESSION_OVERRIDE) return true
  const session = await getSession()
  return sessionPassedSecondFactor(userId, session?.session?.id)
}

export async function requireAdmin() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role !== 'admin') {
    await auditDenied(userId, role, 'backoffice', 'ACCESS_DENIED')
    redirect(getDashboardUrlByRole(role))
  }
  if (await adminSessionExpired()) {
    // Se revoca en la base: si solo se redirigiera, /sign-in vería una sesión válida y volvería acá (bucle).
    await auth.api.signOut({ headers: await headers() }).catch(() => {})
    redirect('/sign-in?error=session_expired')
  }
  if (!(await secondFactorSatisfied(userId, 'admin'))) redirect('/verificar-2fa?next=/admin')
  return userId
}

/** Para server actions y APIs: lanza error en vez de redirigir. */
export async function assertAdmin(opts: { skipSecondFactor?: boolean } = {}) {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role !== 'admin') {
    await auditDenied(userId, role, 'backoffice', 'ACTION_DENIED')
    throw new Error('No autorizado')
  }
  if (await adminSessionExpired()) throw new Error('No autorizado: la sesión venció, ingresá de nuevo.')
  if (!opts.skipSecondFactor && !(await secondFactorSatisfied(userId, 'admin'))) {
    throw new Error('No autorizado: falta la verificación en dos pasos.')
  }
  return userId
}

/** Panel de cliente. Admin y comercio no entran acá. */
export async function requireCustomer() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role === 'admin') redirect('/admin')
  if (role === 'merchant') redirect('/merchant')
  if (!(await secondFactorSatisfied(userId, 'customer'))) redirect('/verificar-2fa?next=/dashboard')
  return userId
}

/**
 * Panel de comercio. El admin queda en /admin.
 * Un cliente puede entrar solo para adherirse; el comercio habilitado opera acá.
 */
export async function requireMerchant() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role === 'admin') redirect('/admin')
  if (!(await secondFactorSatisfied(userId, 'merchant'))) redirect('/verificar-2fa?next=/merchant')
  return userId
}

/** Server actions: el rol debe ser uno de los permitidos. */
export async function assertRole(...allowed: Role[]) {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (!allowed.includes(role)) throw new Error('No autorizado')
  return userId
}

export async function getAccountHref(): Promise<{ isLoggedIn: boolean; accountHref: string; role: Role | null }> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { isLoggedIn: false, accountHref: '/sign-in', role: null }
  }
  const role = await getRoleForUser(session.user.id)
  return { isLoggedIn: true, accountHref: getDashboardUrlByRole(role), role }
}

/** Devuelve el perfil del usuario logueado, creándolo si no existe. */
export async function getOrCreateProfile() {
  const session = await getSession()
  if (!session?.user) return null

  const existing = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, session.user.id))
    .limit(1)

  if (existing.length) return existing[0]

  const [authUser] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1)
  const role = ((authUser?.role as Role) || 'customer') as Role

  const now = new Date()
  const [created] = await db
    .insert(profile)
    .values({
      id: `prof_${crypto.randomUUID()}`,
      userId: session.user.id,
      role,
      kycStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}
