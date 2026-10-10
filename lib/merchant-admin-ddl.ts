/**
 * DDL aditivo del panel de comercios del backoffice (documentos versionados, bitacora de accesos,
 * permisos y mensajes admin <-> comercio). Idempotente. Misma fuente para `ensure` y para
 * scripts/sql/2026-10-10_05_merchant_admin.sql. No borra ni cambia datos existentes.
 */
export const MERCHANT_ADMIN_DDL: string[] = [
  `ALTER TABLE merchant_document ADD COLUMN IF NOT EXISTS "reviewNote" text`,
  `ALTER TABLE merchant_document ADD COLUMN IF NOT EXISTS "reviewedBy" text`,
  `ALTER TABLE merchant_document ADD COLUMN IF NOT EXISTS "reviewedAt" timestamptz`,
  `CREATE TABLE IF NOT EXISTS merchant_document_version (
    id text PRIMARY KEY,
    "documentId" text NOT NULL,
    "merchantId" text NOT NULL,
    type text NOT NULL,
    version integer NOT NULL,
    "fileName" text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    sha256 text NOT NULL,
    content text NOT NULL,
    status text NOT NULL,
    "reviewNote" text,
    "uploadedAt" timestamptz NOT NULL,
    "archivedAt" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS merchant_document_version_idx ON merchant_document_version ("merchantId", type)`,
  `CREATE TABLE IF NOT EXISTS merchant_document_access_log (
    id text PRIMARY KEY,
    "documentId" text,
    "merchantId" text,
    "actorUserId" text NOT NULL,
    outcome text NOT NULL,
    ip text,
    "userAgent" text,
    at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS merchant_document_access_idx ON merchant_document_access_log ("merchantId", at DESC)`,
  `CREATE TABLE IF NOT EXISTS merchant_permission (
    "merchantId" text PRIMARY KEY,
    "posEnabled" boolean NOT NULL DEFAULT false,
    "qrEnabled" boolean NOT NULL DEFAULT false,
    "virtualAccountEnabled" boolean NOT NULL DEFAULT false,
    "updatedBy" text,
    "updatedAt" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS merchant_message (
    id text PRIMARY KEY,
    "merchantId" text NOT NULL,
    "authorUserId" text NOT NULL,
    "authorRole" text NOT NULL CHECK ("authorRole" IN ('admin','merchant')),
    kind text NOT NULL CHECK (kind IN ('request','reply','note')),
    body text NOT NULL,
    "requestedDocType" text,
    "documentId" text,
    "replyToId" text,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "readAt" timestamptz,
    "readBy" text
  )`,
  `CREATE INDEX IF NOT EXISTS merchant_message_merchant_idx ON merchant_message ("merchantId", "createdAt")`,
  `CREATE OR REPLACE FUNCTION merchant_message_guard() RETURNS trigger AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'merchant_message es inmutable: no se borra';
    END IF;
    IF NEW.id <> OLD.id OR NEW."merchantId" <> OLD."merchantId" OR NEW."authorUserId" <> OLD."authorUserId"
       OR NEW."authorRole" <> OLD."authorRole" OR NEW.kind <> OLD.kind OR NEW.body <> OLD.body
       OR NEW."createdAt" <> OLD."createdAt"
       OR NEW."requestedDocType" IS DISTINCT FROM OLD."requestedDocType"
       OR NEW."documentId" IS DISTINCT FROM OLD."documentId"
       OR NEW."replyToId" IS DISTINCT FROM OLD."replyToId" THEN
      RAISE EXCEPTION 'merchant_message es inmutable: solo se puede marcar como leido';
    END IF;
    IF OLD."readAt" IS NOT NULL AND NEW."readAt" IS DISTINCT FROM OLD."readAt" THEN
      RAISE EXCEPTION 'merchant_message: la lectura ya fue registrada';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS merchant_message_guard_trg ON merchant_message`,
  `CREATE TRIGGER merchant_message_guard_trg BEFORE UPDATE OR DELETE ON merchant_message FOR EACH ROW EXECUTE FUNCTION merchant_message_guard()`,
]
