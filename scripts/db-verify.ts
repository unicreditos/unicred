/**
 * Compara el schema declarado en lib/db/schema.ts contra la base real.
 * Uso: npm run db:verify           (solo reporta)
 *      npm run db:verify -- --fix  (aplica ALTER/CREATE faltantes)
 */
import path from 'node:path'
import { Pool } from 'pg'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { PgTable } from 'drizzle-orm/pg-core'
import { loadProjectEnv } from './load-env'

loadProjectEnv(path.join(process.cwd()))

const APPLY = process.argv.includes('--fix')

function cleanConnectionUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('channel_binding')
    u.searchParams.delete('sslmode')
    return u.toString()
  } catch {
    return url
  }
}

type ColumnInfo = { dataType: string; isNullable: boolean; columnDefault: string | null }

/**
 * Drizzle no expone el SQL del predicado de un índice parcial de forma estable,
 * así que los predicados se declaran acá por nombre de índice.
 */
const PARTIAL_INDEX_PREDICATES: Record<string, string> = {
  bank_account_primary_unique: '"isPrimary" = true',
  saved_payment_default_unique: '"isDefault" = true',
  payment_external_unique: '"externalId" is not null',
}

function whereClause(indexName: string): string {
  const predicate = PARTIAL_INDEX_PREDICATES[indexName]
  if (!predicate) throw new Error(`Falta el predicado del índice parcial "${indexName}"`)
  return predicate
}

