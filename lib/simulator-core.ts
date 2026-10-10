// Logica pura del simulador publico (home y /simulador). Sin React ni DB.
// El calculo NO se reimplementa: usa computeFrenchAmortization / frenchAmortizationSchedule
// de lib/finance.ts, las mismas funciones con las que se arma el credito real.

import { computeFrenchAmortization, frenchAmortizationSchedule } from '@/lib/finance'

/** Plazos que el simulador ofrece como botones; se filtran por el minimo/maximo del producto. */
export const SIM_TERM_CANDIDATES = [3, 6, 9, 12, 18, 24, 36, 48] as const

/** Paso del control deslizante (ARS). */
export const SIM_AMOUNT_STEP = 10_000

export type SimProduct = {
  minAmount: number
  maxAmount: number
  minTerm: number
  maxTerm: number
  monthlyRate: number
}

/** Plazos ofrecidos: candidatos dentro de [minTerm, maxTerm]; siempre incluye el minimo y el maximo del producto. */
export function termOptionsFor(p: Pick<SimProduct, 'minTerm' | 'maxTerm'>): number[] {
  const set = new Set<number>([p.minTerm, p.maxTerm])
  for (const t of SIM_TERM_CANDIDATES) if (t >= p.minTerm && t <= p.maxTerm) set.add(t)
  return [...set].sort((a, b) => a - b)
}

/** Lleva un monto al rango del producto y al paso del control (sin pasarse del maximo). */
export function clampAmount(value: number, p: Pick<SimProduct, 'minAmount' | 'maxAmount'>): number {
  if (!Number.isFinite(value)) return p.minAmount
  const bounded = Math.min(p.maxAmount, Math.max(p.minAmount, value))
  const stepped = p.minAmount + Math.round((bounded - p.minAmount) / SIM_AMOUNT_STEP) * SIM_AMOUNT_STEP
  return Math.min(p.maxAmount, Math.max(p.minAmount, stepped))
}

export type AmountParse = { ok: true; value: number } | { ok: false; error: string }

const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`

/** Interpreta lo que escribe la persona ("500.000", "$ 500000", "500000,00"). No inventa valores: si no sirve, informa por que. */
export function parseAmountInput(raw: string, p: Pick<SimProduct, 'minAmount' | 'maxAmount'>): AmountParse {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: false, error: 'Ingresá un monto.' }
  // admite separador de miles "." y decimales ",": se descartan los centavos (el simulador trabaja en pesos enteros)
  const noDecimals = text.replace(/,\d{1,2}$/, '')
  const digits = noDecimals.replace(/[^\d]/g, '')
  if (!digits || /[^\d.\s$]/.test(noDecimals.replace(/\./g, ''))) {
    return { ok: false, error: 'Ingresá solo números, por ejemplo 500000.' }
  }
  const value = Number(digits)
  if (!Number.isSafeInteger(value)) return { ok: false, error: 'El monto es demasiado grande.' }
  if (value < p.minAmount || value > p.maxAmount) {
    return { ok: false, error: `El monto debe estar entre ${fmt(p.minAmount)} y ${fmt(p.maxAmount)}.` }
  }
  return { ok: true, value }
}

export type Simulation = ReturnType<typeof computeFrenchAmortization> & {
  rows: ReturnType<typeof frenchAmortizationSchedule>
}

/** Cuota, totales, TNA/TEA/CFT (tal cual los calcula lib/finance.ts) y tabla de amortizacion. */
export function simulate(p: Pick<SimProduct, 'monthlyRate'>, amount: number, term: number): Simulation {
  const amort = computeFrenchAmortization(amount, term, p.monthlyRate)
  return { ...amort, rows: frenchAmortizationSchedule(amount, p.monthlyRate, term) }
}