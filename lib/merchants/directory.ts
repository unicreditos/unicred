import { db } from '@/lib/db'
import { merchant } from '@/lib/db/schema'
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm'

export type PublicMerchant = {
  id: string
  businessName: string
  category: string | null
  province: string | null
  city: string | null
}

/** Directorio público: solo comercios activos (sin CUIT ni datos sensibles). */
export async function listPublicMerchants(opts?: {
  q?: string
  limit?: number
}): Promise<PublicMerchant[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 48, 1), 100)
  const q = opts?.q?.trim()

  const where = q
    ? and(
        eq(merchant.status, 'active'),
        or(
          ilike(merchant.businessName, `%${q}%`),
          ilike(merchant.category, `%${q}%`),
          ilike(merchant.city, `%${q}%`),
          ilike(merchant.province, `%${q}%`),
        ),
      )
    : eq(merchant.status, 'active')

  const rows = await db
    .select({
      id: merchant.id,
      businessName: merchant.businessName,
      category: merchant.category,
      province: merchant.province,
      city: merchant.city,
    })
    .from(merchant)
    .where(where)
    .orderBy(asc(merchant.businessName))
    .limit(limit)

  return rows
}

export async function countActiveMerchants() {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(merchant)
    .where(eq(merchant.status, 'active'))
  return Number(row?.n ?? 0)
}

export async function getPublicMerchant(id: string) {
  const [row] = await db
    .select({
      id: merchant.id,
      businessName: merchant.businessName,
      category: merchant.category,
      province: merchant.province,
      city: merchant.city,
      address: merchant.address,
    })
    .from(merchant)
    .where(and(eq(merchant.id, id), eq(merchant.status, 'active')))
    .limit(1)
  return row ?? null
}
