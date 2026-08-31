import { computeFrenchAmortization, type Amortization } from '@/lib/finance'

/** Campos de tasa que van al crédito y al mutuo (Ley 24.240 art. 36). */
export function loanPricingFields(amort: Amortization) {
  return {
    tna: String(amort.tna),
    tea: String(amort.tea),
    cft: String(amort.cft),
    installmentAmount: String(amort.installmentAmount),
    totalAmount: String(amort.totalAmount),
  }
}

/** TEA persistida o, si el crédito es anterior al campo, recalculada de la TEM. */
export function resolvedTea(opts: {
  tea?: string | number | null
  monthlyRate: string | number
}) {
  const stored = Number(opts.tea)
  if (Number.isFinite(stored) && stored > 0) return stored
  const tem = Number(opts.monthlyRate)
  if (!Number.isFinite(tem) || tem < 0) return 0
  return computeFrenchAmortization(100_000, 12, tem).tea
}
