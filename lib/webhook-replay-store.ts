import { sql } from 'drizzle-orm'
import type { SqlExecutor } from '@/lib/otp-pg-store'

/** Un reproceso que lleva mas de esto sin terminar se considera caido y otro operador puede retomarlo. */
export const REPLAY_CLAIM_STALE_MS = 2 * 60_000

/**
 * Toma el webhook para reprocesarlo, de forma ATOMICA: solo uno gana aunque dos operadores hagan clic a la vez.
 * Usa processedAt como marca de "en curso" mientras processed siga en false.
 */
export async function claimWebhookReplay(db: SqlExecutor, id: string, now: Date = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - REPLAY_CLAIM_STALE_MS).toISOString()
  const r = await db.execute(sql`
    UPDATE didit_webhook_log SET "processedAt" = ${now.toISOString()}
     WHERE id = ${id} AND processed = false AND ("processedAt" IS NULL OR "processedAt" < ${staleBefore})
 RETURNING id`)
  return r.rows.length > 0
}

/** Si el reproceso fallo, se libera la marca para poder reintentar. */
export async function releaseWebhookReplay(db: SqlExecutor, id: string): Promise<void> {
  await db.execute(sql`UPDATE didit_webhook_log SET "processedAt" = NULL WHERE id = ${id} AND processed = false`)
}