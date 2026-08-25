const TZ = 'America/Argentina/Buenos_Aires'
const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? null : d
}

function calendarInArgentina(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const month = Number(get('month'))
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return {
    year: get('year'),
    month,
    day: String(Number(get('day'))),
    hour,
    minute: get('minute'),
  }
}

function formatDocDate(d: Date) {
  const p = calendarInArgentina(d)
  const monthName = MONTHS_ES[p.month - 1]
  if (!monthName) return '—'
  return `${p.day} de ${monthName} de ${p.year}`
}

export function docDate(value: Date | string | null | undefined): string {
  const d = asDate(value)
  if (!d) return '—'
  return formatDocDate(d)
}

export function docDateShort(value: Date | string | null | undefined): string {
  const d = asDate(value)
  if (!d) return '—'
  const p = calendarInArgentina(d)
  return `${String(Number(p.day)).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`
}

export function docDateTime(value: Date | string | null | undefined): string {
  const d = asDate(value)
  if (!d) return '—'
  const p = calendarInArgentina(d)
  return `${formatDocDate(d)}, ${p.hour}:${p.minute}`
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
