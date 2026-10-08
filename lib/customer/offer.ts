import { computeCreditOffer, SCORE_REJECT_BELOW } from '@/lib/loan-underwriting'

type ProductLike = {
  minAmount?: unknown
  maxAmount?: unknown
  minTerm?: number | null
  maxTerm?: number | null
  monthlyRate?: unknown
}

/**
 * Estimación (orientativa) de la línea preaprobada que se muestra en el inicio.
 * La oferta firme sale al solicitar: acá solo se informa el techo estimado.
 */
export function estimateLine(
  profile: { monthlyIncome?: unknown; creditScore?: number | null } | null,
  products: ProductLike[],
  loans: { status?: string | null }[],
  installments: { status?: string | null }[],
  bcraScore?: number | null,
): { amount: number; term: number } | null {
  const product = [...products].sort((a, b) => Number(a.minAmount) - Number(b.minAmount))[0]
  if (!product) return null
  const monthlyIncome = Number(profile?.monthlyIncome ?? 0)
  const raw = profile?.creditScore ?? bcraScore ?? null
  const score = raw == null || raw < SCORE_REJECT_BELOW ? 650 : raw
  const term = Math.min(Math.max(Number(product.minTerm) || 6, 12), Number(product.maxTerm) || 24)
  const offer = computeCreditOffer({
    score,
    monthlyIncome: monthlyIncome > 0 ? monthlyIncome : 300_000,
    term,
    monthlyRate: Number(product.monthlyRate),
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    history: {
      paidCount: installments.filter((row) => row.status === 'paid').length,
      overdueCount: installments.filter((row) => row.status === 'overdue').length,
      completedLoans: loans.filter((row) => row.status === 'paid').length,
    },
  })
  return offer.eligible ? { amount: offer.maxAmount, term } : null
}
