import { addDaysAR, arParts, daysInMonth, arWallTimeToInstant, arDateKey, endOfDayAR, parseDateOnly, startOfDayAR } from '@/lib/date-ar'
import type { Credit, Disbursement, LoanApplication } from './types'

export type PeriodPreset =
  | 'current_month'
  | 'last_30_days'
  | 'last_month'
  | 'quarter'
  | 'year'
  | 'all'
  | 'custom'

export interface DateRange {
  preset: PeriodPreset
  from: Date | null
  to: Date | null
  fromStr: string
  toStr: string
  label: string
}

export interface SummaryMetrics {
  totalProcessed: number
  approvedCount: number
  rejectedCount: number
  cancelledCount: number
  processedApplications: LoanApplication[]
  totalDisbursed: number
  disbursedCount: number
  disbursedApplications: LoanApplication[]
  avgDisbursed: number
  approvalRate: number
  allProcessedCount: number
  allDisbursedAmount: number
}

/** Formatea una fecha local a YYYY-MM-DD para inputs HTML type="date" */
export function toInputDate(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return ''
  // Dia civil argentino (no el del huso de la maquina).
  return arDateKey(d)
}

/** Parsea un string YYYY-MM-DD o DD/MM/YYYY a Date */
export function parseDateInput(s: string | null | undefined, endOfDay = false): Date | null {
  if (!s || typeof s !== 'string') return null
  const clean = s.trim()
  if (!clean) return null

  // YYYY-MM-DD o DD/MM/YYYY = dia civil argentino (00:00 o 23:59:59.999 AR).
  const dayStart = parseDateOnly(clean)
  if (dayStart) return endOfDay ? endOfDayAR(dayStart) : dayStart

  const fallback = new Date(clean)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Resuelve el rango de fechas para un preset determinado o valores custom.
 */
export function resolveDateRange(
  preset: PeriodPreset = 'current_month',
  customFromStr?: string,
  customToStr?: string,
  refDate: Date = new Date(),
): DateRange {
  const ref = arParts(refDate)
  const y = ref.year
  const m = ref.month - 1

  if (preset === 'custom' && (customFromStr || customToStr)) {
    const from = parseDateInput(customFromStr, false)
    const to = parseDateInput(customToStr, true)
    const fromFormatted = toInputDate(from)
    const toFormatted = toInputDate(to)
    let label = 'Rango personalizado'
    if (fromFormatted && toFormatted) {
      label = `${fromFormatted} al ${toFormatted}`
    } else if (fromFormatted) {
      label = `Desde ${fromFormatted}`
    } else if (toFormatted) {
      label = `Hasta ${toFormatted}`
    }
    return {
      preset: 'custom',
      from,
      to,
      fromStr: fromFormatted,
      toStr: toFormatted,
      label,
    }
  }

  switch (preset) {
    case 'last_30_days': {
      const from = startOfDayAR(addDaysAR(refDate, -30))
      const to = endOfDayAR(refDate)
      return {
        preset: 'last_30_days',
        from,
        to,
        fromStr: toInputDate(from),
        toStr: toInputDate(to),
        label: 'Últimos 30 días',
      }
    }

    case 'last_month': {
      const lastMonthYear = m === 0 ? y - 1 : y
      const lastMonthIdx = m === 0 ? 11 : m - 1
      const from = arWallTimeToInstant(lastMonthYear, lastMonthIdx + 1, 1)
      const to = arWallTimeToInstant(lastMonthYear, lastMonthIdx + 1, daysInMonth(lastMonthYear, lastMonthIdx + 1), 23, 59, 59, 999)
      return {
        preset: 'last_month',
        from,
        to,
        fromStr: toInputDate(from),
        toStr: toInputDate(to),
        label: `${MONTH_NAMES[lastMonthIdx]} ${lastMonthYear} (Mes anterior)`,
      }
    }

    case 'quarter': {
      const from = startOfDayAR(addDaysAR(refDate, -90))
      const to = endOfDayAR(refDate)
      return {
        preset: 'quarter',
        from,
        to,
        fromStr: toInputDate(from),
        toStr: toInputDate(to),
        label: 'Último trimestre (90 días)',
      }
    }

    case 'year': {
      const from = arWallTimeToInstant(y, 1, 1)
      const to = arWallTimeToInstant(y, 12, 31, 23, 59, 59, 999)
      return {
        preset: 'year',
        from,
        to,
        fromStr: toInputDate(from),
        toStr: toInputDate(to),
        label: `Año ${y}`,
      }
    }

    case 'all': {
      return {
        preset: 'all',
        from: null,
        to: null,
        fromStr: '',
        toStr: '',
        label: 'Histórico completo',
      }
    }

    case 'current_month':
    default: {
      const from = arWallTimeToInstant(y, m + 1, 1)
      const to = arWallTimeToInstant(y, m + 1, daysInMonth(y, m + 1), 23, 59, 59, 999)
      return {
        preset: 'current_month',
        from,
        to,
        fromStr: toInputDate(from),
        toStr: toInputDate(to),
        label: `${MONTH_NAMES[m]} ${y} (Mes en curso)`,
      }
    }
  }
}

/** Fecha sin hora ('2026-05-12') = dia civil argentino; el resto, un instante normal. */
function asInstant(raw: string | Date): Date {
  if (raw instanceof Date) return raw
  return parseDateOnly(raw) ?? new Date(raw)
}

/**
 * Determina si una fecha está dentro del rango [from, to].
 */
export function isDateInRange(
  dateInput: string | Date | null | undefined,
  from: Date | null,
  to: Date | null,
): boolean {
  if (!dateInput) return false
  const d = asInstant(dateInput)
  if (Number.isNaN(d.getTime())) return false
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

/**
 * Obtiene la fecha efectiva de desembolso para una solicitud.
 */
export function getApplicationDisbursementDate(
  app: LoanApplication,
  credits: Credit[],
  disbursements: Disbursement[],
): Date | null {
  // 1. Desembolso completado
  const disb = disbursements.find(
    (d) => d.creditId === app.id && d.status === 'completed',
  )
  if (disb) {
    const raw = disb.completedAt || disb.requestedAt
    if (raw) {
      const d = asInstant(raw)
      if (!Number.isNaN(d.getTime())) return d
    }
  }

  // 2. Crédito asociado
  const credit = credits.find((c) => c.applicationId === app.id || c.id === app.id)
  if (credit) {
    if (credit.disbursedAt) {
      const d = asInstant(credit.disbursedAt)
      if (!Number.isNaN(d.getTime())) return d
    }
    if (credit.status !== 'cancelled' && (app.decidedAt || app.createdAt)) {
      const d = asInstant(app.decidedAt || app.createdAt!)
      if (!Number.isNaN(d.getTime())) return d
    }
  }

  // 3. Solicitud aprobada
  if (app.status === 'approved' && (app.decidedAt || app.createdAt)) {
    const d = asInstant(app.decidedAt || app.createdAt!)
    if (!Number.isNaN(d.getTime())) return d
  }

  return null
}

/**
 * Calcula las métricas de solicitudes procesadas y monto desembolsado
 * filtradas según el rango de fechas.
 */
export function calculateSummaryMetrics(
  applications: LoanApplication[],
  credits: Credit[],
  disbursements: Disbursement[],
  range: { from: Date | null; to: Date | null },
): SummaryMetrics {
  const { from, to } = range

  // 1. Todas las solicitudes procesadas (status !== 'pending')
  const allProcessed = applications.filter((a) => a.status !== 'pending')
  const allProcessedCount = allProcessed.length

  // Solicitudes procesadas dentro del periodo
  const processedApplications = allProcessed.filter((a) => {
    // Si no hay límites (preset 'all'), entran todas
    if (!from && !to) return true
    const dt = a.decidedAt || a.createdAt
    return isDateInRange(dt, from, to)
  })

  const totalProcessed = processedApplications.length
  const approvedCount = processedApplications.filter((a) => a.status === 'approved').length
  const rejectedCount = processedApplications.filter((a) => a.status === 'rejected').length
  const cancelledCount = processedApplications.filter((a) => a.status === 'cancelled').length

  // 2. Desembolsos dentro del periodo a partir de state.applications
  const disbursedApplications = applications.filter((a) => {
    const disbDate = getApplicationDisbursementDate(a, credits, disbursements)
    if (!disbDate) return false
    if (!from && !to) return true
    return isDateInRange(disbDate, from, to)
  })

  const totalDisbursed = disbursedApplications.reduce((acc, a) => acc + (a.amount || 0), 0)
  const disbursedCount = disbursedApplications.length
  const avgDisbursed = disbursedCount > 0 ? Math.round(totalDisbursed / disbursedCount) : 0

  // Histórico total desembolsado
  const allDisbursed = applications.filter((a) =>
    Boolean(getApplicationDisbursementDate(a, credits, disbursements)),
  )
  const allDisbursedAmount = allDisbursed.reduce((acc, a) => acc + (a.amount || 0), 0)

  const approvalRate = totalProcessed > 0 ? Math.round((approvedCount / totalProcessed) * 100) : 0

  return {
    totalProcessed,
    approvedCount,
    rejectedCount,
    cancelledCount,
    processedApplications,
    totalDisbursed,
    disbursedCount,
    disbursedApplications,
    avgDisbursed,
    approvalRate,
    allProcessedCount,
    allDisbursedAmount,
  }
}
