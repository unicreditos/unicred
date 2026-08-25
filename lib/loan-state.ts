/**
 * Máquina de estados del crédito. Centraliza qué transiciones son válidas para
 * que ninguna acción (cliente, admin o script) pueda saltarse pasos del ciclo:
 * solicitud → evaluación → aprobación → desembolso → cuotas → cancelación.
 */

export const LOAN_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'active',
  'paid',
  'cancelled',
] as const

export type LoanStatus = (typeof LOAN_STATUSES)[number]

const TRANSITIONS: Record<LoanStatus, readonly LoanStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['active', 'rejected', 'cancelled'],
  active: ['paid', 'cancelled'],
  rejected: [],
  paid: [],
  cancelled: [],
}

/** Mesa de crédito: puede reconsiderar un rechazo. No salta a vigente (eso es Tesorería). */
const ADMIN_TRANSITIONS: Record<LoanStatus, readonly LoanStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['rejected', 'cancelled', 'pending'],
  rejected: ['pending', 'approved'],
  cancelled: ['pending', 'approved'],
  active: ['paid', 'cancelled'],
  paid: [],
}

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  pending: 'En evaluación',
  approved: 'Calificado',
  rejected: 'Rechazado',
  active: 'Vigente',
  paid: 'Cancelado',
  cancelled: 'Anulado',
}

/** Estados en los que el crédito genera deuda y cuotas exigibles. */
export function generatesDebt(status: string): boolean {
  return status === 'active'
}

export function isLoanStatus(value: string): value is LoanStatus {
  return (LOAN_STATUSES as readonly string[]).includes(value)
}

export function canTransition(from: string, to: string): boolean {
  if (!isLoanStatus(from) || !isLoanStatus(to)) return false
  if (from === to) return true
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: string, to: string): asserts to is LoanStatus {
  if (!isLoanStatus(to)) {
    throw new Error(`Estado de crédito desconocido: "${to}"`)
  }
  if (!canTransition(from, to)) {
    const fromLabel = isLoanStatus(from) ? LOAN_STATUS_LABELS[from] : from
    throw new Error(
      `Transición inválida: un crédito "${fromLabel}" no puede pasar a "${LOAN_STATUS_LABELS[to]}".`,
    )
  }
}

export function canAdminTransition(from: string, to: string): boolean {
  if (!isLoanStatus(from) || !isLoanStatus(to)) return false
  if (from === to) return true
  return ADMIN_TRANSITIONS[from].includes(to)
}

export function assertAdminTransition(from: string, to: string): asserts to is LoanStatus {
  if (!isLoanStatus(to)) {
    throw new Error(`Estado de crédito desconocido: "${to}"`)
  }
  if (to === 'active' && from !== 'active') {
    throw new Error(
      'No se puede marcar vigente desde el editor. Acreditá el desembolso en Tesorería (el cliente tiene que haber firmado el contrato).',
    )
  }
  if (!canAdminTransition(from, to)) {
    const fromLabel = isLoanStatus(from) ? LOAN_STATUS_LABELS[from] : from
    throw new Error(
      `Desde el admin, un crédito "${fromLabel}" no puede pasar a "${LOAN_STATUS_LABELS[to]}".`,
    )
  }
}

export function allowedTransitions(from: string): LoanStatus[] {
  if (!isLoanStatus(from)) return []
  return [...TRANSITIONS[from]]
}

export function allowedAdminTransitions(from: string): LoanStatus[] {
  if (!isLoanStatus(from)) return []
  const next = ADMIN_TRANSITIONS[from].filter((status) => status !== 'active')
  return [from, ...next.filter((status) => status !== from)]
}
