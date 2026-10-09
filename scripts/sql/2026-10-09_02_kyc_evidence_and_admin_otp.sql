-- scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql
-- Idempotente y aditivo. NO aplicado. Aplicar a mano (local -> staging -> produccion) solo con aprobacion de Angel.

-- 1) Evidencia KYC versionada (nunca se pisa una version anterior) con hash SHA-256 -----------------
CREATE TABLE IF NOT EXISTS kyc_evidence (
  id                  text PRIMARY KEY,
  "userId"            text NOT NULL,
  "kycVerificationId" text,
  "diditSessionId"    text,
  kind                text NOT NULL CHECK (kind IN ('dni_front','dni_back','selfie','video')),
  version             integer NOT NULL CHECK (version >= 1),
  mime                text NOT NULL,
  "sizeBytes"         integer NOT NULL,
  sha256              char(64) NOT NULL,
  data                bytea NOT NULL,
  source              text NOT NULL DEFAULT 'didit',
  "capturedAt"        timestamptz NOT NULL DEFAULT now(),
  "supersededBy"      text,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kyc_evidence_user_kind_version_uq UNIQUE ("userId", kind, version)
);
CREATE INDEX IF NOT EXISTS kyc_evidence_user_idx ON kyc_evidence ("userId", kind, version DESC);

-- Solo se permite completar "supersededBy"; el contenido y el hash son inmutables y no se borran.
CREATE OR REPLACE FUNCTION kyc_evidence_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'kyc_evidence es inmutable: no se borra';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.mime IS DISTINCT FROM OLD.mime OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
     OR NEW."capturedAt" IS DISTINCT FROM OLD."capturedAt" THEN
    RAISE EXCEPTION 'kyc_evidence es inmutable: solo se completa supersededBy';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS kyc_evidence_immutable_trg ON kyc_evidence;
CREATE TRIGGER kyc_evidence_immutable_trg BEFORE UPDATE OR DELETE ON kyc_evidence
  FOR EACH ROW EXECUTE FUNCTION kyc_evidence_immutable();

-- 2) Registro de accesos: quien vio que documento, cuando y desde donde ------------------------------
CREATE TABLE IF NOT EXISTS kyc_evidence_access_log (
  id            text PRIMARY KEY,
  "evidenceId"  text,
  "ownerUserId" text NOT NULL,
  kind          text NOT NULL,
  version       integer,
  "actorUserId" text NOT NULL,
  action        text NOT NULL DEFAULT 'view',
  outcome       text NOT NULL,            -- served | hash_mismatch | denied_2fa | not_found
  ip            text,
  "userAgent"   text,
  "at"          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kyc_evidence_access_owner_idx ON kyc_evidence_access_log ("ownerUserId", "at" DESC);
CREATE INDEX IF NOT EXISTS kyc_evidence_access_actor_idx ON kyc_evidence_access_log ("actorUserId", "at" DESC);

-- 3) Segundo factor de operadores por correo (OTP de 6 digitos, solo se guarda el hash) ---------------
CREATE TABLE IF NOT EXISTS admin_email_otp (
  id          text PRIMARY KEY,
  "userId"    text NOT NULL,
  "codeHash"  text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  "usedAt"    timestamptz,
  ip          text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_email_otp_user_idx ON admin_email_otp ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS admin_second_factor (
  id           text PRIMARY KEY,
  "userId"     text NOT NULL,
  method       text NOT NULL DEFAULT 'email_otp',
  ip           text,
  "verifiedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_second_factor_user_idx ON admin_second_factor ("userId", "verifiedAt" DESC);