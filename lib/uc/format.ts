/**
 * Formatos es-AR de los paneles. Todo con huso fijo de Buenos Aires: así el
 * servidor (UTC) y el navegador dibujan el mismo texto y React no rompe la hidratación.
 */
const TZ = 'America/Argentina/Buenos_Aires'

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })
const int = new Intl.NumberFormat('es-AR')
const pct = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ })
const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
const longFmt = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
})

const nbsp = / | /g

export const money = (n: number | string | null | undefined) => ars.format(Number(n) || 0).replace(nbsp, ' ')
export const fmtInt = (n: number | string | null | undefined) => int.format(Number(n) || 0).replace(nbsp, ' ')
export const fmtPct = (n: number | string | null | undefined) => `${pct.format(Number(n) || 0).replace(nbsp, ' ')} %`

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  const x = d instanceof Date ? d : new Date(d)
  return Number.isNaN(x.getTime()) ? null : x
}

export function fdate(d: Date | string | null | undefined, empty = '—') {
  const x = toDate(d)
  return x ? dateFmt.format(x).replace(nbsp, ' ') : empty
}

export function fdatetime(d: Date | string | null | undefined, empty = '—') {
  const x = toDate(d)
  return x ? `${dateFmt.format(x)} ${timeFmt.format(x)}`.replace(nbsp, ' ') : empty
}

export function longDate(d: Date = new Date()) {
  const t = longFmt.format(d)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Texto sin acentos y en minúscula, para buscar. */
export const norm = (s: string) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** dd/mm/aaaa → Date a las 00:00 de Buenos Aires (o null si no es una fecha real). */
export function parseDMY(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (!m) return null
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00-03:00`)
  if (Number.isNaN(d.getTime())) return null
  const back = dateFmt.format(d)
  return back === s ? d : null
}

export function daysBetween(a: Date | string, b: Date | string) {
  const x = toDate(a)
  const y = toDate(b)
  if (!x || !y) return 0
  return Math.round((y.getTime() - x.getTime()) / 86_400_000)
}

/** Cuota mensual del sistema francés (aprox., para estimar la relación cuota/ingreso). */
export function cuotaFrancesa(capital: number, cuotas: number, tnaPct: number) {
  const i = tnaPct / 100 / 12
  if (!cuotas) return 0
  return i === 0 ? capital / cuotas : (capital * i) / (1 - Math.pow(1 + i, -cuotas))
}
