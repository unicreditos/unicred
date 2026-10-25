import { defineConfig } from 'drizzle-kit'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import path from 'node:path'
import dotenv from 'dotenv'
import * as schema from './lib/db/schema'

for (const file of [
  '.env.development.local',
  '.env.production.local',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env',
]) {
  dotenv.config({ path: path.join(__dirname, file) })
}

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

/**
 * La base se comparte con unicred-verify y tiene tablas creadas por los SQL de scripts/sql (evidencia KYC inmutable,
 * TOTP, config del sitio…) que no están en schema.ts. `drizzle-kit push --force` borraría todo lo que no conoce, así
 * que solo se le deja ver las tablas declaradas en schema.ts: el resto no se lista ni se toca.
 */
const declaredTables = Object.values(schema)
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table).name)

export default defineConfig({
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  out: './drizzle',
  tablesFilter: declaredTables,
  dbCredentials: {
    url: cleanConnectionUrl(process.env.DATABASE_URL) ?? '',
  },
})
