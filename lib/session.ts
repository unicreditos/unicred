import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profile } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

export type Role = 'customer' | 'merchant' | 'admin'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireUserId() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
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

  const now = new Date()
  const [created] = await db
    .insert(profile)
    .values({
      id: `prof_${crypto.randomUUID()}`,
      userId: session.user.id,
      role: 'customer',
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
