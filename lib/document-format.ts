const TZ = 'America/Argentina/Buenos_Aires'

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? null : d
}

export function docDate(value: Date | string | null | undefined): string {
  const d = asDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function docDateTime(value: Date | string | null | undefined): string {
  const d = asDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function docShortId(id: string | null | undefined, length = 10): string {
  const raw = String(id ?? '').replace(/-/g, '').toUpperCase()
  if (!raw) return '—'
  return raw.slice(0, length)
}

export function installmentStatusLabel(status: string) {
  if (status === 'paid') return 'Pagada'
  if (status === 'overdue') return 'Vencida'
  if (status === 'partial') return 'Parcial'
  if (status === 'cancelled') return 'Anulada'
  return 'Pendiente'
}

export function contractStatusLabel(status: string) {
  if (status === 'accepted') return 'Aceptado'
  if (status === 'rejected') return 'Rechazado'
  if (status === 'pending_acceptance') return 'Pendiente de firma'
  return (status || 'Emitido').replace(/_/g, ' ')
}

export function paymentMethodLabel(method: string | null | undefined) {
  const map: Record<string, string> = {
    transferencia_bancaria: 'Transferencia bancaria',
    mercado_pago: 'Mercado Pago',
    debito_automatico: 'Débito automático',
    efectivo: 'Efectivo',
    tarjeta_credito: 'Tarjeta de crédito',
    tarjeta_debito: 'Tarjeta de débito',
    bank_transfer: 'Transferencia bancaria',
    cbu: 'Transferencia CBU',
    cvu: 'Transferencia CVU',
    wallet: 'Transferencia',
    link_pago: 'Mercado Pago',
  }
  if (!method) return '—'
  return map[method] ?? method.replace(/_/g, ' ')
}
