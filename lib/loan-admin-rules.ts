/**
 * Reglas puras (sin base de datos) de la gestion manual de creditos en el admin:
 * reabrir a pendiente, editar condiciones y exigir KYC al originar.
 * Toda aprobacion o rechazo sigue siendo decision humana: nada de esto aprueba solo.
 */
import { canAdminTransition, isLoanStatus } from '@/lib/loan-state'

export const MIN_REASON_CHARS = 10

export type RuleResult = { ok: true } | { ok: false; error: string; code: 'invalid' | 'blocked' | 'needs_confirmation' | 'conflict' }

const bad = (error: string, code: 'invalid' | 'blocked' | 'needs_confirmation' | 'conflict' = 'invalid'): RuleResult => ({ ok: false, error, code })

export function hasReason(reason: unknown): boolean {
  return String(reason ?? '').trim().length >= MIN_REASON_CHARS
}

/** Bloqueo optimista: si el cliente vio otra version, se rechaza con 409. */
export function isStale(expectedUpdatedAt: unknown, actual: Date | string | null | undefined): boolean {
  const exp = new Date(String(expectedUpdatedAt ?? '')).getTime()
  const act = actual ? new Date(actual).getTime() : NaN
  if (!Number.isFinite(exp) || !Number.isFinite(act)) return true
  return exp !== act
}
export const CONFLICT_MESSAGE = 'El crédito cambió mientras lo mirabas (409). Recargá la pantalla y volvé a intentar.'

export type ReopenFacts = {
  status: string
  disbursementsCredited: number
  paidInstallments: number
  contractAccepted: boolean
}

/** Volver a "pendiente": solo desde aprobado/rechazado/anulado, con motivo, sin tocar operaciones ya ejecutadas. */
export function reopenDecision(f: ReopenFacts, opts: { reason: unknown; confirmSigned?: boolean }): RuleResult {
  if (!hasReason(opts.reason)) return bad(`Indicá el motivo (mínimo ${MIN_REASON_CHARS} caracteres).`)
  if (!isLoanStatus(f.status)) return bad('Estado de crédito desconocido.')
  if (f.status === 'pending') return bad('La solicitud ya está pendiente.')
  if (f.status === 'active' || f.status === 'paid') {
    return bad('El crédito ya está desembolsado o saldado: no se reabre. Las operaciones ejecutadas no se alteran.', 'blocked')
  }
  if (f.disbursementsCredited > 0) return bad('Tiene un desembolso acreditado: no se puede reabrir.', 'blocked')
  if (f.paidInstallments > 0) return bad('Tiene cuotas pagadas: no se puede reabrir.', 'blocked')
  if (!canAdminTransition(f.status, 'pending')) return bad('Esta transición no está permitida desde el admin.', 'blocked')
  if (f.contractAccepted && !opts.confirmSigned) {
    return bad('El cliente ya firmó el contrato. Para reabrir hace falta una confirmación explícita adicional.', 'needs_confirmation')
  }
  return { ok: true }
}

export type EditLimits = { minAmount: number; maxAmount: number; minTerm: number; maxTerm: number }

/** Editar monto/cuotas: solo con la solicitud pendiente, dentro de los limites del producto y con motivo. */
export function validateLoanEdit(
  current: { status: string; principal: number; term: number },
  patch: { amount?: number | null; installments?: number | null },
  limits: EditLimits,
  reason: unknown,
): RuleResult {
  if (!hasReason(reason)) return bad(`Indicá el motivo (mínimo ${MIN_REASON_CHARS} caracteres).`)
  if (current.status !== 'pending') {
    return bad('Solo se edita una solicitud pendiente. Reabrila primero (con motivo) si ya fue decidida.', 'blocked')
  }
  const amount = patch.amount ?? current.principal
  const term = patch.installments ?? current.term
  if (!Number.isFinite(amount) || amount <= 0) return bad('Monto inválido.')
  if (!Number.isInteger(term) || term <= 0) return bad('Cantidad de cuotas inválida.')
  if (amount < limits.minAmount || amount > limits.maxAmount) return bad('El monto está fuera del rango del producto.')
  if (term < limits.minTerm || term > limits.maxTerm) return bad('Las cuotas están fuera del rango del producto.')
  if (amount === current.principal && term === current.term) return bad('No hay cambios para guardar.')
  return { ok: true }
}

export type KycFacts = {
  diditApproved: boolean
  profileKycStatus: string | null
  kycRecordStatus: string | null
  provider: string | null
  fresh: boolean
  bcraConsent: boolean
  arcaManualReview: boolean
  arcaChecked: boolean
}

/** Motivos por los que NO se puede originar un crédito para este cliente (lista vacia = puede). */
export function originacionKycBlockers(f: KycFacts): string[] {
  const out: string[] = []
  if (f.kycRecordStatus === 'rejected' || f.profileKycStatus === 'rejected') out.push('La verificación de identidad fue rechazada.')
  else if (!f.diditApproved) {
    out.push(
      f.kycRecordStatus === 'approved' && !f.fresh
        ? 'La verificación de identidad (Didit) venció: hay que reverificar.'
        : 'El cliente no tiene la identidad verificada y vigente con Didit.',
    )
  }
  if (!f.bcraConsent) out.push('Falta la autorización de consulta al BCRA (Central de Deudores).')
  if (f.arcaManualReview) out.push('El padrón ARCA marcó el nombre para revisión manual.')
  return out
}

export function originacionKycMessage(blockers: string[]): string {
  return `No se puede originar el crédito: ${blockers.join(' ')} La identidad es un paso obligatorio.`
}
