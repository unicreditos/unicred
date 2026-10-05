/**
 * Intención de monto/plazo que sale del simulador público y entra al alta
 * o al tab Solicitar. No origina crédito: solo transporta lo que la persona
 * ya eligió en pantalla.
 */

import { catalogByType } from '@/lib/loan-catalog'

const PERSONAL = catalogByType('personal')

export type LoanIntent = {
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

export function parseLoanIntent(source: ParamBag | null | undefined): LoanIntent {
  return {
    amount: clampCatalog(readParam(source, 'monto'), PERSONAL.minAmount, PERSONAL.maxAmount),
    term: clampCatalog(readParam(source, 'plazo'), PERSONAL.minTerm, PERSONAL.maxTerm),
  }
}

export function hasLoanIntent(intent: LoanIntent) {
  return intent.amount !== null || intent.term !== null
}

export function signupHref(amount?: number | null, term?: number | null) {
  const q = new URLSearchParams()
  if (amount) q.set('monto', String(amount))
  if (term) q.set('plazo', String(term))
  const qs = q.toString()
  return qs ? `/sign-up?${qs}` : '/sign-up'
}

export function solicitarHref(intent: LoanIntent = { amount: null, term: null }) {
  const q = new URLSearchParams({ tab: 'solicitar' })
  if (intent.amount) q.set('monto', String(intent.amount))
  if (intent.term) q.set('plazo', String(intent.term))
  return `/dashboard?${q.toString()}`
}

/** Con sesión, /sign-up?monto=… no puede tirar el monto elegido: va a Solicitar. */
export function loggedInSignupBouncePath(pathname: string, search: URLSearchParams) {
  if (pathname !== '/sign-up' && !pathname.startsWith('/sign-up/')) return null
  const intent = parseLoanIntent(search)
  if (!hasLoanIntent(intent)) return null
  return solicitarHref(intent)
}
