/** Etiquetas en español para los valores que se guardan como enums en la base. */

import { LOAN_STATUS_LABELS } from '@/lib/loan-state'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mercado_pago: 'Mercado Pago',
  link_pago: 'Link de pago',
  transferencia_bancaria: 'Transferencia bancaria',
  debito_automatico: 'Débito automático',
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta de débito',
  mercadopago_wallet: 'Dinero en cuenta de Mercado Pago',
  cvu: 'CVU',
  pago_facil: 'Pago Fácil',
  rapipago: 'Rapipago',
  ticket: 'Cupón de pago',
  transferencia_rm: 'Transferencia a RM / Brubank',
  payway_qr: 'Payway QR (sandbox)',
  payway_wallet: 'Billetera virtual (sandbox)',
  payway_card: 'Tarjeta Payway (sandbox)',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  pending_review: 'A verificar',
  processing: 'En proceso',
  paid: 'Acreditado',
  failed: 'Rechazado',
  refunded: 'Devuelto',
  cancelled: 'Anulado',
  expired: 'Vencido',
}

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
}

const KYC_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  submitted: 'Enviado',
  reviewing: 'En revisión',
  in_review: 'En revisión',
  approved: 'Aprobado',
  verified: 'Verificado',
  rejected: 'Rechazado',
  expired: 'Vencido',
}

const PAYMENT_LINK_STATUS_LABELS: Record<string, string> = {
  open: 'Pendiente de pago',
  paid: 'Pagado',
  cancelled: 'Anulado',
  expired: 'Vencido',
}

const MERCHANT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobado',
  active: 'Activo',
  suspended: 'Suspendido',
  rejected: 'Rechazado',
}

const DISBURSEMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de acreditación',
  processing: 'En proceso',
  credited: 'Acreditado',
  failed: 'Fallido',
  cancelled: 'Anulado',
}

/** Convierte `mercado_pago` en `Mercado pago` cuando no hay etiqueta definida. */
function humanize(value: string): string {
  const clean = value.replaceAll('_', ' ').trim()
  if (!clean) return '—'
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

function lookup(dictionary: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return dictionary[value] ?? humanize(value)
}

export const paymentMethodLabel = (v: string | null | undefined) => lookup(PAYMENT_METHOD_LABELS, v)
export const paymentStatusLabel = (v: string | null | undefined) => lookup(PAYMENT_STATUS_LABELS, v)
export const installmentStatusLabel = (v: string | null | undefined) =>
  lookup(INSTALLMENT_STATUS_LABELS, v)
export const loanStatusLabel = (v: string | null | undefined) => lookup(LOAN_STATUS_LABELS, v)
export const kycStatusLabel = (v: string | null | undefined) => lookup(KYC_STATUS_LABELS, v)
export const paymentLinkStatusLabel = (v: string | null | undefined) =>
  lookup(PAYMENT_LINK_STATUS_LABELS, v)
export const merchantStatusLabel = (v: string | null | undefined) =>
  lookup(MERCHANT_STATUS_LABELS, v)
export const disbursementStatusLabel = (v: string | null | undefined) =>
  lookup(DISBURSEMENT_STATUS_LABELS, v)

const CORE_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  frozen: 'Congelada',
  closed: 'Cerrada',
  PENDING: 'Pendiente',
  CREDITED: 'Acreditado',
  REJECTED: 'Rechazado',
  UNKNOWN_BUYER: 'Sin pagador',
  COMPLETED: 'Completada',
  CANCELLED: 'Anulada',
  FAILED: 'Fallida',
  EMITTED: 'Emitido',
  ACCEPTED: 'Aceptado',
  DEPOSITED: 'Depositado',
  open: 'Vigente',
  paid: 'Pagado',
  expired: 'Vencido',
  cancelled: 'Anulado',
}

export const coreStatusLabel = (v: string | null | undefined) => lookup(CORE_STATUS_LABELS, v)
