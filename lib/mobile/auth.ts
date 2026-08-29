import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { account, profile, user as userTable } from '@/lib/db/schema'
import { getRoleForUser, newId } from '@/lib/session'
import { bearerFromRequest, signMobileToken, verifyMobileToken } from '@/lib/mobile/jwt'

export type MobileAuthUser = {
  id: string
  email: string
  name: string
  status: string
  role: string
}

function toAuthUser(row: {
  id: string
  email: string
  name: string
  banned?: boolean | null
  role?: string | null
}): MobileAuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.banned ? 'BANNED' : 'ACTIVE',
    role: row.role || 'customer',
  }
}

export async function mobileLogin(email: string, password: string) {
  const emailNorm = email.toLowerCase().trim()
  const [usr] = await db.select().from(userTable).where(eq(userTable.email, emailNorm)).limit(1)
  if (!usr) throw new Error('Credenciales inválidas')
  if (usr.banned) throw new Error('Cuenta suspendida')

  const [acc] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, usr.id), eq(account.providerId, 'credential')))
    .limit(1)
  if (!acc?.password) throw new Error('Credenciales inválidas')

  const ok = await verifyPassword({ hash: acc.password, password })
  if (!ok) throw new Error('Credenciales inválidas')

  const role = await getRoleForUser(usr.id)
  const token = signMobileToken({ userId: usr.id, email: usr.email })
  return { token, user: toAuthUser({ ...usr, role }) }
}

export async function mobileSignup(email: string, password: string, name: string) {
  const emailNorm = email.toLowerCase().trim()
  const display = name.trim() || emailNorm.split('@')[0]
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')

  const [existing] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, emailNorm)).limit(1)
  if (existing) throw new Error('El email ya está registrado')

  const now = new Date()
  const userId = newId('user')
  const hashed = await hashPassword(password)

  await db.insert(userTable).values({
    id: userId,
    email: emailNorm,
    name: display,
    emailVerified: false,
    role: 'customer',
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(account).values({
    id: newId('acc'),
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hashed,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(profile).values({
    id: newId('prof'),
    userId,
    role: 'customer',
    kycStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  })

  const token = signMobileToken({ userId, email: emailNorm })
  return {
    token,
    user: toAuthUser({ id: userId, email: emailNorm, name: display, role: 'customer' }),
  }
}

export async function mobileMe(userId: string) {
  const [usr] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  if (!usr) throw new Error('Usuario no encontrado')
  const role = await getRoleForUser(usr.id)
  return { user: toAuthUser({ ...usr, role }) }
}

export async function requireMobileUserId(req: Request): Promise<string> {
  const token = bearerFromRequest(req)
  if (!token) throw new Error('unauthorized')
  const payload = verifyMobileToken(token)
  if (!payload?.sub) throw new Error('unauthorized')

  const [usr] = await db
    .select({ id: userTable.id, banned: userTable.banned })
    .from(userTable)
    .where(eq(userTable.id, payload.sub))
    .limit(1)
  if (!usr || usr.banned) throw new Error('unauthorized')
  return usr.id
}
