import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { lookupPersonaByCuit, arcaConfigured } from '@/lib/arca/padron'
import { parseConstanciaSnapshot, snapshotFromPersona } from '@/lib/arca/constancia-snapshot'
import { recordAudit } from '@/lib/audit'
import { persistBcraConsultation } from '@/lib/bcra-persist'
import { db } from '@/lib/db'
import { bcraCheck, diditWebhookLog, kycVerification, profile, user } from '@/lib/db/schema'
import { markDiditWebhookProcessed, processDiditWebhook } from '@/lib/didit'
import { ocrMergeSql } from '@/lib/kyc-ocr-merge'
import { releaseWebhookReplay, claimWebhookReplay } from '@/lib/webhook-replay-store'
import { namesMatch } from '@/lib/registration-preflight-core'

/** Un webhook sin procesar pasados estos minutos se considera fallido. */
export const WEBHOOK_STALE_MINUTES = 5

export async function listDiditWebhooks(opts: { onlyFailed?: boolean; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 300)
  const staleBefore = new Date(Date.now() - WEBHOOK_STALE_MINUTES * 60_000)
  const rows = await db
    .select({
      id: diditWebhookLog.id,
      eventId: diditWebhookLog.eventId,
      webhookType: diditWebhookLog.webhookType,
      sessionId: diditWebhookLog.sessionId,
      status: diditWebhookLog.status,
      processed: diditWebhookLog.processed,
      createdAt: diditWebhookLog.createdAt,
      processedAt: diditWebhookLog.processedAt,
    })
    .from(diditWebhookLog)
    .where(opts.onlyFailed ? and(eq(diditWebhookLog.processed, false), lt(diditWebhookLog.createdAt, staleBefore)) : undefined)
    .orderBy(desc(diditWebhookLog.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    ...r,
    failed: !r.processed && r.createdAt.getTime() < staleBefore.getTime(),
  }))
}

/** Reprocesa un webhook guardado (sin llamar a Didit: usa el payload que ya recibimos). */
export async function resendDiditWebhook(id: string, actorUserId: string) {
  const [row] = await db.select().from(diditWebhookLog).where(eq(diditWebhookLog.id, id)).limit(1)
  if (!row) throw new Error('Webhook no encontrado')
  const payload = (row.payload ?? null) as Record<string, unknown> | null
  if (!payload) throw new Error('El webhook no tiene payload guardado')
  // Un solo reproceso a la vez (aunque dos operadores hagan clic juntos) y nunca sobre uno ya procesado.
  if (!(await claimWebhookReplay(db, id))) throw new Error('El webhook ya se procesó o se está reprocesando')
  try {
    const result = await processDiditWebhook(payload)
    await markDiditWebhookProcessed(row.eventId)
    await recordAudit({
      actorUserId,
      action: 'DIDIT_WEBHOOK_REPLAYED',
      entityType: 'didit_webhook_log',
      entityId: id,
      summary: `Reprocesado webhook Didit ${row.webhookType}`,
      changes: { sessionId: row.sessionId, eventId: row.eventId },
    }).catch(() => undefined)
    return { ok: true as const, result }
  } catch (err) {
    await releaseWebhookReplay(db, id).catch(() => undefined)
    await recordAudit({
      actorUserId,
      action: 'DIDIT_WEBHOOK_REPLAY_FAILED',
      entityType: 'didit_webhook_log',
      entityId: id,
      severity: 'error',
      summary: `Falló el reproceso del webhook Didit ${row.webhookType}`,
      changes: { error: (err as Error).message },
    }).catch(() => undefined)
    throw err
  }
}

export async function bcraHistory(userId: string, limit = 50) {
  return db
    .select({
      id: bcraCheck.id,
      cuil: bcraCheck.cuil,
      worstSituation: bcraCheck.worstSituation,
      totalDebt: bcraCheck.totalDebt,
      entitiesCount: bcraCheck.entitiesCount,
      hasRejectedChecks: bcraCheck.hasRejectedChecks,
      computedScore: bcraCheck.computedScore,
      source: bcraCheck.source,
      consultedAt: bcraCheck.consultedAt,
      createdAt: bcraCheck.createdAt,
    })
    .from(bcraCheck)
    .where(eq(bcraCheck.userId, userId))
    .orderBy(desc(bcraCheck.createdAt))
    .limit(limit)
}

