import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

let ensured = false

/** Alta one-shot: no hay carpeta de migraciones Drizzle en este repo. */
export async function ensureOriginacionSchema() {
  if (ensured) return
  await db.execute(sql`ALTER TABLE loan ADD COLUMN IF NOT EXISTS tea numeric(6, 3)`)
  await db.execute(sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS "bcraConsentAt" timestamptz`)
  await db.execute(sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS "bcraConsentIp" text`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS arca_invoice (
      id text PRIMARY KEY,
      "userId" text NOT NULL,
      "loanId" text,
      "installmentId" text,
      "cbteTipo" integer NOT NULL DEFAULT 6,
      "ptoVta" integer NOT NULL DEFAULT 1,
      "cbteNro" integer,
      "docTipo" integer NOT NULL DEFAULT 80,
      "docNro" text NOT NULL,
      "impNeto" numeric(14, 2) NOT NULL,
      "impIva" numeric(14, 2) NOT NULL,
      "impTotal" numeric(14, 2) NOT NULL,
      currency text NOT NULL DEFAULT 'ARS',
      status text NOT NULL DEFAULT 'pending_cae',
      cae text,
      "caeVto" text,
      "arcaError" text,
      "issuedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS arca_invoice_user_idx ON arca_invoice ("userId")`)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS arca_invoice_installment_unique ON arca_invoice ("installmentId")`)
  ensured = true
}
