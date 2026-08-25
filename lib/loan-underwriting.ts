/**
 * Motor de originación / underwriting.
 * Flujo: scoring + capacidad → oferta acotada → solicitud → calificado/rechazo/revisión
 * → firma de contrato → cola de desembolso → activo (vigente).
 */

import type { ScoreResult } from '@/lib/bcra'
import { maxPrincipalFromInstallment } from '@/lib/finance'

export const OPEN_LOAN_STATUSES = ['pending', 'approved', 'active'] as const

/** Score mínimo para no rechazar automáticamente. */
export const SCORE_REJECT_BELOW = 560

/** Score mínimo para calificar automáticamente (sin cola manual). */
export const SCORE_AUTO_QUALIFY_AT = 640

/** Tope de cuota vs ingresos declarados. */
export const INCOME_DTI_RATIO = 0.35

/**
 * Primer crédito en la app: techo duro aunque el score/capacidad permitan más.
 * Montos altos se desbloquean con cumplimiento de cuotas.
 */
export const FIRST_CREDIT_HARD_CAP = 400_000

export type UnderwriteDecision =
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'pending_review'; reason: string }
  | { outcome: 'qualified'; reason: string }

export type AppRepaymentHistory = {
  /** Cuotas pagadas en la app. */
  paidCount: number
  /** Cuotas vencidas (impagas o pagadas tarde si el estado quedó overdue). */
  overdueCount: number
  /** Créditos con status paid (ciclo completo). */
  completedLoans: number
}

export type CreditOffer = {
  eligible: boolean
  maxAmount: number
  maxInstallment: number
  capacityPrincipal: number
  scoreCap: number
  historyCap: number
  productCap: number
  bindingLimit: 'score' | 'capacity' | 'history' | 'product' | 'ineligible'
  reason: string
}

/** Fracción del tope de línea del producto según score (antes de historial). */
export function scoreTierCatalogFraction(score: number): number {
  if (score < SCORE_REJECT_BELOW) return 0
  if (score < SCORE_AUTO_QUALIFY_AT) return 0.1
  if (score < 700) return 0.18
  if (score < 750) return 0.3
  if (score < 800) return 0.45
  return 0.65
}

function roundDownToStep(value: number, step = 10_000): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value / step) * step
}

/**
 * Calcula el monto máximo ofrecible: scoring primero, luego capacidad e historial en app.
 * Nunca ofrece el tope de catálogo (p. ej. $3M) sin evaluación.
 */
