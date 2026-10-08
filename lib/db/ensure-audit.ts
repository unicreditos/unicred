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
  // Registro de solo agregado: nadie (ni una acción de la app ni un operador con acceso a la base
  // desde la aplicación) puede editar o borrar una línea. La única modificación permitida es la que
  // hace la propia clave foránea al borrar un usuario: anular "actorUserId".
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION admin_audit_log_immutable() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE'
         AND NEW.id IS NOT DISTINCT FROM OLD.id
         AND NEW."actorEmail" IS NOT DISTINCT FROM OLD."actorEmail"
         AND NEW.action IS NOT DISTINCT FROM OLD.action
         AND NEW."entityType" IS NOT DISTINCT FROM OLD."entityType"
         AND NEW."entityId" IS NOT DISTINCT FROM OLD."entityId"
         AND NEW."targetUserId" IS NOT DISTINCT FROM OLD."targetUserId"
         AND NEW.severity IS NOT DISTINCT FROM OLD.severity
         AND NEW.summary IS NOT DISTINCT FROM OLD.summary
         AND NEW.changes IS NOT DISTINCT FROM OLD.changes
         AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
         AND NEW."actorUserId" IS NULL THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'admin_audit_log es de solo agregado (% no permitido)', TG_OP;
    END;
    $$ LANGUAGE plpgsql
  `)
  await db.execute(sql`DROP TRIGGER IF EXISTS admin_audit_log_immutable ON admin_audit_log`)
  await db.execute(sql`
    CREATE TRIGGER admin_audit_log_immutable
    BEFORE UPDATE OR DELETE ON admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION admin_audit_log_immutable()
  `)
  await db.execute(sql`DROP TRIGGER IF EXISTS admin_audit_log_no_truncate ON admin_audit_log`)
  await db.execute(sql`
    CREATE TRIGGER admin_audit_log_no_truncate
    BEFORE TRUNCATE ON admin_audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION admin_audit_log_immutable()
  `)
  ensured = true
}
