import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { riskRuleVersion } from '@/lib/db/schema'
import { DEFAULT_RISK_RULES } from '@/lib/loan-underwriting'
import { eq } from 'drizzle-orm'

let ensured = false

/** Alta one-shot: no hay carpeta de migraciones Drizzle en este repo. */
export async function ensureRiskRulesSchema() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_rule_version (
      id text PRIMARY KEY,
      version integer NOT NULL,
      "isActive" boolean NOT NULL DEFAULT false,
      "scoreRejectBelow" integer NOT NULL,
      "scoreAutoQualifyAt" integer NOT NULL,
      "incomeDtiRatio" numeric(5, 4) NOT NULL,
      "firstCreditHardCap" numeric(14, 2) NOT NULL,
      "bcraWorstSituationRejectAt" integer NOT NULL,
      "bcraRejectedChecksSituationThreshold" integer NOT NULL,
      notes text,
      "createdBy" text REFERENCES "user"(id) ON DELETE SET NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS risk_rule_version_active_idx ON risk_rule_version ("isActive")`)

  const [active] = await db.select().from(riskRuleVersion).where(eq(riskRuleVersion.isActive, true)).limit(1)
  if (!active) {
    // Semilla: la versión 1 son los umbrales que el código ya usaba en producción.
    await db.insert(riskRuleVersion).values({
      id: 'risk_rules_v1',
      version: 1,
      isActive: true,
      scoreRejectBelow: DEFAULT_RISK_RULES.scoreRejectBelow,
      scoreAutoQualifyAt: DEFAULT_RISK_RULES.scoreAutoQualifyAt,
      incomeDtiRatio: DEFAULT_RISK_RULES.incomeDtiRatio.toFixed(4),
      firstCreditHardCap: DEFAULT_RISK_RULES.firstCreditHardCap.toFixed(2),
      bcraWorstSituationRejectAt: DEFAULT_RISK_RULES.bcraWorstSituationRejectAt,
      bcraRejectedChecksSituationThreshold: DEFAULT_RISK_RULES.bcraRejectedChecksSituationThreshold,
      notes: 'Semilla inicial: umbrales que ya usaba el código antes de tener versión configurable.',
    })
  }

  ensured = true
}
