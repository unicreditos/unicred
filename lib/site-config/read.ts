import { unstable_cache } from 'next/cache'
import { isPlaceholderDbUrl } from '@/lib/db'
import { isPubliclyVisible } from './core'
import { getDefinition } from './registry'
import { readPublished } from './store'

/**
 * Capa de lectura para la web pública y los cálculos.
 *  - Sin base, sin tablas, sin versión publicada o con cualquier error: se devuelve el valor del código.
 *  - Las claves sensibles (comisiones, tasas, CFT, documentación legal) solo salen de la base si la versión
 *    publicada tiene la marca explícita "visible en la web pública".
 *  - Cache corto (60 s) con etiquetas; al publicar se invalida de inmediato (updateTag en la acción).
 *  - SITE_CONFIG_DB_READ=off apaga la lectura de la base (interruptor de emergencia: todo vuelve al código).
 */

export const SITE_CONFIG_TAG = 'site-config'
export const siteConfigTag = (key: string) => `site-config:${key}`
const REVALIDATE_SECONDS = 60

export type SettingSource = 'default' | 'published'
export type SettingResult<T> = { value: T; source: SettingSource; version: number | null; publishedAt: Date | null }

const cachedPublished = (key: string) =>
  unstable_cache(
    async () => {
      const row = await readPublished(key) // si la base falla lanza: el error no se cachea
      return row ? { ...row, publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null } : null
    },
    ['site-config', key],
    { tags: [SITE_CONFIG_TAG, siteConfigTag(key)], revalidate: REVALIDATE_SECONDS },
  )()

export function dbReadEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SITE_CONFIG_DB_READ ?? 'on').trim().toLowerCase() !== 'off'
}

/** Resuelve una clave contra una versión publicada ya leída (puro: lo usan las pruebas). */
export function resolveSetting<T>(
  key: string,
  row: { version: number; value: unknown; publicVisible: boolean; publishedAt: string | Date | null } | null,
): SettingResult<T> {
  const d = getDefinition(key)
  if (!d) throw new Error(`Clave de configuración desconocida: ${key}`)
  const fallback: SettingResult<T> = { value: d.defaults as T, source: 'default', version: null, publishedAt: null }
  if (!row) return fallback
  if (!isPubliclyVisible(d.sensitivity, { status: 'published', publicVisible: row.publicVisible })) return fallback
  const parsed = d.schema.safeParse(row.value)
  if (!parsed.success) {
    console.error(`[site-config] valor publicado inválido para ${key}; se usa el del código`)
    return fallback
  }
  return { value: parsed.data as T, source: 'published', version: row.version, publishedAt: row.publishedAt ? new Date(row.publishedAt) : null }
}

export async function getSetting<T = unknown>(key: string): Promise<SettingResult<T>> {
  const d = getDefinition(key)
  if (!d) throw new Error(`Clave de configuración desconocida: ${key}`)
  const fallback = resolveSetting<T>(key, null)
  if (!dbReadEnabled() || isPlaceholderDbUrl(process.env.DATABASE_URL)) return fallback
  try {
    return resolveSetting<T>(key, await cachedPublished(key))
  } catch {
    return fallback
  }
}
