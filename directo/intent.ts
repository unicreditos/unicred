/**
 * Intención de monto/plazo que sale del simulador /directo
 * y entra al alta o al tab Solicitar. No origina crédito:
 * solo transporta lo que la persona ya eligió en pantalla.
 */

import { catalogByType } from '@/lib/loan-catalog'

const PERSONAL = catalogByType('personal')

export type DirectoIntent = {
  fromDirecto: boolean
  amount: number | null
  term: number | null
}

type ParamBag =
  | { get: (key: string) => string | null }
  | Record<string, string | string[] | undefined>

function readParam(source: ParamBag | null | undefined, key: string) {
  if (!source) return ''
  if (typeof (source as { get?: unknown }).get === 'function') {
    return (source as { get: (k: string) => string | null }).get(key) ?? ''
  }
  const value = (source as Record<string, string | string[] | undefined>)[key]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function clampCatalog(raw: string, min: number, max: number) {
  const digits = raw.replace(/[^\d.]/g, '')
  if (!digits) return null
  const n = Number(digits)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function parseDirectoIntent(source: ParamBag | null | undefined): DirectoIntent {
  return {
    fromDirecto: readParam(source, 'from') === 'directo',
    amount: clampCatalog(readParam(source, 'monto'), PERSONAL.minAmount, PERSONAL.maxAmount),
    term: clampCatalog(readParam(source, 'plazo'), PERSONAL.minTerm, PERSONAL.maxTerm),
  }
}

export function directoSignupHref(amount?: number | null, term?: number | null) {
  const q = new URLSearchParams({ from: 'directo' })
  if (amount) q.set('monto', String(amount))
  if (term) q.set('plazo', String(term))
  return `/sign-up?${q.toString()}`
}

export function directoSolicitarHref(intent: Pick<DirectoIntent, 'amount' | 'term'> = { amount: null, term: null }) {
  const q = new URLSearchParams({ tab: 'solicitar' })
  if (intent.amount) q.set('monto', String(intent.amount))
  if (intent.term) q.set('plazo', String(intent.term))
  return `/dashboard?${q.toString()}`
}

/** Con sesión, /sign-up?from=directo no puede tirar el monto: va a Solicitar. */
export function loggedInSignupBouncePath(pathname: string, search: URLSearchParams) {
  if (pathname !== '/sign-up' && !pathname.startsWith('/sign-up/')) return null
  const intent = parseDirectoIntent(search)
  if (!intent.fromDirecto) return null
  return directoSolicitarHref(intent)
}
