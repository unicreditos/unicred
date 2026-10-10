/**
 * Guardas para scripts de siembra QA: la clave jamás vive en el repo ni se imprime,
 * y el script no corre contra una base remota/produccion salvo opt-in explicito.
 */
import { randomBytes } from 'node:crypto'

export const QA_MIN_PASSWORD_LENGTH = 14

export function dbHostOf(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Lanza si la base objetivo no es local o es de produccion. No imprime la URL. */
export function assertSafeSeedTarget(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Siembra QA bloqueada: NODE_ENV=production.')
  }
  const host = dbHostOf(env.DATABASE_URL)
  if (!host) throw new Error('Siembra QA bloqueada: DATABASE_URL ausente o ilegible.')
  const prodHosts = (env.PROD_DB_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (prodHosts.some((h) => host.includes(h))) {
    throw new Error('Siembra QA bloqueada: la base objetivo figura en PROD_DB_HOSTS.')
  }
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!isLocal && env.ALLOW_QA_SEED_REMOTE !== 'yes') {
    throw new Error('Siembra QA bloqueada: la base no es local. Usa ALLOW_QA_SEED_REMOTE=yes solo en una base de pruebas.')
  }
}

export function generateQaPassword(): string {
  return randomBytes(18).toString('base64url')
}

/** La clave sale de QA_SEED_PASSWORD, o se genera con --generate (se guarda en un archivo local ignorado por git). */
export function resolveQaPassword(
  env: Record<string, string | undefined>,
  argv: string[],
): { password: string; generated: boolean } {
  const fromEnv = (env.QA_SEED_PASSWORD ?? '').trim()
  if (fromEnv) {
    if (fromEnv.length < QA_MIN_PASSWORD_LENGTH) {
      throw new Error(`QA_SEED_PASSWORD debe tener al menos ${QA_MIN_PASSWORD_LENGTH} caracteres.`)
    }
    return { password: fromEnv, generated: false }
  }
  if (argv.includes('--generate')) return { password: generateQaPassword(), generated: true }
  throw new Error('Falta QA_SEED_PASSWORD (o usa --generate para crear una y guardarla en .qa-seed-credentials.local).')
}