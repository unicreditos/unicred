/**
 * Fechas en hora de Argentina (America/Argentina/Buenos_Aires, hoy UTC-03:00 fijo, sin horario de verano).
 *
 * Por que existe: el servidor (Vercel) corre en UTC. Todo lo que usa getDate()/setHours()/
 * toISOString().slice(0, 10)/toLocaleDateString() sin timeZone calcula "el dia" en UTC, y entre las
 * 21:00 y las 23:59 de Argentina ya es el dia siguiente. Este modulo es la UNICA fuente para
 * "hoy", inicio/fin de dia, sumar dias/meses, diferencia de dias y formato dd/mm/aaaa.
 *
 * Regla: nunca se suman offsets a mano. Se usa Intl con timeZone, asi que si Argentina vuelve a
 * tener horario de verano, el modulo sigue siendo correcto. Modulo puro (sin base de datos).
 *
 * Convenciones:
 * - "Fecha civil" = string 'AAAA-MM-DD' (columnas date o fechas de vencimiento sin hora).
 * - Un instante (Date) se convierte a su fecha civil argentina con arDateKey().
 * - startOfDayAR('2026-10-09') = 2026-10-09T00:00-03:00 = 2026-10-09T03:00:00Z.
 */
export const AR_TZ = 'America/Argentina/Buenos_Aires'
const DAY_MS = 86_400_000

export type ArParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

let partsFmt: Intl.DateTimeFormat | null = null
function fmt(): Intl.DateTimeFormat {
  if (!partsFmt) {
    partsFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: AR_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }
  return partsFmt
}

function toDate(input: Date | string | number): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return parseDateOnly(input.trim())
  }
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Componentes de calendario y reloj de un instante, vistos en Argentina. */
export function arParts(input: Date | string | number): ArParts {
  const d = toDate(input)
  if (!d) throw new RangeError('Fecha invalida')
  const out: Record<string, number> = {}
  for (const p of fmt().formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  }
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** Fecha civil argentina 'AAAA-MM-DD' de un instante. Reemplaza a toISOString().slice(0, 10). */
export function arDateKey(input: Date | string | number = new Date()): string {
  const p = arParts(input)
  return `${String(p.year).padStart(4, '0')}-${p2(p.month)}-${p2(p.day)}`
}

/** "Hoy" en Argentina como 'AAAA-MM-DD'. */
export function todayAR(now: Date = new Date()): string {
  return arDateKey(now)
}

/** 'AAAA-MM' en hora argentina. */
export function arMonthKey(input: Date | string | number): string {
  return arDateKey(input).slice(0, 7)
}

/** Dia valido del calendario (descarta 2026-02-30). */
export function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Offset (ms) de Argentina respecto de UTC en un instante dado (negativo: atras de UTC). */
function offsetAt(instantMs: number): number {
  const p = arParts(new Date(instantMs))
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instantMs / 1000) * 1000
}

/** Instante que corresponde a una hora de pared argentina. */
export function arWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  let guess = naive - offsetAt(naive)
  guess = naive - offsetAt(guess) // segunda pasada: correcto aunque cruce un cambio de offset
  return new Date(guess)
}

/** Parsea 'AAAA-MM-DD' o 'DD/MM/AAAA' como fecha civil argentina (00:00 AR). null si no es una fecha real. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || typeof value !== 'string') return null
  const s = value.trim()
  let y: number, m: number, d: number
  let mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (mt) {
    y = +mt[1]
    m = +mt[2]
    d = +mt[3]
  } else if ((mt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) {
    d = +mt[1]
    m = +mt[2]
    y = +mt[3]
  } else {
    return null
  }
  if (!isValidYmd(y, m, d)) return null
  return arWallTimeToInstant(y, m, d)
}

/** Como parseDateOnly pero devuelve el string 'AAAA-MM-DD' normalizado. */
export function normalizeDateOnly(value: string | null | undefined): string | null {
  const d = parseDateOnly(value)
  return d ? arDateKey(d) : null
}

/** Inicio del dia argentino (00:00:00.000 AR) que contiene al instante / fecha civil. */
export function startOfDayAR(input: Date | string | number = new Date()): Date {
  const p = arParts(toDate(input) ?? new Date(NaN))
  return arWallTimeToInstant(p.year, p.month, p.day)
}

/** Ultimo milisegundo del dia argentino (23:59:59.999 AR). */
export function endOfDayAR(input: Date | string | number = new Date()): Date {
  const p = arParts(toDate(input) ?? new Date(NaN))
  return arWallTimeToInstant(p.year, p.month, p.day, 23, 59, 59, 999)
}

export function startOfMonthAR(input: Date | string | number = new Date()): Date {
  const p = arParts(input)
  return arWallTimeToInstant(p.year, p.month, 1)
}

export function endOfMonthAR(input: Date | string | number = new Date()): Date {
  const p = arParts(input)
  return arWallTimeToInstant(p.year, p.month, daysInMonth(p.year, p.month), 23, 59, 59, 999)
}

