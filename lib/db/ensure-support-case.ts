import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

let ensuredVersion = 0
const SCHEMA_VERSION = 2

/** Alta one-shot: no hay carpeta de migraciones Drizzle en este repo. */
export async function ensureSupportCaseTable() {
  if (ensuredVersion >= SCHEMA_VERSION) return
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
  await db.execute(sql`ALTER TABLE support_case ADD COLUMN IF NOT EXISTS "assignedAdminId" text`)
  await db.execute(sql`ALTER TABLE support_case ADD COLUMN IF NOT EXISTS "relatedLoanId" text`)
  await db.execute(sql`ALTER TABLE support_case ADD COLUMN IF NOT EXISTS "waitingOn" text NOT NULL DEFAULT 'agent'`)
  await db.execute(sql`ALTER TABLE support_case ADD COLUMN IF NOT EXISTS "lastMessageAt" timestamptz`)
  await db.execute(sql`ALTER TABLE support_case ADD COLUMN IF NOT EXISTS "lastAgentSeenAt" timestamptz`)
  await db.execute(sql`ALTER TABLE support_case ADD COLUMN IF NOT EXISTS "lastCustomerSeenAt" timestamptz`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS support_case_user_idx ON support_case ("userId")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS support_case_status_idx ON support_case (status)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_message (
      id text PRIMARY KEY,
      "caseId" text NOT NULL,
      "authorUserId" text NOT NULL,
      "authorRole" text NOT NULL,
      body text NOT NULL,
      kind text NOT NULL DEFAULT 'message',
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS support_message_case_idx ON support_message ("caseId")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_presence (
      "userId" text PRIMARY KEY,
      role text NOT NULL,
      "viewingCaseId" text,
      "lastSeenAt" timestamptz NOT NULL DEFAULT now()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inbox_receipt (
      id text PRIMARY KEY,
      "userId" text NOT NULL,
      "itemId" text NOT NULL,
      "readAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS inbox_receipt_user_item_unique ON inbox_receipt ("userId", "itemId")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS inbox_receipt_user_idx ON inbox_receipt ("userId")`)
  ensuredVersion = SCHEMA_VERSION
}
