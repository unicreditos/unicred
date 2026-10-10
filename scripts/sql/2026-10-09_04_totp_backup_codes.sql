-- scripts/sql/2026-10-09_04_totp_backup_codes.sql
-- Idempotente. NO aplicado. Aplicar DESPUES de 02 (usa admin_second_factor).
-- TOTP (RFC 6238) con secreto cifrado en reposo y codigos de respaldo hasheados de un solo uso.

CREATE TABLE IF NOT EXISTS user_totp (
  "userId"       text PRIMARY KEY,
  "secretEnc"    text NOT NULL,                 -- AES-256-GCM (v1:iv:tag:ciphertext), nunca el secreto en claro
  "confirmedAt"  timestamptz,                   -- NULL = alta pendiente de confirmar con un codigo
  "lastUsedStep" bigint,                        -- ultimo paso de 30 s aceptado: impide reusar el mismo codigo (anti-replay)
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_backup_code (
  id          text PRIMARY KEY,
  "userId"    text NOT NULL,
  "codeHash"  char(64) NOT NULL,                -- HMAC-SHA256 con pepper; el codigo en claro se muestra una sola vez
  "usedAt"    timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_backup_code_user_idx ON user_backup_code ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS user_backup_code_hash_uq ON user_backup_code ("userId", "codeHash");

-- Contador de intentos (ya lo crea la app al vuelo; se declara aqui para entornos nuevos).
CREATE TABLE IF NOT EXISTS rate_limit_bucket (
  key       text PRIMARY KEY,
  count     integer NOT NULL,
  "resetAt" timestamptz NOT NULL
);