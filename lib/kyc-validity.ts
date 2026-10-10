/**
 * Vigencia de la verificacion de identidad (Didit) y modo del gate de operacion.
 * Modulo puro (sin base de datos) para poder probarlo.
 */
export type GateMode = 'off' | 'warn' | 'enforce'
export type GateScope = 'loan' | 'wallet' | 'payout' | 'bank'

export const DEFAULT_KYC_MAX_AGE_MONTHS = 12

export function kycMaxAgeMonths(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.KYC_MAX_AGE_MONTHS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_KYC_MAX_AGE_MONTHS
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
}

/** La verificacion vence a los N meses de la revision (o de su ultima actualizacion), o antes si trae expiresAt. */
export function isKycFresh(
  input: { expiresAt?: Date | null; reviewedAt?: Date | null; updatedAt?: Date | null },
  now: Date = new Date(),
  months: number = kycMaxAgeMonths(),
): boolean {
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) return false
  const ref = input.reviewedAt ?? input.updatedAt ?? null
  if (!ref) return true
  return addMonths(ref, months).getTime() > now.getTime()
}

export function gateMode(env: Record<string, string | undefined> = process.env): GateMode {
  const v = (env.ONBOARDING_GATE ?? 'enforce').trim().toLowerCase()
  return v === 'off' || v === 'warn' ? v : 'enforce'
}

export function gateDecision(mode: GateMode, approved: boolean): 'allow' | 'warn' | 'block' {
  if (approved || mode === 'off') return 'allow'
  return mode === 'warn' ? 'warn' : 'block'
}

export const IDENTITY_REQUIRED_MESSAGE =
  'Ten\u00e9s que tener la identidad verificada y vigente con Didit para operar. Verific\u00e1 tu identidad desde tu perfil.'