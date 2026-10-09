/** Evidencia KYC versionada con ejecutor de SQL inyectado (la app pasa su db; las pruebas, una base de prueba). */
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { SqlExecutor } from '@/lib/otp-pg-store'
import {
  EVIDENCE_KINDS,
  LEGACY_COLUMN,
  hashMatches,
  nextVersionDecision,
  parseDataUrl,
  sha256Of,
  type EvidenceKind,
} from '@/lib/evidence-core'

export type EvidenceMeta = {
  id: string
  userId: string
  kind: EvidenceKind
  version: number
  mime: string
  sizeBytes: number
  sha256: string
  source: string
  diditSessionId: string | null
  capturedAt: Date
  supersededBy: string | null
}

type Row = Record<string, unknown>

/**
 * Guarda un archivo como una version NUEVA. Nunca pisa una anterior: si el contenido es identico a la
 * ultima version no hace nada; si cambia, crea la version N+1 y marca la anterior como superada.
 */
export async function storeEvidenceVersionWith(
  db: SqlExecutor,
  input: {
  userId: string
  kind: EvidenceKind
  bytes: Buffer
  mime: string
  source?: string
  diditSessionId?: string | null
  kycVerificationId?: string | null
}): Promise<{ id: string | null; version: number; created: boolean }> {
  const hash = sha256Of(input.bytes)
  return db.transaction(async (tx) => {
    // Serializa por usuario y tipo para que dos webhooks simultaneos no dupliquen la version.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`kyc_evidence:${input.userId}:${input.kind}`}))`)
    const latestRes = await tx.execute(
      sql`SELECT id, version, sha256 FROM kyc_evidence WHERE "userId" = ${input.userId} AND kind = ${input.kind} ORDER BY version DESC LIMIT 1`,
    )
    const latest = (latestRes.rows[0] as { id: string; version: number; sha256: string } | undefined) ?? null
    const decision = nextVersionDecision(latest ? { version: Number(latest.version), sha256: latest.sha256 } : null, hash)
    if (decision.action === 'skip') return { id: latest?.id ?? null, version: decision.version, created: false }
    const id = `ev_${randomUUID()}`
    await tx.execute(sql`
      INSERT INTO kyc_evidence (id, "userId", "kycVerificationId", "diditSessionId", kind, version, mime, "sizeBytes", sha256, data, source)
      VALUES (${id}, ${input.userId}, ${input.kycVerificationId ?? null}, ${input.diditSessionId ?? null}, ${input.kind},
              ${decision.version}, ${input.mime}, ${input.bytes.byteLength}, ${hash}, ${input.bytes}, ${input.source ?? 'didit'})`)
    if (latest) await tx.execute(sql`UPDATE kyc_evidence SET "supersededBy" = ${id} WHERE id = ${latest.id}`)
    return { id, version: decision.version, created: true }
  })
}

/** Copia a la tabla versionada lo que hoy vive en las columnas viejas de kyc_verification (idempotente). */
export async function backfillLegacyEvidenceWith(
  db: SqlExecutor,
  userId: string): Promise<number> {
  const res = await db.execute(
    sql`SELECT id, "providerReferenceId", "dniFrontImageUrl", "dniBackImageUrl", "selfieImageUrl", "videoUrl" FROM kyc_verification WHERE "userId" = ${userId} LIMIT 1`,
  )
  const row = res.rows[0] as Row | undefined
  if (!row) return 0
  let created = 0
  for (const kind of EVIDENCE_KINDS) {
    const parsed = parseDataUrl(row[LEGACY_COLUMN[kind]] as string | null)
    if (!parsed) continue
    const out = await storeEvidenceVersionWith(db, {
      userId,
      kind,
      bytes: parsed.bytes,
      mime: parsed.mime,
      source: 'legacy_backfill',
      diditSessionId: (row.providerReferenceId as string | null) ?? null,
      kycVerificationId: row.id as string,
    })
    if (out.created) created++
  }
  return created
}

