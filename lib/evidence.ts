import { db } from '@/lib/db'
import {
  backfillLegacyEvidenceWith,
  listEvidenceAccessWith,
  listEvidenceWith,
  logEvidenceAccessWith,
  readEvidenceVerifiedWith,
  storeEvidenceVersionWith,
} from '@/lib/evidence-store'
import { EVIDENCE_KINDS, LEGACY_COLUMN, parseDataUrl } from '@/lib/evidence-core'

export type { EvidenceMeta } from '@/lib/evidence-store'

export const storeEvidenceVersion = (input: Parameters<typeof storeEvidenceVersionWith>[1]) => storeEvidenceVersionWith(db, input)
export const backfillLegacyEvidence = (userId: string) => backfillLegacyEvidenceWith(db, userId)
export const listEvidence = (userId: string) => listEvidenceWith(db, userId)
export const readEvidenceVerified = (userId: string, kind: Parameters<typeof readEvidenceVerifiedWith>[2], version?: number | null) => readEvidenceVerifiedWith(db, userId, kind, version)
export const logEvidenceAccess = (input: Parameters<typeof logEvidenceAccessWith>[1]) => logEvidenceAccessWith(db, input)
export const listEvidenceAccess = (ownerUserId: string, limit = 50) => listEvidenceAccessWith(db, ownerUserId, limit)

export function evidenceVersioningEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.EVIDENCE_VERSIONING ?? 'yes').trim().toLowerCase() !== 'no'
}

/** Antes de que una verificación nueva reemplace las columnas viejas, se conserva lo anterior como versión. Nunca lanza. */
export async function preserveLegacyEvidence(userId: string): Promise<void> {
  if (!evidenceVersioningEnabled()) return
  try {
    await backfillLegacyEvidence(userId)
  } catch (err) {
    console.warn('[evidence] no se pudo conservar la evidencia anterior:', (err as Error).message)
  }
}

/** Guarda las capturas de una verificación como versiones nuevas con hash. Nunca lanza (no rompe el KYC). */
export async function saveVersionedEvidence(input: {
  userId: string
  sessionId: string
  kycVerificationId?: string | null
  media: { dniFrontImageUrl: string | null; dniBackImageUrl: string | null; selfieImageUrl: string | null; videoUrl: string | null }
}): Promise<void> {
  if (!evidenceVersioningEnabled()) return
  try {
    for (const kind of EVIDENCE_KINDS) {
      const parsed = parseDataUrl(input.media[LEGACY_COLUMN[kind]])
      if (!parsed) continue
      await storeEvidenceVersion({
        userId: input.userId,
        kind,
        bytes: parsed.bytes,
        mime: parsed.mime,
        source: 'didit',
        diditSessionId: input.sessionId,
        kycVerificationId: input.kycVerificationId ?? null,
      })
    }
  } catch (err) {
    console.warn('[evidence] no se pudo guardar la evidencia versionada:', (err as Error).message)
  }
}
