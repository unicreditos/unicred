/** Etiquetas en español para los valores que se guardan como enums en la base. */

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
  payway_qr: 'QR UNICRÉDITOS',
  payway_wallet: 'Billetera UNICRÉDITOS',
  payway_card: 'Tarjeta',
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

export const installmentStatusLabel = (v: string | null | undefined) =>
  lookup(INSTALLMENT_STATUS_LABELS, v)

export const kycStatusLabel = (v: string | null | undefined) => lookup(KYC_STATUS_LABELS, v)

