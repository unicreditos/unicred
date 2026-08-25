import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

let ensured = false

/** Alta one-shot: no hay carpeta de migraciones Drizzle en este repo. */
export async function ensureSupportCaseTable() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_case (
      id text PRIMARY KEY,
      "userId" text NOT NULL,
      category text NOT NULL,
      subject text NOT NULL,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'open',
      channel text NOT NULL DEFAULT 'dashboard',
      "lawRef" text NOT NULL DEFAULT 'Ley 24.240',
      response text,
      "respondedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS support_case_user_idx ON support_case ("userId")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS support_case_status_idx ON support_case (status)`)
  ensured = true
}
