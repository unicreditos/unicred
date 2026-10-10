import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { MERCHANT_ADMIN_DDL } from '@/lib/merchant-admin-ddl'

let ensured = false

/** Crea (si faltan) las tablas del panel de comercios del backoffice. Idempotente y aditivo. */
export async function ensureMerchantAdminSchema() {
  if (ensured) return
  for (const stmt of MERCHANT_ADMIN_DDL) await db.execute(sql.raw(stmt))
  ensured = true
}
