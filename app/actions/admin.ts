'use server'

import { getPrincipalesVariables } from '@/lib/bcra'
import { db } from '@/lib/db'
import { loan, merchant, profile } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const [p] = await db.select().from(profile).where(eq(profile.userId, session.user.id)).limit(1)
  if (!p || p.role !== 'admin') throw new Error('Forbidden')
  return session.user.id
}

export async function getAdminStats() {
  await requireAdmin()
  const [loans] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${loan.status} = 'active')::int`,
      pending: sql<number>`count(*) filter (where ${loan.status} = 'pending')::int`,
      rejected: sql<number>`count(*) filter (where ${loan.status} = 'rejected')::int`,
      volume: sql<number>`coalesce(sum(${loan.principal}) filter (where ${loan.status} in ('active','approved')), 0)`,
    })
    .from(loan)

  const [users] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(profile)

  const [merchants] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${merchant.status} = 'pending')::int`,
    })
    .from(merchant)

  return { loans, users, merchants }
}

export async function getAllLoans() {
  await requireAdmin()
  return db.select().from(loan).orderBy(desc(loan.createdAt)).limit(100)
}

export async function getPendingMerchants() {
  await requireAdmin()
  return db.select().from(merchant).orderBy(desc(merchant.createdAt))
}

export async function setMerchantStatus(id: string, status: 'active' | 'rejected') {
  await requireAdmin()
  await db.update(merchant).set({ status, updatedAt: new Date() }).where(eq(merchant.id, id))
  revalidatePath('/admin')
  return { ok: true }
}

export async function getBcraVariables() {
  await requireAdmin()
  const vars = await getPrincipalesVariables()
  return vars.slice(0, 24)
}
