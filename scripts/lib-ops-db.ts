// Conexion pg para scripts de operaciones. Nunca imprime ni guarda la cadena de conexion.
import { readFileSync } from 'node:fs'
import dotenv from 'dotenv'
import pg from 'pg'

/** Lee DATABASE_URL de --env-file <ruta> (solo en memoria) o del entorno. */
export function resolveDatabaseUrl(envFile?: string): string {
  let url = process.env.DATABASE_URL
  if (envFile) url = dotenv.parse(readFileSync(envFile))['DATABASE_URL'] || url
  if (!url) throw new Error('DATABASE_URL ausente (usar --env-file o variable de entorno).')
  try {
    const u = new URL(url)
    u.searchParams.delete('channel_binding')
    if (u.searchParams.has('sslmode') && u.searchParams.get('sslmode') !== 'disable') u.searchParams.set('sslmode', 'verify-full')
    return u.toString()
  } catch {
    return url
  }
}

export async function connect(url: string) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20000 })
  await client.connect()
  return client
}

/** Ejecuta fn dentro de BEGIN READ ONLY ... ROLLBACK: la base no puede escribirse. */
export async function readOnly<T>(url: string, fn: (q: (sql: string, params?: unknown[]) => Promise<Record<string, any>[]>) => Promise<T>): Promise<T> {
  const client = await connect(url)
  try {
    await client.query('BEGIN READ ONLY')
    const out = await fn(async (s, p) => (await client.query(s, p as any[])).rows)
    return out
  } finally {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    await client.end()
  }
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname } catch { return '?' }
}