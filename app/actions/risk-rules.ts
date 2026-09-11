'use server'

import { createRiskRuleVersion as createRiskRuleVersionImpl } from '@/lib/risk-rules'
import type { RiskRuleParams } from '@/lib/loan-underwriting'

export async function createRiskRuleVersion(input: RiskRuleParams & { notes: string }) {
  return createRiskRuleVersionImpl(input)
}
