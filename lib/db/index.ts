import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

/** Base en la misma máquina (desarrollo o VPS): la conexión no sale de la red local, no lleva TLS. */
export function isLocalPostgres(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

export function cleanConnectionUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('channel_binding')
    u.searchParams.delete('sslmode')
    u.searchParams.set('uselibpqcompat', 'true')
    // Postgres propio (local o en el mismo VPS): sin TLS, para que libpq no lo exija.
    if (isLocalPostgres(u.hostname)) u.searchParams.set('sslmode', 'disable')
    return u.toString()
  } catch {
    return url
  }
}

export function isPlaceholderDbUrl(url: string | undefined): boolean {
  if (!url) return true
  return (
    url.includes('host.neon.tech') ||
    url.includes('usuario:password') ||
    url.includes('example.com')
  )
}

import dotenv from 'dotenv'
import path from 'node:path'

if (typeof window === 'undefined') {
  try {
    dotenv.config({ path: path.join(process.cwd(), '.env'), override: true })
  } catch {}
}

const rawDatabaseUrl = process.env.DATABASE_URL
const cleanedDatabaseUrl = cleanConnectionUrl(rawDatabaseUrl)

function rawHostIsLocal() {
  try {
    return rawDatabaseUrl ? isLocalPostgres(new URL(rawDatabaseUrl).hostname) : false
  } catch {
    return false
  }
}

const isNeon =
  cleanedDatabaseUrl?.includes('neon.tech') ||
  process.env.POSTGRES_HOST?.includes('neon.tech')

export const pool = new Pool({
  connectionString: isPlaceholderDbUrl(cleanedDatabaseUrl) ? undefined : cleanedDatabaseUrl,
  max: 10,
  // min:0 + idleTimeoutMillis corto significaba que, apenas pasaban ~30s sin
  // queries, el pool se quedaba sin conexiones abiertas — la siguiente query
  // pagaba el costo completo de un connect+TLS nuevo contra Neon (~2s,
  // medido en vivo: cada acción aislada tardaba igual sin importar qué tan
  // simple fuera la query). min:1 mantiene una conexión viva para absorber
  // ese caso; idleTimeoutMillis más alto reduce cuántas veces se repite
  // dentro de una misma sesión de uso normal.
  min: isPlaceholderDbUrl(cleanedDatabaseUrl) ? 0 : 1,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 120000,
  allowExitOnIdle: false,
  ...(isNeon
    ? {
        ssl: {
          rejectUnauthorized: true,
        },
      }
    : {
        // Hosts remotos que no son Neon exigen TLS salvo que sea una base local.
        ssl: rawHostIsLocal() ? false : undefined,
      }),
})

pool.on('error', (err) => {
  // Prevenir que errores de conexión tiren el proceso de Node.js
  const msg = err?.message || ''
  if (!msg.includes('ENOTFOUND') && !msg.includes('ECONNREFUSED')) {
    console.warn('[db pool error]:', msg)
  }
})

export const db = drizzle(pool, { schema })
