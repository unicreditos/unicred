import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

let ensured = false

/**
 * Índices que faltaban en columnas usadas por ORDER BY en las queries del
 * backoffice (getAllKYCReviews, getAllUsers, getPendingMerchants,
 * getAllDisbursements). Sin esto, cada tab-switch en /admin hacía un sort
 * completo de la tabla antes de aplicar el LIMIT. Alta one-shot vía SQL
 * directo: no hay carpeta de migraciones Drizzle en este repo.
 */
export async function ensurePerfIndexes() {
  if (ensured) return
  ensured = true
  await db.execute(sql`CREATE INDEX IF NOT EXISTS kyc_verification_updated_idx ON kyc_verification ("updatedAt" DESC)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS user_created_idx ON "user" ("createdAt" DESC)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS merchant_created_idx ON merchant ("createdAt" DESC)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS disbursement_created_idx ON disbursement ("createdAt" DESC)`)
}
