export const INTIMATION_GRACE_DAYS = 30
export const MAX_REFINANCES = 2

export type MoraInstallment = {
  number: number
  amount: number
  dueDate: Date | string
  status: string
}

export function asMoraRows(
  rows: Array<{ number: number; amount: number | string; dueDate: Date | string; status: string }>,
): MoraInstallment[] {
  return rows.map((row) => ({
    number: row.number,
    amount: Number(row.amount) || 0,
    dueDate: row.dueDate,
    status: row.status,
  }))
}

export type IntimableRow = MoraInstallment & {
  daysLate: number
}

export type IntimationDecision = {
  ok: boolean
  reason: 'ok' | 'al_dia' | 'gracia' | 'refinanciada'
  message: string
  items: IntimableRow[]
  amount: number
}

function startOfDay(value: Date) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

function asDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function daysPastDue(dueDate: Date | string, now = new Date()) {
  const due = asDate(dueDate)
  if (!due) return 0
  const ms = startOfDay(now).getTime() - startOfDay(due).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function addMonths(from: Date, count: number) {
  const d = new Date(from)
  d.setMonth(d.getMonth() + count)
  d.setHours(0, 0, 0, 0)
  return d
}

export function money(value: number) {
  return Math.round(value * 100) / 100
}

/** Solo cuotas vencidas con 30 días o más, posteriores a la última refinanciación. */
export function intimableInstallments(
  rows: MoraInstallment[],
  lastRefinanceAt?: Date | string | null,
  now = new Date(),
): IntimableRow[] {
  const refinanceAt = lastRefinanceAt ? asDate(lastRefinanceAt) : null
  return rows
    .filter((row) => row.status !== 'paid')
    .map((row) => ({ ...row, amount: Number(row.amount) || 0, daysLate: daysPastDue(row.dueDate, now) }))
    .filter((row) => {
      if (row.daysLate < INTIMATION_GRACE_DAYS) return false
      const due = asDate(row.dueDate)
      if (!due) return false
      if (refinanceAt && startOfDay(due) <= startOfDay(refinanceAt)) return false
      return true
    })
    .sort((a, b) => a.number - b.number)
}

export function evaluateIntimation(
  rows: MoraInstallment[],
  lastRefinanceAt?: Date | string | null,
  now = new Date(),
): IntimationDecision {
  const overdue = rows.filter((row) => {
    if (row.status === 'paid') return false
    return row.status === 'overdue' || daysPastDue(row.dueDate, now) > 0
  })
  const items = intimableInstallments(rows, lastRefinanceAt, now)
  const amount = money(items.reduce((sum, row) => sum + row.amount, 0))

  if (!overdue.length && !items.length) {
    return {
      ok: false,
      reason: 'al_dia',
      message: 'El cliente está al día. No se puede intimar.',
      items: [],
      amount: 0,
    }
  }
  if (!items.length && lastRefinanceAt) {
    return {
      ok: false,
      reason: 'refinanciada',
      message: 'La mora anterior fue refinanciada. Solo se intima un nuevo atraso de 30 días o más.',
      items: [],
      amount: 0,
    }
  }
  if (!items.length) {
    return {
      ok: false,
      reason: 'gracia',
      message: `Hay vencimientos, pero todavía no cumplen ${INTIMATION_GRACE_DAYS} días. No se intima.`,
      items: [],
      amount: 0,
    }
  }
  return {
    ok: true,
    reason: 'ok',
    message: `${items.length} cuota(s) intimable(s) · ${INTIMATION_GRACE_DAYS} días o más de atraso`,
    items,
    amount,
  }
}

export type RefinanceDecision = {
  ok: boolean
  reason: 'ok' | 'al_dia' | 'tope' | 'cuotas'
  message: string
  unpaidCount: number
}

export function evaluateRefinance(
  rows: MoraInstallment[],
  used: number,
  now = new Date(),
): RefinanceDecision {
  const unpaid = rows.filter((row) => row.status !== 'paid')
  const overdue = unpaid.filter((row) => daysPastDue(row.dueDate, now) > 0)

  if (used >= MAX_REFINANCES) {
    return {
      ok: false,
      reason: 'tope',
      message: `Este crédito ya usó las ${MAX_REFINANCES} refinanciaciones permitidas.`,
      unpaidCount: unpaid.length,
    }
  }
  if (!overdue.length) {
    return {
      ok: false,
      reason: 'al_dia',
      message: 'El cliente está al día. No hay deuda para refinanciar.',
      unpaidCount: unpaid.length,
    }
  }
  if (unpaid.length < 2) {
    return {
      ok: false,
      reason: 'cuotas',
      message: 'Hace falta más de una cuota impaga para repartir el saldo.',
      unpaidCount: unpaid.length,
    }
  }
  return {
    ok: true,
    reason: 'ok',
    message: `Se reparte el saldo deudor en ${unpaid.length} cuotas iguales.`,
    unpaidCount: unpaid.length,
  }
}

export function splitBalanceEvenly(outstanding: number, count: number) {
  if (count <= 0) return []
  const base = money(outstanding / count)
  const amounts = Array.from({ length: count }, () => base)
  const drift = money(outstanding - base * count)
  amounts[count - 1] = money(amounts[count - 1] + drift)
  return amounts
}
