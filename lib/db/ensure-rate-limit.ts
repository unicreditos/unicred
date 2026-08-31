import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

let ensured = false

/**
 * Alta one-shot: no hay carpeta de migraciones Drizzle en este repo.
 * Backing DB para consumeRateLimit — en serverless (Vercel) un Map en memoria
 * no sirve como límite real: cada instancia/cold start arranca en cero.
 */
export async function ensureRateLimitTable() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limit_bucket (
      key text PRIMARY KEY,
      count integer NOT NULL,
      "resetAt" timestamptz NOT NULL
    )
  `)
  ensured = true
}
