import {
  computeScore,
  consultFullBcra,
  isValidCuit,
  normalizeCuit,
  type FullBcraSnapshot,
  type ScoreResult,
} from '@/lib/bcra'
import { db } from '@/lib/db'
import { bcraCheck, profile } from '@/lib/db/schema'
import { ensureOriginacionSchema } from '@/lib/db/ensure-originacion'
import { newId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export type PersistedBcraConsultation = {
  ok: true
  checkId: string
  score: ScoreResult
  snapshot: FullBcraSnapshot
  denominacion: string | null
}

function snapshotPayload(snapshot: FullBcraSnapshot, score: ScoreResult) {
  return {
    deudas: snapshot.deudas,
    historicas: snapshot.historicas,
    chequesRechazados: snapshot.chequesRechazados,
    score,
    denominacion: snapshot.deudas.denominacion ?? snapshot.historicas.denominacion,
    consultedAt: snapshot.consultedAt,
  }
}

export async function persistBcraConsultation(opts: {
  userId: string
  cuil: string
  monthlyIncome?: number
  skipConsent?: boolean
}): Promise<PersistedBcraConsultation | { ok: false; error: string }> {
  await ensureOriginacionSchema()
  const cuil = normalizeCuit(opts.cuil)
  if (!isValidCuit(cuil)) {
    return { ok: false, error: 'CUIL/CUIT inválido. Verificá los 11 dígitos.' }
  }

  if (!opts.skipConsent) {
    const [consent] = await db
      .select({ bcraConsentAt: profile.bcraConsentAt })
      .from(profile)
      .where(eq(profile.userId, opts.userId))
      .limit(1)
    if (!consent?.bcraConsentAt) {
      return {
        ok: false,
        error: 'Autorizá la consulta a la Central de Deudores del BCRA (CENDEU) para continuar.',
      }
    }
  }

  const snapshot = await consultFullBcra(cuil)
  if (snapshot.unavailable) {
    return {
      ok: false,
      error: 'La API del BCRA no respondió. Reintentá en unos minutos.',
    }
  }

  const [prof] = await db.select().from(profile).where(eq(profile.userId, opts.userId)).limit(1)
  const monthlyIncome = Number(opts.monthlyIncome ?? prof?.monthlyIncome ?? 0)
  const hasRejectedChecks = snapshot.chequesRechazados.count > 0
  const score = computeScore({
    deuda: snapshot.deudas,
    monthlyIncome,
    hasRejectedChecks,
    historica: snapshot.historicas,
  })

  const now = new Date()
  const checkId = newId('bcra')
  await db.insert(bcraCheck).values({
    id: checkId,
    userId: opts.userId,
    cuil,
    worstSituation: snapshot.deudas.worstSituation,
    totalDebt: String(snapshot.deudas.totalDebt),
    entitiesCount: snapshot.deudas.entitiesCount,
    hasRejectedChecks,
    rawResult: snapshotPayload(snapshot, score) as unknown as Record<string, unknown>,
    rawResponse: snapshotPayload(snapshot, score) as unknown as Record<string, unknown>,
    source: 'bcra_api',
    computedScore: score.score,
    consultedAt: now,
    createdAt: now,
  })

  await db
    .update(profile)
    .set({ creditScore: score.score, updatedAt: now })
    .where(eq(profile.userId, opts.userId))

  return {
    ok: true,
    checkId,
    score,
    snapshot,
    denominacion: snapshot.deudas.denominacion ?? snapshot.historicas.denominacion,
  }
}
