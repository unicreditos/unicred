/** Key 6 sobre la base (solo lectura + auditoria). La regla vive en lib/key6.ts; aca solo se juntan los datos. */
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { kycVerification, profile, user as userTable } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import {
  Key6IncompleteError,
  key6EnforceExisting,
  key6Gate,
  key6InputFromStored,
  requiresKey6,
  type Key6Evaluation,
  type Key6Gate,
} from '@/lib/key6'

export async function roleOfUser(userId: string): Promise<string | null> {
  const [p] = await db.select({ role: profile.role }).from(profile).where(eq(profile.userId, userId)).limit(1)
  if (p?.role) return p.role
  const [u] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  return u?.role ?? null
}

async function evidenceKindsOf(userId: string): Promise<string[]> {
  try {
    const res = await db.execute(sql`SELECT DISTINCT kind FROM kyc_evidence WHERE "userId" = ${userId}`)
    return (res.rows as { kind: string }[]).map((r) => String(r.kind))
  } catch {
    return [] // la tabla puede no existir todavia (SQL 01 sin aplicar): sin tabla no hay evidencia versionada
  }
}

/** Estado de Key 6 guardado de un usuario (solo lectura). */
export async function loadKey6ForUser(userId: string): Promise<{ role: string | null; gate: Key6Gate; hasRecord: boolean }> {
  const role = await roleOfUser(userId)
  const [kyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const ocr = (kyc?.ocrData as Record<string, unknown> | null) ?? {}
  const didit = (ocr.didit as Record<string, unknown> | undefined) ?? {}
  const input = key6InputFromStored({
    decision: didit.decision ?? null,
    diditStatus: typeof didit.status === 'string' ? didit.status : null,
    columns: {
      dniFrontImageUrl: kyc?.dniFrontImageUrl,
      dniBackImageUrl: kyc?.dniBackImageUrl,
      selfieImageUrl: kyc?.selfieImageUrl,
    },
    evidenceKinds: await evidenceKindsOf(userId),
  })
  return { role, gate: key6Gate(role, input), hasRecord: Boolean(ocr.key6) }
}

/** Constancia del bloqueo: auditoria SIN datos personales (solo ids internos y la lista de faltantes). */
export async function recordKey6Block(input: {
  userId: string | null
  where: string
  evaluation: Key6Evaluation
  actorUserId?: string | null
}): Promise<void> {
  await recordAudit({
    actorUserId: input.actorUserId ?? '',
    action: 'KEY6_BLOCKED',
    entityType: 'kyc_verification',
    entityId: input.userId,
    targetUserId: input.userId,
    severity: 'warning',
    summary: `Key 6 incompleta (${input.where}): falta ${input.evaluation.missing.join(', ')}`,
    changes: { state: input.evaluation.state, missing: input.evaluation.missing, where: input.where },
  }).catch(() => undefined)
}

/** Lanza Key6IncompleteError si el usuario es cliente y su Key 6 no esta completa. Personal: no hace nada. */
export async function assertKey6(
  userId: string,
  where: string,
  actorUserId?: string | null,
  opts: { grandfatherLegacy?: boolean } = {},
): Promise<void> {
  const { gate, hasRecord } = await loadKey6ForUser(userId)
  if (gate.allow) return
  // Cliente aprobado antes de Key 6 (sin registro): solo se tolera para operar, nunca para una aprobacion nueva.
  if (opts.grandfatherLegacy && !hasRecord && !key6EnforceExisting()) return
  await recordKey6Block({ userId, where, evaluation: gate.evaluation, actorUserId })
  throw new Key6IncompleteError(gate.evaluation.missing)
}

export { requiresKey6 }