async function main() {
  const connectionString = cleanConnectionUrl(process.env.DATABASE_URL)
  if (!connectionString) {
    console.error('DATABASE_URL no definida')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 30000,
  })

  const schema = (await import('../lib/db/schema')) as Record<string, unknown>
  const tables = Object.values(schema).filter(
    (v): v is PgTable => typeof v === 'object' && v !== null && Symbol.for('drizzle:Name') in v,
  )

  const { rows: dbTables } = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  )
  const existingTables = new Set(dbTables.map((r) => r.table_name))

  const { rows: dbColumns } = await pool.query<{
    table_name: string
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
  }>(
    `select table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_schema = 'public'`,
  )
  const columnsByTable = new Map<string, Map<string, ColumnInfo>>()
  for (const r of dbColumns) {
    if (!columnsByTable.has(r.table_name)) columnsByTable.set(r.table_name, new Map())
    columnsByTable.get(r.table_name)!.set(r.column_name, {
      dataType: r.data_type,
      isNullable: r.is_nullable === 'YES',
      columnDefault: r.column_default,
    })
  }

  const { rows: dbIndexes } = await pool.query<{ indexname: string; tablename: string }>(
    `select indexname, tablename from pg_indexes where schemaname = 'public'`,
  )
  const existingIndexes = new Set(dbIndexes.map((r) => r.indexname))

  const problems: string[] = []
  const fixes: string[] = []

  for (const table of tables) {
    const cfg = getTableConfig(table)
    const name = cfg.name

    if (!existingTables.has(name)) {
      problems.push(`TABLA FALTANTE: ${name}`)
      if (name === 'didit_session') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "didit_session" (
  "id" text PRIMARY KEY NOT NULL,
  "sessionId" text NOT NULL,
  "vendorData" text NOT NULL,
  "userId" text,
  "workflowId" text,
  "status" text DEFAULT 'Not Started' NOT NULL,
  "webhookEventId" text,
  "decision" jsonb,
  "verificationUrl" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);`)
        fixes.push(
          `ALTER TABLE "didit_session" ADD CONSTRAINT "didit_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE set null;`,
        )
        fixes.push(`CREATE UNIQUE INDEX IF NOT EXISTS "didit_session_sessionId_unique" ON "didit_session" ("sessionId");`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "didit_session_user_idx" ON "didit_session" ("userId");`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "didit_session_vendor_idx" ON "didit_session" ("vendorData");`)
      } else if (name === 'didit_webhook_log') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "didit_webhook_log" (
  "id" text PRIMARY KEY NOT NULL,
  "eventId" text NOT NULL,
  "dedupeKey" text,
  "webhookType" text NOT NULL,
  "sessionId" text,
  "status" text,
  "environment" text,
  "processed" boolean DEFAULT false NOT NULL,
  "payload" jsonb,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "processedAt" timestamp with time zone
);`)
        fixes.push(`CREATE UNIQUE INDEX IF NOT EXISTS "didit_webhook_log_eventId_unique" ON "didit_webhook_log" ("eventId");`)
        fixes.push(`CREATE UNIQUE INDEX IF NOT EXISTS "didit_webhook_log_dedupe_unique" ON "didit_webhook_log" ("dedupeKey");`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "didit_webhook_log_session_idx" ON "didit_webhook_log" ("sessionId");`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "didit_webhook_log_type_idx" ON "didit_webhook_log" ("webhookType");`)
      } else if (name === 'merchant_document') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "merchant_document" (
  "id" text PRIMARY KEY NOT NULL,
  "merchantId" text NOT NULL,
  "userId" text NOT NULL,
  "type" text NOT NULL,
  "fileName" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "sha256" text NOT NULL,
  "content" text NOT NULL,
  "status" text DEFAULT 'uploaded' NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);`)
        fixes.push(
          `ALTER TABLE "merchant_document" ADD CONSTRAINT "merchant_document_merchantId_merchant_id_fk" FOREIGN KEY ("merchantId") REFERENCES "merchant"("id") ON DELETE cascade;`,
        )
        fixes.push(
          `ALTER TABLE "merchant_document" ADD CONSTRAINT "merchant_document_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade;`,
        )
        fixes.push(`CREATE INDEX IF NOT EXISTS "merchant_document_merchant_idx" ON "merchant_document" ("merchantId");`)
      } else if (name === 'arca_invoice') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "arca_invoice" (
  "id" text PRIMARY KEY NOT NULL,
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
  "issuedAt" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "arca_invoice_user_idx" ON "arca_invoice" ("userId");`)
        fixes.push(`CREATE UNIQUE INDEX IF NOT EXISTS "arca_invoice_installment_unique" ON "arca_invoice" ("installmentId");`)
      } else if (name === 'support_message') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "support_message" (
  "id" text PRIMARY KEY NOT NULL,
  "caseId" text NOT NULL,
  "authorUserId" text NOT NULL,
  "authorRole" text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'message',
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "support_message_case_idx" ON "support_message" ("caseId");`)
      } else if (name === 'support_presence') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "support_presence" (
  "userId" text PRIMARY KEY NOT NULL,
  role text NOT NULL,
  "viewingCaseId" text,
  "lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL
);`)
      } else if (name === 'inbox_receipt') {
        fixes.push(`CREATE TABLE IF NOT EXISTS "inbox_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "itemId" text NOT NULL,
  "readAt" timestamp with time zone DEFAULT now() NOT NULL
);`)
        fixes.push(`CREATE UNIQUE INDEX IF NOT EXISTS "inbox_receipt_user_item_unique" ON "inbox_receipt" ("userId", "itemId");`)
        fixes.push(`CREATE INDEX IF NOT EXISTS "inbox_receipt_user_idx" ON "inbox_receipt" ("userId");`)
      } else {
        problems.push(`  → ejecutá npm run db:push para crear ${name}`)
      }
      continue
    }

    const dbCols = columnsByTable.get(name) ?? new Map()
    for (const col of cfg.columns) {
      const dbCol = dbCols.get(col.name)
      if (!dbCol) {
        problems.push(`COLUMNA FALTANTE: ${name}.${col.name} (${col.getSQLType()})`)
        const nullability = col.notNull ? ' NOT NULL' : ''
        const def = col.hasDefault && col.default !== undefined
          ? ` DEFAULT ${typeof col.default === 'string' ? `'${col.default}'` : String(col.default)}`
          : ''
        fixes.push(
          `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.getSQLType()}${
            col.notNull && !col.hasDefault ? '' : nullability
          }${def};`,
        )
        continue
      }
      if (col.notNull && dbCol.isNullable) {
        problems.push(`NULLABILITY: ${name}.${col.name} debería ser NOT NULL`)
        if (col.hasDefault && col.default !== undefined) {
          const literal =
            typeof col.default === 'string' ? `'${col.default}'` : String(col.default)
          fixes.push(
            `UPDATE "${name}" SET "${col.name}" = ${literal} WHERE "${col.name}" IS NULL;`,
          )
          fixes.push(
            `ALTER TABLE "${name}" ALTER COLUMN "${col.name}" SET DEFAULT ${literal};`,
          )
        }
        fixes.push(`ALTER TABLE "${name}" ALTER COLUMN "${col.name}" SET NOT NULL;`)
      }
    }

    for (const [dbColName] of dbCols) {
      if (!cfg.columns.some((c) => c.name === dbColName)) {
        problems.push(`COLUMNA EXTRA EN DB (no en schema): ${name}.${dbColName}`)
      }
    }

    for (const idx of cfg.indexes) {
      const c = idx.config
      if (!c.name || existingIndexes.has(c.name)) continue
      problems.push(`INDICE FALTANTE: ${c.name} en ${name}`)
      const cols = c.columns
        .map((col) => ('name' in col ? `"${(col as { name: string }).name}"` : null))
        .filter(Boolean)
        .join(', ')
      if (!cols) continue
      const unique = c.unique ? 'UNIQUE ' : ''
      const where = c.where ? ` WHERE ${whereClause(c.name)}` : ''
      fixes.push(
        `CREATE ${unique}INDEX IF NOT EXISTS "${c.name}" ON "${name}" (${cols})${where};`,
      )
    }
  }

  const schemaTableNames = new Set(tables.map((t) => getTableConfig(t).name))
  for (const t of existingTables) {
    if (!schemaTableNames.has(t) && !t.startsWith('drizzle')) {
      problems.push(`TABLA EXTRA EN DB (no en schema): ${t}`)
    }
  }

  console.log(`\nTablas en schema: ${tables.length} | Tablas en DB: ${existingTables.size}`)
  if (problems.length === 0) {
    console.log('OK: la base coincide con el schema.')
  } else {
    console.log(`\n${problems.length} diferencia(s):`)
    for (const p of problems) console.log(`  - ${p}`)
  }

  if (fixes.length && APPLY) {
    console.log(`\nAplicando ${fixes.length} correccion(es)...`)
    const failed: string[] = []
    for (const sqlText of fixes) {
      try {
        await pool.query(sqlText)
        console.log(`  OK  ${sqlText}`)
      } catch (err) {
        failed.push(`${sqlText}  -->  ${(err as Error).message}`)
        console.log(`  ERR ${sqlText}`)
      }
    }
    if (failed.length) {
      console.log(`\n${failed.length} correccion(es) fallaron (probable dato duplicado):`)
      for (const f of failed) console.log(`  - ${f}`)
    } else {
      console.log('Todas las correcciones se aplicaron.')
    }
  } else if (fixes.length) {
    console.log(`\nSQL sugerido (ejecutar con --fix):`)
    for (const sqlText of fixes) console.log(`  ${sqlText}`)
  }

  await pool.end()
  process.exit(problems.length && !APPLY ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
