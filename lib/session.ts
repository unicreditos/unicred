import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profile, user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

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
  await db.update(userTable).set({ role, updatedAt: new Date() }).where(eq(userTable.id, userId))
  await db.update(profile).set({ role, updatedAt: new Date() }).where(eq(profile.userId, userId))
}

export async function getRoleForUser(userId: string): Promise<Role> {
  const rows = await db
    .select({ role: profile.role })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1)
  const fromProfile = rows[0]?.role as Role | undefined

  const [u] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  const fromUser = (u?.role as Role | undefined) || undefined
  const role = fromProfile || fromUser || 'customer'

  if (fromProfile && fromUser !== fromProfile) {
    await db.update(userTable).set({ role: fromProfile, updatedAt: new Date() }).where(eq(userTable.id, userId))
  }

  return role
}

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

export async function getSession() {
  if (_sessionOverride && ALLOW_SESSION_OVERRIDE) return _sessionOverride
  return auth.api.getSession({ headers: await headers() })
}

function isAuthSessionCookieName(name: string) {
  return name.includes('session_token') || name.includes('better-auth.session')
}

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

export async function requireUserId() {
  const session = await getSession()
  if (!session?.user) {
    await clearStaleAuthCookies()
    redirect('/sign-in')
  }
  const [u] = await db
    .select({ banned: userTable.banned })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1)
  if (u?.banned) {
    redirect('/sign-in?error=banned')
  }
  return session.user.id
}

export async function requireAdmin() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role !== 'admin') {
    redirect(getDashboardUrlByRole(role))
  }
  return userId
}

/** Para server actions y APIs: lanza error en vez de redirigir. */
export async function assertAdmin() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role !== 'admin') throw new Error('No autorizado')
  return userId
}

/** Panel de cliente. Admin y comercio no entran acá. */
export async function requireCustomer() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role === 'admin') redirect('/admin')
  if (role === 'merchant') redirect('/merchant')
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
