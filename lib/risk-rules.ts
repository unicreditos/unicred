import { db } from '@/lib/db'
import { riskRuleVersion, user as userTable } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { ensureRiskRulesSchema } from '@/lib/db/ensure-risk-rules'
import { DEFAULT_RISK_RULES, type RiskRuleParams } from '@/lib/loan-underwriting'
import { requirePermission } from '@/lib/rbac'
import { recordAudit, diffFields } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

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

export type RiskRuleVersionRow = {
  id: string
  version: number
  isActive: boolean
  params: RiskRuleParams
  notes: string | null
  createdByEmail: string | null
  createdAt: Date
}

/** Historial de versiones, más reciente primero. Para la pantalla de Riesgo. */
export async function listRiskRuleVersions(): Promise<RiskRuleVersionRow[]> {
  await requirePermission('risk.read')
  await ensureRiskRulesSchema()
  const rows = await db
    .select({
      id: riskRuleVersion.id,
      version: riskRuleVersion.version,
      isActive: riskRuleVersion.isActive,
      scoreRejectBelow: riskRuleVersion.scoreRejectBelow,
      scoreAutoQualifyAt: riskRuleVersion.scoreAutoQualifyAt,
      incomeDtiRatio: riskRuleVersion.incomeDtiRatio,
      firstCreditHardCap: riskRuleVersion.firstCreditHardCap,
      bcraWorstSituationRejectAt: riskRuleVersion.bcraWorstSituationRejectAt,
      bcraRejectedChecksSituationThreshold: riskRuleVersion.bcraRejectedChecksSituationThreshold,
      notes: riskRuleVersion.notes,
      createdAt: riskRuleVersion.createdAt,
      createdByEmail: userTable.email,
    })
    .from(riskRuleVersion)
    .leftJoin(userTable, eq(userTable.id, riskRuleVersion.createdBy))
    .orderBy(desc(riskRuleVersion.version))
    .limit(50)
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    isActive: r.isActive,
    notes: r.notes,
    createdByEmail: r.createdByEmail,
    createdAt: r.createdAt,
    params: {
      scoreRejectBelow: r.scoreRejectBelow,
      scoreAutoQualifyAt: r.scoreAutoQualifyAt,
      incomeDtiRatio: Number(r.incomeDtiRatio),
      firstCreditHardCap: Number(r.firstCreditHardCap),
      bcraWorstSituationRejectAt: r.bcraWorstSituationRejectAt,
      bcraRejectedChecksSituationThreshold: r.bcraRejectedChecksSituationThreshold,
    },
  }))
}

/**
 * Publica una nueva versión de umbrales y la activa. Nunca edita una versión
 * existente: cada cambio queda como fila nueva, con quién y por qué.
 */
export async function createRiskRuleVersion(input: RiskRuleParams & { notes: string }) {
  const adminUserId = await requirePermission('risk.rules.write')

  if (!Number.isInteger(input.scoreRejectBelow) || input.scoreRejectBelow < 0 || input.scoreRejectBelow > 950) {
    throw new Error('Score mínimo de rechazo inválido (0 a 950).')
  }
  if (!Number.isInteger(input.scoreAutoQualifyAt) || input.scoreAutoQualifyAt <= input.scoreRejectBelow || input.scoreAutoQualifyAt > 950) {
    throw new Error('Score de calificación automática debe ser mayor al de rechazo.')
  }
  if (!Number.isFinite(input.incomeDtiRatio) || input.incomeDtiRatio <= 0 || input.incomeDtiRatio > 1) {
    throw new Error('Tope de cuota / ingresos inválido (debe ser entre 0 y 100%).')
  }
  if (!Number.isFinite(input.firstCreditHardCap) || input.firstCreditHardCap <= 0) {
    throw new Error('Techo de primer crédito inválido.')
  }
  if (!Number.isInteger(input.bcraWorstSituationRejectAt) || input.bcraWorstSituationRejectAt < 1 || input.bcraWorstSituationRejectAt > 6) {
    throw new Error('Situación BCRA de rechazo inválida (1 a 6).')
  }
  if (
    !Number.isInteger(input.bcraRejectedChecksSituationThreshold) ||
    input.bcraRejectedChecksSituationThreshold < 1 ||
    input.bcraRejectedChecksSituationThreshold > 6
  ) {
    throw new Error('Umbral de situación para cheques rechazados inválido (1 a 6).')
  }
  if (!input.notes?.trim()) {
    throw new Error('Contá el motivo del cambio: queda en el historial.')
  }

  await ensureRiskRulesSchema()

  const [current] = await db.select().from(riskRuleVersion).where(eq(riskRuleVersion.isActive, true)).limit(1)
  const nextVersion = (current?.version ?? 0) + 1
  const id = `risk_rules_v${nextVersion}`

  await db.transaction(async (tx) => {
    if (current) {
      await tx.update(riskRuleVersion).set({ isActive: false }).where(eq(riskRuleVersion.id, current.id))
    }
    await tx.insert(riskRuleVersion).values({
      id,
      version: nextVersion,
      isActive: true,
      scoreRejectBelow: input.scoreRejectBelow,
      scoreAutoQualifyAt: input.scoreAutoQualifyAt,
      incomeDtiRatio: input.incomeDtiRatio.toFixed(4),
      firstCreditHardCap: input.firstCreditHardCap.toFixed(2),
      bcraWorstSituationRejectAt: input.bcraWorstSituationRejectAt,
      bcraRejectedChecksSituationThreshold: input.bcraRejectedChecksSituationThreshold,
      notes: input.notes.trim(),
      createdBy: adminUserId,
    })
  })

  await recordAudit({
    actorUserId: adminUserId,
    action: 'RISK_RULES_VERSIONED',
    entityType: 'risk_rule_version',
    entityId: id,
    severity: 'warning',
    summary: `Reglas de riesgo v${nextVersion} activadas: ${input.notes.trim()}`,
    changes: current ? diffFields(toParams(current) as any, input as any) : undefined,
  })

  revalidatePath('/admin')
  return { ok: true as const, version: nextVersion }
}
