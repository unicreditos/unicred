import { and, desc, eq, ne } from 'drizzle-orm'
import type { ScoreResult } from '@/lib/bcra'
import { db } from '@/lib/db'
import { bcraCheck, loan, profile } from '@/lib/db/schema'
import { diditApprovedForUser } from '@/lib/didit'
import {
  decideUnderwriting,
  DEFAULT_RISK_RULES,
  type RiskRuleParams,
} from '@/lib/loan-underwriting'
import { getActiveRiskRules } from '@/lib/risk-rules'

function scoreBand(score: number): ScoreResult['band'] {
  if (score >= 720) return 'excelente'
  if (score >= 640) return 'bueno'
  if (score >= 560) return 'regular'
  return 'bajo'
}

/** Misma barrera para el panel web, la acción de admin y la API móvil. */
export async function assertCanApproveLoan(
  row: typeof loan.$inferSelect,
  rules?: RiskRuleParams,
) {
  if (!(await diditApprovedForUser(row.userId))) {
    throw new Error('No se puede calificar: KYC Didit no verificado')
  }
  const activeRules = rules ?? (await getActiveRiskRules().catch(() => DEFAULT_RISK_RULES))
  const [person] = await db
    .select({ creditScore: profile.creditScore, monthlyIncome: profile.monthlyIncome })
    .from(profile)
    .where(eq(profile.userId, row.userId))
    .limit(1)
  const [bcra] = await db
    .select()
    .from(bcraCheck)
    .where(eq(bcraCheck.userId, row.userId))
    .orderBy(desc(bcraCheck.createdAt))
    .limit(1)
  const score = bcra?.computedScore ?? person?.creditScore ?? null
  if (score == null) {
    throw new Error('Falta el score. Pedí información o consultá el BCRA antes de calificar.')
  }
  const income = Number(person?.monthlyIncome)
  if (!Number.isFinite(income) || income <= 0) {
    throw new Error('Faltan los ingresos declarados. Pedí información antes de calificar.')
  }
  const [paidBefore] = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, row.userId), eq(loan.status, 'paid'), ne(loan.id, row.id)))
    .limit(1)
  if (!paidBefore && Number(row.principal) > activeRules.firstCreditHardCap) {
    throw new Error(
      `El primer crédito no puede superar ${activeRules.firstCreditHardCap.toLocaleString('es-AR')} ARS.`,
    )
  }
  const decision = decideUnderwriting({
    score: {
      score,
      situacion: bcra?.worstSituation ?? null,
      totalDebt: Number(bcra?.totalDebt) || 0,
      entitiesCount: bcra?.entitiesCount ?? 0,
      hasRejectedChecks: Boolean(bcra?.hasRejectedChecks),
      band: scoreBand(score),
      reasons: [],
    },
    installmentAmount: Number(row.installmentAmount) || 0,
    monthlyIncome: income,
    worstSituation: bcra?.worstSituation,
    rejectedChecksCount: bcra?.hasRejectedChecks ? 1 : 0,
    rules: activeRules,
  })
  if (decision.outcome === 'rejected') throw new Error(decision.reason)
}
