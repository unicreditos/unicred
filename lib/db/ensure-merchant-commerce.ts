import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { MERCHANT_COMMERCE_DDL } from '@/lib/merchant-commerce-ddl'

let ensured: Promise<void> | null = null

/** Crea (si faltan) las tablas de la venta financiada en comercios. Idempotente y aditivo. */
export function ensureMerchantCommerceSchema() {
  if (!ensured) {
    ensured = (async () => {
      for (const stmt of MERCHANT_COMMERCE_DDL) await db.execute(sql.raw(stmt))
    })().catch((err) => {
      ensured = null
      throw err
    })
  }
  return ensured
}