export async function bcraLatestPerClient(limit = 200) {
  const res = await db.execute(sql`
    SELECT DISTINCT ON (b."userId") b."userId", b.cuil, b."worstSituation", b."totalDebt", b."entitiesCount",
           b."hasRejectedChecks", b."computedScore", b."createdAt", u.name, u.email,
           (SELECT count(*)::int FROM bcra_check c WHERE c."userId" = b."userId") AS consultas
      FROM bcra_check b LEFT JOIN "user" u ON u.id = b."userId"
     ORDER BY b."userId", b."createdAt" DESC`)
  return (res.rows as Array<Record<string, unknown>>)
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
    .slice(0, limit)
}

/** Nueva consulta BCRA (respeta el consentimiento del cliente; queda una fila nueva, no pisa las anteriores). */
export async function refreshBcra(userId: string, actorUserId: string) {
  const [p] = await db.select({ cuil: profile.cuil }).from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!p?.cuil) throw new Error('El cliente no tiene CUIL cargado')
  const res = await persistBcraConsultation({ userId, cuil: p.cuil })
  await recordAudit({
    actorUserId,
    action: 'BCRA_REFRESHED_BY_ADMIN',
    entityType: 'bcra_check',
    entityId: res.ok ? res.checkId : null,
    targetUserId: userId,
    severity: res.ok ? 'info' : 'warning',
    summary: res.ok ? 'Consulta BCRA actualizada desde el panel' : `Consulta BCRA fallida: ${res.error}`,
  }).catch(() => undefined)
  if (!res.ok) throw new Error(res.error)
  return { checkId: res.checkId, score: res.score }
}

export async function arcaForUser(userId: string) {
  const [k] = await db
    .select({ id: kycVerification.id, ocrData: kycVerification.ocrData, status: kycVerification.status })
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  const ocr = (k?.ocrData as Record<string, unknown> | null) ?? {}
  return {
    kycId: k?.id ?? null,
    kycStatus: k?.status ?? null,
    snapshot: parseConstanciaSnapshot(ocr.arcaPadron),
    manualReview: (ocr.manualReview as { reason?: string; arcaName?: string; declaredName?: string; flaggedAt?: string } | undefined) ?? null,
  }
}

export async function arcaOverview(limit = 300) {
  const rows = await db
    .select({ userId: kycVerification.userId, ocrData: kycVerification.ocrData, name: user.name, email: user.email, status: kycVerification.status })
    .from(kycVerification)
    .leftJoin(user, eq(user.id, kycVerification.userId))
    .orderBy(desc(kycVerification.updatedAt))
    .limit(limit)
  return rows.map((r) => {
    const ocr = (r.ocrData as Record<string, unknown> | null) ?? {}
    return {
      userId: r.userId,
      name: r.name,
      email: r.email,
      kycStatus: r.status,
      snapshot: parseConstanciaSnapshot(ocr.arcaPadron),
      manualReview: Boolean(ocr.manualReview),
    }
  })
}

/** Vuelve a consultar el padrón ARCA y guarda el resultado; si el nombre no coincide, marca revisión manual. */
export async function refreshArca(userId: string, actorUserId: string) {
  if (!arcaConfigured()) throw new Error('El padrón ARCA no está configurado')
  const [p] = await db.select({ cuil: profile.cuil }).from(profile).where(eq(profile.userId, userId)).limit(1)
  const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  if (!p?.cuil) throw new Error('El cliente no tiene CUIL cargado')
  const persona = await lookupPersonaByCuit(p.cuil)
  if (!persona) throw new Error('El CUIT/CUIL no figura en el padrón ARCA o no respondió')
  const [k] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  if (!k) throw new Error('El cliente no tiene verificación de identidad')
  const now = new Date()
  const mismatch = namesMatch(persona.name, u?.name) === 'mismatch'
  await db
    .update(kycVerification)
    .set({
      // Fusion atomica: no pisa lo que un webhook de Didit escriba a la vez en ocrData.
      ocrData: ocrMergeSql({
        arcaPadron: snapshotFromPersona(persona, now.toISOString()),
        arcaLookedUpAt: now.toISOString(),
        ...(mismatch
          ? { manualReview: { reason: 'arca_name_mismatch', arcaName: persona.name, declaredName: u?.name ?? '', flaggedAt: now.toISOString() } }
          : {}),
      }),
      updatedAt: now,
    })
    .where(eq(kycVerification.id, k.id))
  await recordAudit({
    actorUserId,
    action: 'ARCA_REFRESHED_BY_ADMIN',
    entityType: 'kyc_verification',
    entityId: k.id,
    targetUserId: userId,
    summary: mismatch ? 'Padrón ARCA actualizado: nombre distinto, revisión manual' : 'Padrón ARCA actualizado desde el panel',
  }).catch(() => undefined)
  return { snapshot: snapshotFromPersona(persona, now.toISOString()), mismatch }
}

