import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { EXTRA_DDL } from '@/lib/db/ddl-extra'

let ensured: Promise<void> | null = null

/** Asegura (una vez por proceso) las tablas propias de esta app. Idempotente: solo CREATE ... IF NOT EXISTS. */
export function ensureAppTables() {
  if (!ensured) {
    ensured = (async () => {
      for (const stmt of EXTRA_DDL) await db.execute(sql.raw(stmt))
    })().catch((err) => {
      ensured = null
      throw err
    })
  }
  return ensured
}