export async function listEvidenceWith(
  db: SqlExecutor,
  userId: string): Promise<EvidenceMeta[]> {
  const res = await db.execute(
    sql`SELECT id, "userId", kind, version, mime, "sizeBytes", sha256, source, "diditSessionId", "capturedAt", "supersededBy"
          FROM kyc_evidence WHERE "userId" = ${userId} ORDER BY kind, version DESC`,
  )
  return (res.rows as Row[]).map((r) => ({
    id: String(r.id),
    userId: String(r.userId),
    kind: r.kind as EvidenceKind,
    version: Number(r.version),
    mime: String(r.mime),
    sizeBytes: Number(r.sizeBytes),
    sha256: String(r.sha256).trim(),
    source: String(r.source),
    diditSessionId: (r.diditSessionId as string | null) ?? null,
    capturedAt: new Date(r.capturedAt as string),
    supersededBy: (r.supersededBy as string | null) ?? null,
  }))
}

/** Lee el archivo y VERIFICA el hash antes de entregarlo. */
export async function readEvidenceVerifiedWith(
  db: SqlExecutor,
  userId: string,
  kind: EvidenceKind,
  version?: number | null,
): Promise<
  | { ok: true; meta: EvidenceMeta; bytes: Buffer }
  | { ok: false; reason: 'not_found' | 'hash_mismatch'; meta?: EvidenceMeta }
> {
  const res = await db.execute(
    version
      ? sql`SELECT * FROM kyc_evidence WHERE "userId" = ${userId} AND kind = ${kind} AND version = ${version} LIMIT 1`
      : sql`SELECT * FROM kyc_evidence WHERE "userId" = ${userId} AND kind = ${kind} ORDER BY version DESC LIMIT 1`,
  )
  const r = res.rows[0] as Row | undefined
  if (!r) return { ok: false, reason: 'not_found' }
  const meta: EvidenceMeta = {
    id: String(r.id),
    userId: String(r.userId),
    kind: r.kind as EvidenceKind,
    version: Number(r.version),
    mime: String(r.mime),
    sizeBytes: Number(r.sizeBytes),
    sha256: String(r.sha256).trim(),
    source: String(r.source),
    diditSessionId: (r.diditSessionId as string | null) ?? null,
    capturedAt: new Date(r.capturedAt as string),
    supersededBy: (r.supersededBy as string | null) ?? null,
  }
  const bytes = Buffer.isBuffer(r.data) ? (r.data as Buffer) : Buffer.from(r.data as Uint8Array)
  if (!hashMatches(bytes, meta.sha256)) return { ok: false, reason: 'hash_mismatch', meta }
  return { ok: true, meta, bytes }
}

export async function logEvidenceAccessWith(
  db: SqlExecutor,
  input: {
  evidenceId?: string | null
  ownerUserId: string
  kind: string
  version?: number | null
  actorUserId: string
  outcome: 'served' | 'hash_mismatch' | 'denied_2fa' | 'not_found'
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO kyc_evidence_access_log (id, "evidenceId", "ownerUserId", kind, version, "actorUserId", outcome, ip, "userAgent")
    VALUES (${`evl_${randomUUID()}`}, ${input.evidenceId ?? null}, ${input.ownerUserId}, ${input.kind}, ${input.version ?? null},
            ${input.actorUserId}, ${input.outcome}, ${input.ip ?? null}, ${(input.userAgent ?? '').slice(0, 300) || null})`)
}

export async function listEvidenceAccessWith(
  db: SqlExecutor,
  ownerUserId: string, limit = 50) {
  const res = await db.execute(sql`
    SELECT l."at", l.kind, l.version, l.outcome, l.ip, u.email AS "actorEmail", u.name AS "actorName"
      FROM kyc_evidence_access_log l LEFT JOIN "user" u ON u.id = l."actorUserId"
     WHERE l."ownerUserId" = ${ownerUserId} ORDER BY l."at" DESC LIMIT ${limit}`)
  return res.rows as Array<{ at: string; kind: string; version: number | null; outcome: string; ip: string | null; actorEmail: string | null; actorName: string | null }>
}
