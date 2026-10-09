/** Nucleo puro del control previo al alta (BCRA + ARCA): reintentos, comparacion de nombres y decision. */

export const PREFLIGHT_RETRIES = 3
export const PREFLIGHT_BASE_DELAY_MS = 300
export const PREFLIGHT_BACKOFF_FACTOR = 3

export function bcraPreflightEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.REGISTRATION_BCRA_PREFLIGHT ?? 'yes').trim().toLowerCase() !== 'no'
}
export function arcaRequiredForClients(env: Record<string, string | undefined> = process.env): boolean {
  return (env.REGISTRATION_ARCA_REQUIRED ?? 'yes').trim().toLowerCase() !== 'no'
}

/** 1 intento inicial + 3 reintentos con espera creciente (300, 900, 2700 ms). Reintenta si lanza o si isFailure(valor). */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    retries?: number
    baseDelayMs?: number
    factor?: number
    isFailure?: (value: T) => boolean
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<{ ok: true; value: T; attempts: number } | { ok: false; error: string; attempts: number }> {
  const retries = opts.retries ?? PREFLIGHT_RETRIES
  const base = opts.baseDelayMs ?? PREFLIGHT_BASE_DELAY_MS
  const factor = opts.factor ?? PREFLIGHT_BACKOFF_FACTOR
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let lastError = 'sin respuesta'
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const value = await fn(attempt + 1)
      if (!opts.isFailure || !opts.isFailure(value)) return { ok: true, value, attempts: attempt + 1 }
      lastError = 'respuesta no disponible'
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
    if (attempt < retries) await sleep(base * factor ** attempt)
  }
  return { ok: false, error: lastError, attempts: retries + 1 }
}

export function normalizeName(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

/** Compara nombres sin importar orden (ARCA: "APELLIDO NOMBRE"), tildes ni signos. */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): 'match' | 'mismatch' | 'unknown' {
  const ta = normalizeName(String(a ?? ''))
  const tb = normalizeName(String(b ?? ''))
  if (!ta.length || !tb.length) return 'unknown'
  const setB = new Set(tb)
  const common = ta.filter((t) => setB.has(t)).length
  const shorter = Math.min(ta.length, tb.length)
  // Todos los tokens del nombre mas corto deben figurar en el otro (admite segundo nombre omitido).
  return common >= Math.max(2, shorter) || (shorter === 1 && common === 1) ? 'match' : 'mismatch'
}

export type PreflightInput = {
  bcra: { ok: boolean; error?: string }
  arca: { configured: boolean; found: boolean; error?: string; name?: string | null; taxStatus?: string | null }
  declaredName: string
  arcaRequired: boolean
  bcraRequired: boolean
}

export type PreflightDecision = {
  allow: boolean
  blockers: string[]
  manualReview: null | { reason: 'arca_name_mismatch'; arcaName: string; declaredName: string }
}

export function decidePreflight(i: PreflightInput): PreflightDecision {
  const blockers: string[] = []
  if (i.bcraRequired && !i.bcra.ok) {
    blockers.push('No pudimos consultar la Central de Deudores del BCRA. No se crea la cuenta sin esa consulta; reintent\u00e1 en unos minutos.')
  }
  let manualReview: PreflightDecision['manualReview'] = null
  if (i.arcaRequired) {
    if (!i.arca.configured) {
      blockers.push('El padr\u00f3n ARCA no est\u00e1 disponible. No se crea la cuenta sin constancia oficial.')
    } else if (!i.arca.found) {
      blockers.push(i.arca.error ? 'No pudimos consultar el padr\u00f3n ARCA. Reintent\u00e1 en unos minutos.' : 'El CUIT/CUIL no figura en el padr\u00f3n ARCA.')
    } else {
      if (i.arca.taxStatus && /^(INACTIV|BAJA)/i.test(i.arca.taxStatus.trim())) {
        blockers.push('La clave fiscal figura inactiva en ARCA.')
      }
      if (namesMatch(i.arca.name, i.declaredName) === 'mismatch') {
        manualReview = { reason: 'arca_name_mismatch', arcaName: String(i.arca.name), declaredName: i.declaredName }
      }
    }
  }
  return { allow: blockers.length === 0, blockers, manualReview }
}