export function computeCreditOffer(input: {
  score: number
  monthlyIncome: number
  term: number
  monthlyRate: number
  productMinAmount: number
  productMaxAmount: number
  history: AppRepaymentHistory
}): CreditOffer {
  const {
    score,
    monthlyIncome,
    term,
    monthlyRate,
    productMinAmount,
    productMaxAmount,
    history,
  } = input

  const maxInstallment =
    monthlyIncome > 0 ? Math.round(monthlyIncome * INCOME_DTI_RATIO * 100) / 100 : 0
  const capacityPrincipal = maxPrincipalFromInstallment(maxInstallment, term, monthlyRate)
  const scoreFraction = scoreTierCatalogFraction(score)
  const scoreCap = roundDownToStep(productMaxAmount * scoreFraction)

  const isNewInApp = history.paidCount === 0 && history.completedLoans === 0
  let historyCap: number
  if (scoreFraction <= 0) {
    historyCap = 0
  } else if (history.overdueCount > 0) {
    historyCap = roundDownToStep(Math.min(FIRST_CREDIT_HARD_CAP * 0.5, scoreCap * 0.4))
  } else if (isNewInApp) {
    // Sin historial de pagos en la app: oferta inicial acotada.
    historyCap = roundDownToStep(
      Math.min(FIRST_CREDIT_HARD_CAP, monthlyIncome > 0 ? monthlyIncome * 3 : FIRST_CREDIT_HARD_CAP),
    )
  } else if (history.completedLoans >= 1 && history.paidCount >= 6 && history.overdueCount === 0) {
    // Cumplimiento demostrado: se acerca al tope de score (sigue limitado por capacidad).
    historyCap = productMaxAmount
  } else if (history.paidCount >= 3 && history.overdueCount === 0) {
    historyCap = roundDownToStep(Math.min(scoreCap, FIRST_CREDIT_HARD_CAP * 2))
  } else {
    historyCap = roundDownToStep(Math.min(FIRST_CREDIT_HARD_CAP * 1.25, scoreCap))
  }

  const productCap = productMaxAmount
  const candidates = [
    { k: 'capacity' as const, v: capacityPrincipal },
    { k: 'history' as const, v: historyCap },
    { k: 'score' as const, v: scoreCap },
    { k: 'product' as const, v: productCap },
  ]
  const rawMax = Math.min(...candidates.map((c) => c.v))
  const maxAmount = roundDownToStep(rawMax)
  const bindingLimit: CreditOffer['bindingLimit'] =
    maxAmount <= 0 || scoreFraction <= 0
      ? 'ineligible'
      : (candidates.find((c) => c.v === rawMax)?.k ?? 'product')

  if (score < SCORE_REJECT_BELOW) {
    return {
      eligible: false,
      maxAmount: 0,
      maxInstallment,
      capacityPrincipal,
      scoreCap,
      historyCap,
      productCap,
      bindingLimit: 'ineligible',
      reason: 'Score insuficiente: no hay oferta disponible.',
    }
  }

  if (maxAmount < productMinAmount) {
    return {
      eligible: false,
      maxAmount: 0,
      maxInstallment,
      capacityPrincipal,
      scoreCap,
      historyCap,
      productCap,
      bindingLimit: 'ineligible',
      reason:
        bindingLimit === 'capacity'
          ? 'La capacidad de pago (35% de ingresos) no alcanza el monto mínimo del producto.'
          : isNewInApp
            ? 'Sin historial de pagos en la app la oferta inicial no alcanza el mínimo. Mejorá ingresos declarados o el plazo.'
            : 'No hay oferta disponible con el score y el historial actuales.',
    }
  }

  const limitHint =
    bindingLimit === 'capacity'
      ? 'limitado por capacidad de pago (35% de ingresos)'
      : bindingLimit === 'history'
        ? isNewInApp
          ? 'limitado por ser tu primer crédito en la app'
          : 'limitado por historial de pagos en la app'
        : bindingLimit === 'score'
          ? 'limitado por score crediticio'
          : 'limitado por el tope de línea'

  return {
    eligible: true,
    maxAmount,
    maxInstallment,
    capacityPrincipal: roundDownToStep(capacityPrincipal),
    scoreCap,
    historyCap,
    productCap,
    bindingLimit,
    reason: `Oferta hasta ${maxAmount.toLocaleString('es-AR')} ARS · ${limitHint}.`,
  }
}

export function decideUnderwriting(input: {
  score: ScoreResult
  installmentAmount: number
  monthlyIncome: number
  worstSituation: number | null | undefined
  rejectedChecksCount: number
}): UnderwriteDecision {
  const { score, installmentAmount, monthlyIncome, worstSituation, rejectedChecksCount } = input
  const maxInstallment = monthlyIncome * INCOME_DTI_RATIO

  if (score.score < SCORE_REJECT_BELOW) {
    return {
      outcome: 'rejected',
      reason: 'Score crediticio insuficiente según la evaluación BCRA.',
    }
  }
  if (worstSituation != null && worstSituation >= 4) {
    return {
      outcome: 'rejected',
      reason: 'Situación crediticia irregular en el BCRA (situación 4 o 5).',
    }
  }
  if (rejectedChecksCount > 0 && (worstSituation ?? 1) >= 3) {
    return {
      outcome: 'rejected',
      reason: 'Cheques rechazados y situación irregular en la Central de Deudores del BCRA.',
    }
  }
  if (monthlyIncome > 0 && installmentAmount > maxInstallment) {
    return {
      outcome: 'rejected',
      reason: 'La cuota supera el 35% de los ingresos declarados.',
    }
  }

  if (score.score < SCORE_AUTO_QUALIFY_AT) {
    return {
      outcome: 'pending_review',
      reason: `Score ${score.score} (${score.band}): queda en evaluación para revisión de crédito.`,
    }
  }

  return {
    outcome: 'qualified',
    reason: `Calificado automáticamente · score ${score.score} (${score.band}). Pendiente de firma de contrato.`,
  }
}

export function contractNeedsSignature(status: string | null | undefined): boolean {
  if (!status) return false
  return status === 'pending_acceptance' || status === 'generated'
}
