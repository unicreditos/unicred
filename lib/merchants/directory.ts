import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import { merchant, merchantProduct } from '@/lib/db/schema'
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


/** Vidriera pública de un comercio activo: datos de contacto comerciales y catálogo a la venta. */
export async function getPublicStorefront(id: string) {
  const [m] = await db
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
  if (!m) return null
  await ensureMerchantCommerceSchema()
  const products = await db
    .select({
      id: merchantProduct.id,
      name: merchantProduct.name,
      description: merchantProduct.description,
      category: merchantProduct.category,
      price: merchantProduct.price,
      stock: merchantProduct.stock,
      image: merchantProduct.image,
    })
    .from(merchantProduct)
    .where(and(eq(merchantProduct.merchantId, id), eq(merchantProduct.active, true)))
    .orderBy(asc(merchantProduct.name))
  return { merchant: m, products: products.map((p) => ({ ...p, price: Number(p.price) })) }
}
