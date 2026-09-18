import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

let ensured = false

/** Crea admin_audit_log si falta (mismo patrón que ensureRbacSchema). */
export async function ensureAuditSchema() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id text PRIMARY KEY,
      "actorUserId" text REFERENCES "user"(id) ON DELETE SET NULL,
      "actorEmail" text,
      action text NOT NULL,
      "entityType" text NOT NULL,
      "entityId" text,
      "targetUserId" text,
      severity text NOT NULL DEFAULT 'info',
      summary text NOT NULL,
      changes jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log ("createdAt")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON admin_audit_log ("actorUserId")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON admin_audit_log ("entityType", "entityId")
  `)
  ensured = true
}
