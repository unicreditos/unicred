import { db } from '@/lib/db'
import { ensureRateLimitTable } from '@/lib/db/ensure-rate-limit'
import { consumeRateLimitWith } from '@/lib/rate-limit-store'

/**
 * Backed por Postgres: en serverless (Vercel) cada instancia/cold start tiene
 * su propia memoria, asi que un contador en proceso no limita nada bajo
 * carga real. El UPSERT es atomico (una sola sentencia, resuelto por la
 * constraint de la fila), asi que dos requests concurrentes con la misma key
 * no se pisan.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  await ensureRateLimitTable()
  return consumeRateLimitWith(db, key, limit, windowMs)
}