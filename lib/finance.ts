// Utilidades financieras para el cálculo de préstamos en cuotas (sistema francés).

import { frenchInstallmentSplit } from '@/lib/legal/money-words'

export type Amortization = {
  installmentAmount: number
  totalAmount: number
  totalInterest: number
  tna: number
  tea: number
  cft: number
  schedule: { number: number; amount: number }[]
}

export const IVA_INTERESES = 0.21

/** CFT informado = TEA con IVA sobre intereses, sin gastos ni seguros extra. */
export function estimatedCftFromMonthlyRate(monthlyRatePercent: number): number {
  if (!Number.isFinite(monthlyRatePercent) || monthlyRatePercent <= 0) return 0
  return computeFrenchAmortization(100_000, 12, monthlyRatePercent).cft
}

/**
 * Sistema francés de amortización: cuota fija.
 * @param principal  Capital solicitado
 * @param term       Cantidad de cuotas (meses)
 * @param monthlyRate Tasa de interés mensual en porcentaje (ej: 7.5 = 7,5%)
 */
export function computeFrenchAmortization(
  principal: number,
  term: number,
  monthlyRate: number,
): Amortization {
  const i = monthlyRate / 100
  const installmentAmount =
    i === 0
      ? principal / term
      : (principal * (i * Math.pow(1 + i, term))) / (Math.pow(1 + i, term) - 1)

  const roundedInstallment = Math.round(installmentAmount * 100) / 100
  const totalAmount = Math.round(roundedInstallment * term * 100) / 100
  const totalInterest = Math.round((totalAmount - principal) * 100) / 100

  const tna = Math.round(i * 12 * 100 * 100) / 100
  const tea = Math.round((Math.pow(1 + i, 12) - 1) * 100 * 100) / 100
  const cft = Math.round(tea * (1 + IVA_INTERESES) * 100) / 100

  const schedule = Array.from({ length: term }, (_, idx) => ({
    number: idx + 1,
    amount: roundedInstallment,
  }))

  return {
    installmentAmount: roundedInstallment,
    totalAmount,
    totalInterest,
    tna,
    tea,
    cft,
    schedule,
  }
}

export type AmortizationRow = {
  number: number
  installment: number
  interest: number
  capital: number
  balance: number
}

/** Tabla francesa: capital, interés y saldo por cuota. */
export function frenchAmortizationSchedule(
  principal: number,
  monthlyRatePct: number,
  term: number,
): AmortizationRow[] {
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isInteger(term) || term < 1) return []
  return Array.from({ length: term }, (_, idx) => {
    const split = frenchInstallmentSplit(principal, monthlyRatePct, term, idx + 1)
    return {
      number: idx + 1,
      installment: split.installment,
      interest: split.interest,
      capital: split.capital,
      balance: split.balance,
    }
  })
}

/**
 * Capital máximo que admite una cuota tope (inversa del sistema francés).
 */
export function maxPrincipalFromInstallment(
  maxInstallment: number,
  term: number,
  monthlyRate: number,
): number {
  if (!Number.isFinite(maxInstallment) || maxInstallment <= 0) return 0
  if (!Number.isInteger(term) || term < 1) return 0
  const i = monthlyRate / 100
  if (!Number.isFinite(i) || i < 0) return 0
  if (i === 0) return Math.floor(maxInstallment * term)
  const factor = (Math.pow(1 + i, term) - 1) / (i * Math.pow(1 + i, term))
  return Math.floor(maxInstallment * factor)
}

export function formatARS(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(isNaN(n) ? 0 : n)
}

export function formatARSDecimal(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n)
}

export function formatPercent(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(isNaN(n) ? 0 : n)}%`
}

export function formatCBU(cbu: string) {
  const s = String(cbu ?? '').replace(/\D/g, '')
  if (s.length !== 22) return cbu
  return `${s.slice(0, 8)} ${s.slice(8, 14)} ${s.slice(14)}`
}

export function formatCVU(cvu: string) {
  const s = String(cvu ?? '').replace(/\D/g, '')
  if (s.length !== 22) return cvu
  return `${s.slice(0, 8)} ${s.slice(8, 14)} ${s.slice(14)}`
}

/** Alias Coelsa/ArgenAPI: sin @, minúsculas, 6-20, letras/números/punto. */
export function normalizeBankAlias(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 20)
}

export function isValidBankAlias(alias: string): boolean {
  return /^[a-z0-9.]{6,20}$/.test(alias)
}

export function formatAlias(a: string) {
  return normalizeBankAlias(a)
}

export function displayAlias(a: string | null | undefined): string {
  const n = normalizeBankAlias(a ?? '')
  return n ? `@${n}` : '—'
}

export function formatDateArg(d: Date | string | null | undefined) {
  if (!d) return '—'
  try {
    const dt = typeof d === 'string' ? new Date(d) : d
    if (isNaN(dt.getTime())) return String(d)
    return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return String(d)
  }
}

export function formatDateTimeArg(d: Date | string | null | undefined) {
  if (!d) return '—'
  try {
    const dt = typeof d === 'string' ? new Date(d) : d
    if (isNaN(dt.getTime())) return String(d)
    return dt.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(d)
  }
}
