/**
 * DDL de "Configuración y contenido". Fuente única: el SQL para aplicar a mano en producción
 * (scripts/sql/2026-10-10_06_site_config.sql) se genera desde acá con `npm run site-config:sql`
 * y un test verifica que no diverjan. Todo es aditivo: no toca ninguna tabla existente.
 */
export const SITE_CONFIG_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS site_config_item (
  key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('setting','content_block','legal_document')),
  sensitivity text NOT NULL CHECK (sensitivity IN ('normal','pricing','legal')),
  label text NOT NULL,
  "publishedVersion" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS site_config_version (
  id text PRIMARY KEY,
  "itemKey" text NOT NULL REFERENCES site_config_item(key),
  version integer NOT NULL,
  value jsonb NOT NULL,
  "valueHash" text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','in_review','approved','published','superseded')),
  "publicVisible" boolean NOT NULL DEFAULT false,
  "publicApprovalRef" text,
  reason text NOT NULL,
  "basedOnVersion" integer,
  "rollbackOfVersion" integer,
  "authorId" text NOT NULL,
  "authorEmail" text,
  "lastEditorId" text,
  "submittedAt" timestamptz,
  "reviewedById" text,
  "reviewedAt" timestamptz,
  "reviewNote" text,
  "approvedById" text,
  "approvedByEmail" text,
  "approvedAt" timestamptz,
  "publishedById" text,
  "publishedByEmail" text,
  "publishedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_config_version_item_version_uq UNIQUE ("itemKey", version)
)`,
  // Una sola versión "en curso" por clave y una sola publicada.
  `CREATE UNIQUE INDEX IF NOT EXISTS site_config_one_open_idx ON site_config_version ("itemKey") WHERE status IN ('draft','in_review','approved')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS site_config_one_published_idx ON site_config_version ("itemKey") WHERE status = 'published'`,
  `CREATE INDEX IF NOT EXISTS site_config_version_created_idx ON site_config_version ("createdAt")`,
  // Historial inmutable: el contenido de una versión no se edita una vez que salió de borrador,
  // las versiones no se borran (solo los borradores) y el estado solo avanza por transiciones válidas.
  `CREATE OR REPLACE FUNCTION site_config_version_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'site_config_version es historial inmutable (TRUNCATE no permitido)';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'draft' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'site_config_version es historial inmutable (solo se descartan borradores)';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."itemKey" IS DISTINCT FROM OLD."itemKey"
     OR NEW.version IS DISTINCT FROM OLD.version OR NEW."authorId" IS DISTINCT FROM OLD."authorId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" OR NEW."basedOnVersion" IS DISTINCT FROM OLD."basedOnVersion"
     OR NEW."rollbackOfVersion" IS DISTINCT FROM OLD."rollbackOfVersion" THEN
    RAISE EXCEPTION 'site_config_version: identidad de la versión inmutable';
  END IF;
  IF OLD.status <> 'draft' AND (NEW.value IS DISTINCT FROM OLD.value OR NEW."valueHash" IS DISTINCT FROM OLD."valueHash"
     OR NEW."publicVisible" IS DISTINCT FROM OLD."publicVisible" OR NEW.reason IS DISTINCT FROM OLD.reason) THEN
    RAISE EXCEPTION 'site_config_version: el contenido de una versión enviada a revisión o publicada es inmutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'draft' AND NEW.status = 'in_review')
    OR (OLD.status = 'in_review' AND NEW.status IN ('approved','draft','published'))
    OR (OLD.status = 'approved' AND NEW.status IN ('published','draft'))
    OR (OLD.status = 'published' AND NEW.status = 'superseded')
  ) THEN
    RAISE EXCEPTION 'site_config_version: transición de estado no permitida (% -> %)', OLD.status, NEW.status;
  END IF;
  IF OLD.status IN ('published','superseded') AND NEW.status = OLD.status AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'site_config_version: una versión publicada no se modifica';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS site_config_version_guard ON site_config_version`,
  `CREATE TRIGGER site_config_version_guard BEFORE UPDATE OR DELETE ON site_config_version FOR EACH ROW EXECUTE FUNCTION site_config_version_guard()`,
  `DROP TRIGGER IF EXISTS site_config_version_no_truncate ON site_config_version`,
  `CREATE TRIGGER site_config_version_no_truncate BEFORE TRUNCATE ON site_config_version FOR EACH STATEMENT EXECUTE FUNCTION site_config_version_guard()`,
]

export const SITE_CONFIG_SQL_FILE = 'scripts/sql/2026-10-10_06_site_config.sql'

export function renderSiteConfigSql(): string {
  return [
    '-- Configuración y contenido editables desde el backoffice (prototipo).',
    '-- APLICAR A MANO en producción, después de respaldar. Es aditivo: crea 2 tablas, 3 índices y 1 trigger; no toca tablas existentes.',
    '-- Sin esto la web sigue igual: sin tablas o sin versión publicada se usan los valores del código.',
    '-- Generado por `npm run site-config:sql` desde lib/site-config/sql.ts. No editar a mano.',
    '',
    'BEGIN;',
    '',
    ...SITE_CONFIG_DDL.map((s) => `${s};\n`),
    '-- Permisos nuevos: content.edit, content.publish, pricing.publish. Los crea la app al primer ingreso al backoffice',
    '-- (ensureRbacSchema); si prefiere sembrarlos a mano:',
    "INSERT INTO admin_permission (id, key, label, category) VALUES",
    "  ('perm_content_edit','content.edit','Editar contenido y configuración de la web','Contenido'),",
    "  ('perm_content_publish','content.publish','Aprobar y publicar contenido y documentación legal','Contenido'),",
    "  ('perm_pricing_publish','pricing.publish','Aprobar y publicar comisiones, tasas y método de CFT','Contenido')",
    'ON CONFLICT (key) DO NOTHING;',
    '',
    "-- Roles: super_admin y director reciben los 3 permisos; gerente solo content.edit.",
    "INSERT INTO admin_role_permission (id, \"roleId\", \"permissionId\")",
    "SELECT r.id || '__' || p.id, r.id, p.id FROM admin_role r JOIN admin_permission p ON p.key IN ('content.edit','content.publish','pricing.publish')",
    "WHERE r.key IN ('super_admin','director')",
    'ON CONFLICT DO NOTHING;',
    "INSERT INTO admin_role_permission (id, \"roleId\", \"permissionId\")",
    "SELECT r.id || '__' || p.id, r.id, p.id FROM admin_role r JOIN admin_permission p ON p.key = 'content.edit' WHERE r.key = 'gerente'",
    'ON CONFLICT DO NOTHING;',
    '',
    'COMMIT;',
    '',
  ].join('\n')
}