/**
 * Suma dias de calendario conservando la hora de pared argentina.
 * (No suma 24 h: si algun dia cambia el offset, igual cae el mismo dia y hora.)
 */
export function addDaysAR(input: Date | string | number, days: number): Date {
  const p = arParts(toDate(input) ?? new Date(NaN))
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days))
  return arWallTimeToInstant(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    p.hour,
    p.minute,
    p.second,
  )
}

/**
 * Suma meses de calendario conservando el dia local; si el mes destino no tiene ese dia se
 * recorta al ultimo (31/01 + 1 mes = 28/02, no 03/03 como hace Date#setMonth). Conserva la hora.
 */
export function addMonthsAR(input: Date | string | number, months: number): Date {
  const p = arParts(toDate(input) ?? new Date(NaN))
  const total = p.year * 12 + (p.month - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const day = Math.min(p.day, daysInMonth(year, month))
  return arWallTimeToInstant(year, month, day, p.hour, p.minute, p.second)
}

/** Igual que addMonthsAR pero devuelve el vencimiento a las 00:00 AR (fecha civil, sin hora). */
export function addMonthsDateOnlyAR(input: Date | string | number, months: number): Date {
  return startOfDayAR(addMonthsAR(input, months))
}

/** Dias CIVILES entre dos instantes/fechas (b - a), contados en Argentina. */
export function diffDaysAR(a: Date | string | number, b: Date | string | number): number {
  const pa = arParts(toDate(a) ?? new Date(NaN))
  const pb = arParts(toDate(b) ?? new Date(NaN))
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / DAY_MS)
}

/** Dias de atraso (calendario argentino): 0 el dia del vencimiento, 1 al dia siguiente. Negativo si falta. */
export function daysPastDueAR(due: Date | string | number, now: Date = new Date()): number {
  return diffDaysAR(due, now)
}

/** dd/mm/aaaa en hora argentina. */
export function formatDMY(input: Date | string | number | null | undefined, empty = '—'): string {
  if (input == null || input === '') return empty
  const d = toDate(input)
  if (!d) return empty
  const p = arParts(d)
  return `${p2(p.day)}/${p2(p.month)}/${String(p.year).padStart(4, '0')}`
}

/** dd/mm/aaaa HH:mm en hora argentina. */
export function formatDMYHM(input: Date | string | number | null | undefined, empty = '—'): string {
  if (input == null || input === '') return empty
  const d = toDate(input)
  if (!d) return empty
  const p = arParts(d)
  return `${formatDMY(d)} ${p2(p.hour)}:${p2(p.minute)}`
}

/** Fecha civil 'AAAA-MM-DD' (columna date) a dd/mm/aaaa, sin pasar por ningun huso. */
export function formatDateOnly(value: string | null | undefined, empty = '—'): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : empty
}

/** AAAAMMDD en hora argentina (ARCA, numeros de comprobante). */
export function arCompactDate(input: Date | string | number = new Date()): string {
  return arDateKey(input).replace(/-/g, '')
}

/** ISO 8601 con offset argentino ('2026-10-09T21:30:00-03:00'), para ARCA. Usa el offset real del instante. */
export function toArIsoWithOffset(input: Date | string | number = new Date()): string {
  const d = toDate(input)
  if (!d) throw new RangeError('Fecha invalida')
  const p = arParts(d)
  const off = Math.round(offsetAt(d.getTime()) / 60000)
  const sign = off < 0 ? '-' : '+'
  const abs = Math.abs(off)
  return `${arDateKey(d)}T${p2(p.hour)}:${p2(p.minute)}:${p2(p.second)}${sign}${p2(Math.floor(abs / 60))}:${p2(abs % 60)}`
}
/** Suma anios a una fecha civil 'AAAA-MM-DD' (29/02 + 1 anio = 28/02). Sin husos: es aritmetica de calendario. */
export function addYearsToDateKey(key: string, years: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) throw new RangeError('Fecha civil invalida: ' + key)
  const year = Number(m[1]) + years
  const month = Number(m[2])
  const day = Math.min(Number(m[3]), daysInMonth(year, month))
  return `${String(year).padStart(4, '0')}-${m[2]}-${p2(day)}`
}

/**
 * Fecha civil 'AAAA-MM-DD' de un valor "solo fecha" guardado en una columna timestamptz.
 * Compatibilidad: antes del arreglo, new Date('AAAA-MM-DD') guardaba 00:00 UTC; ese valor exacto se lee
 * como su fecha UTC (la que el usuario escribio). Lo nuevo se guarda a las 00:00 AR (03:00Z) y se lee en AR.
 */
export function dateOnlyKey(input: Date | string | number): string {
  const d = toDate(input)
  if (!d) throw new RangeError('Fecha invalida')
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return d.toISOString().slice(0, 10)
  }
  return arDateKey(d)
}
