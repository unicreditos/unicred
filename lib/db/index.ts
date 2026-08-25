import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function cleanConnectionUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('channel_binding')
    u.searchParams.delete('sslmode')
    u.searchParams.set('uselibpqcompat', 'true')
    return u.toString()
  } catch {
    return url
  }
}

const rawDatabaseUrl = process.env.DATABASE_URL
const cleanedDatabaseUrl = cleanConnectionUrl(rawDatabaseUrl)

const isNeon =
  cleanedDatabaseUrl?.includes('neon.tech') ||
  process.env.POSTGRES_HOST?.includes('neon.tech')

export const pool = new Pool({
  connectionString: cleanedDatabaseUrl,
  max: 10,
  min: 0,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: false,
  ...(isNeon
    ? {
        ssl: {
          rejectUnauthorized: true,
        },
      }
    : {}),
})

export const db = drizzle(pool, { schema })
