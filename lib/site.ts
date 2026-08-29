/**
 * Dominios de UNICRÉDITOS. El canónico es unicreditos.com.
 * .com.ar, .store y .online son alias de marca y redirigen al canónico.
 *
 * www.unicreditos.com NO se redirige desde la app: Vercel ya manda el apex a www.
 * Si la app redirige www → apex, el navegador entra en un loop 308 y no se ve nada.
 */
export const CANONICAL_HOST = 'unicreditos.com'
export const WWW_HOST = 'www.unicreditos.com'

export const SITE_ALIASES = [
  'unicreditos.com.ar',
  'www.unicreditos.com.ar',
  'unicreditos.store',
  'www.unicreditos.store',
  'unicreditos.online',
  'www.unicreditos.online',
] as const

export const BRAND_HOSTS = [CANONICAL_HOST, WWW_HOST, ...SITE_ALIASES] as const

/** Orígenes extra mientras convive el dominio anterior. */
export const LEGACY_HOSTS = ['unipagos.com.ar', 'www.unipagos.com.ar'] as const

export function publicSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  return `https://${CANONICAL_HOST}`
}

export function shouldRedirectHost(host: string) {
  const clean = host.split(':')[0]?.toLowerCase() ?? ''
  if ((SITE_ALIASES as readonly string[]).includes(clean)) return true
  if ((LEGACY_HOSTS as readonly string[]).includes(clean)) return true
  return false
}

export function trustedOrigins() {
  const origins = new Set<string>()
  const add = (value: string | undefined) => {
    const v = value?.trim()
    if (!v) return
    origins.add(v.startsWith('http://') || v.startsWith('https://') ? v.replace(/\/$/, '') : `https://${v}`)
  }

  process.env.BETTER_AUTH_TRUSTED_HOSTS?.split(',').forEach(add)
  process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',').forEach(add)
  add(process.env.NEXT_PUBLIC_SITE_URL)
  add(process.env.BETTER_AUTH_URL)
  add(`https://${CANONICAL_HOST}`)
  for (const host of BRAND_HOSTS) add(`https://${host}`)
  for (const host of LEGACY_HOSTS) add(`https://${host}`)

  if (process.env.NODE_ENV === 'development') {
    add('http://localhost:3000')
    add('http://127.0.0.1:3000')
    add('http://localhost:8081')
    add('http://127.0.0.1:8081')
  }
  add('unicreditos://')
  add('exp://localhost:8081')

  return Array.from(origins)
}
