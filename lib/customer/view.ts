import type { Tone } from '@/components/uc/grid-types'
import { badge } from '@/lib/uc/admin'

/** Estado de un crédito tal como lo ve el cliente. */
export function creditState(loanStatus: string, contractAccepted: boolean) {
  switch (loanStatus) {
    case 'active':
      return { key: 'Vigente', tone: 'success' as Tone }
    case 'approved':
      return contractAccepted ? { key: 'Por acreditar', tone: 'info' as Tone } : { key: 'Firma pendiente', tone: 'warning' as Tone }
    case 'paid':
      return { key: 'Cancelado', tone: 'neutral' as Tone }
    case 'rejected':
      return { key: 'Rechazado', tone: 'danger' as Tone }
    case 'cancelled':
      return { key: 'Anulado', tone: 'neutral' as Tone }
    default:
      return { key: 'En revisión', tone: 'info' as Tone }
  }
}

export const creditBadge = (loanStatus: string, contractAccepted: boolean) => {
  const s = creditState(loanStatus, contractAccepted)
  return badge(s.key, s.tone)
}

export const INSTALLMENT_LABEL: Record<string, string> = {
  paid: 'Pagada',
  pending: 'Pendiente',
  overdue: 'Vencida',
  partial: 'Parcial',
  cancelled: 'Anulada',
}
export const INSTALLMENT_TONE: Record<string, Tone> = {
  paid: 'success',
  pending: 'neutral',
  overdue: 'danger',
  partial: 'warning',
  cancelled: 'neutral',
}

export const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Acreditado',
  approved: 'Acreditado',
  pending: 'Pendiente',
  pending_review: 'En revisión',
  failed: 'Rechazado',
  cancelled: 'Anulado',
  refunded: 'Reintegrado',
}
export const PAYMENT_TONE: Record<string, Tone> = {
  paid: 'success',
  approved: 'success',
  pending: 'info',
  pending_review: 'info',
  failed: 'danger',
  cancelled: 'neutral',
  refunded: 'neutral',
}

export const solRef = (id: string) => `…${id.slice(-8)}`
