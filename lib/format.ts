import { formatMoney } from '@/lib/money'

const TZ = 'America/Argentina/Buenos_Aires'

// Zona fija: en producción el server corre en UTC y el navegador en AR; sin esto la fecha
// cambia entre el render de servidor y el de cliente. hour12:false evita además el separador
// "a. m./p. m." que Node y Chromium arman distinto y rompe la hidratación.
const dateFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function toDate(value: Date | string | number | null | undefined) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value: Date | string | number | null | undefined) {
  const d = toDate(value)
  return d ? dateFmt.format(d) : '—'
}

export function formatDateTime(value: Date | string | number | null | undefined) {
  const d = toDate(value)
  return d ? dateTimeFmt.format(d) : '—'
}

export function formatArs(value: number | string | null | undefined) {
  return Number.isFinite(Number(value)) ? formatMoney(value) : '—'
}

/** 1234567890123456789012 → "12345678 90123456789012" no: se agrupa como 8-14. */
export function formatCbu(value: string | null | undefined) {
  const s = String(value ?? '').replace(/\D/g, '')
  if (s.length !== 22) return value ?? '—'
  return `${s.slice(0, 8)} ${s.slice(8)}`
}

export function maskCbu(value: string | null | undefined) {
  const s = String(value ?? '').replace(/\D/g, '')
  if (s.length !== 22) return '—'
  return `${s.slice(0, 3)}••••••••••••••••${s.slice(-3)}`
}
