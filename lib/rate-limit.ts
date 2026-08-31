import { db } from '@/lib/db'
import { ensureRateLimitTable } from '@/lib/db/ensure-rate-limit'
import { sql } from 'drizzle-orm'

/**
 * Backed por Postgres: en serverless (Vercel) cada instancia/cold start tiene
 * su propia memoria, así que un contador en proceso no limita nada bajo
 * carga real. El UPSERT es atómico (una sola sentencia, resuelto por la
 * constraint de la fila), así que dos requests concurrentes con la misma key
 * no se pisan.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  await ensureRateLimitTable()
  const resetAt = new Date(Date.now() + windowMs)
  const result = await db.execute<{ count: number; resetAt: string | Date }>(sql`
    INSERT INTO rate_limit_bucket (key, count, "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_bucket."resetAt" <= now() THEN 1 ELSE rate_limit_bucket.count + 1 END,
      "resetAt" = CASE WHEN rate_limit_bucket."resetAt" <= now() THEN ${resetAt} ELSE rate_limit_bucket."resetAt" END
    RETURNING count, "resetAt"
  `)
  const row = result.rows[0]
  if (!row) return { ok: true as const, remaining: limit - 1 }
  const count = Number(row.count)
  if (count > limit) {
    const retryInMs = new Date(row.resetAt).getTime() - Date.now()
    return { ok: false as const, remaining: 0, retryInMs: Math.max(0, retryInMs) }
  }
  return { ok: true as const, remaining: limit - count }
}
