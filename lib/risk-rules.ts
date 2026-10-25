import { db } from '@/lib/db'
import { riskRuleVersion } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ensureRiskRulesSchema } from '@/lib/db/ensure-risk-rules'
import { DEFAULT_RISK_RULES, type RiskRuleParams } from '@/lib/loan-underwriting'

function toParams(row: typeof riskRuleVersion.$inferSelect): RiskRuleParams {
  return {
    scoreRejectBelow: row.scoreRejectBelow,
    scoreAutoQualifyAt: row.scoreAutoQualifyAt,
    incomeDtiRatio: Number(row.incomeDtiRatio),
    firstCreditHardCap: Number(row.firstCreditHardCap),
    bcraWorstSituationRejectAt: row.bcraWorstSituationRejectAt,
    bcraRejectedChecksSituationThreshold: row.bcraRejectedChecksSituationThreshold,
  }
}

/** Umbrales de underwriting vigentes. Usar en el flujo real de solicitud (web + mobile). */
export async function getActiveRiskRules(): Promise<RiskRuleParams> {
  await ensureRiskRulesSchema()
  const [active] = await db.select().from(riskRuleVersion).where(eq(riskRuleVersion.isActive, true)).limit(1)
  return active ? toParams(active) : DEFAULT_RISK_RULES
}

