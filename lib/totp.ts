import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { consumeRateLimit } from '@/lib/rate-limit'
import {
  beginEnrolWith,
  confirmEnrolWith,
  disableTotpWith,
  regenerateBackupCodesWith,
  totpStatusWith,
  userHasTotpWith,
  verifyFactorWith,
  type TotpDeps,
} from '@/lib/totp-store'

function pepper(): string {
  const p = (process.env.TWOFA_PEPPER || process.env.BETTER_AUTH_SECRET || '').trim()
  if (p.length < 16) throw new Error('Falta TWOFA_PEPPER (o BETTER_AUTH_SECRET) para proteger los secretos del segundo factor.')
  return p
}

const deps: TotpDeps = {
  pepper,
  now: () => new Date(),
  newId: (p) => `${p}_${randomUUID()}`,
  limiter: (key, limit, windowMs) => consumeRateLimit(key, limit, windowMs),
  async audit(e) {
    await recordAudit({
      actorUserId: e.userId,
      action: e.action,
      entityType: 'second_factor',
      entityId: e.userId,
      targetUserId: e.userId,
      severity: e.severity,
      summary: e.summary,
      changes: e.changes ?? null,
    }).catch(() => undefined)
  },
}

/** Sin la tabla (SQL 04 sin aplicar) nadie tiene TOTP; cualquier otro error falla cerrado (se propaga). */
function isMissingTable(err: unknown) {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  return e?.code === '42P01' || e?.cause?.code === '42P01'
}

export async function userHasTotp(userId: string): Promise<boolean> {
  try {
    return await userHasTotpWith(db, userId)
  } catch (err) {
    if (isMissingTable(err)) return false
    throw err
  }
}

export const totpStatus = (userId: string) => totpStatusWith(db, userId)
export const beginTotpEnrol = (input: { userId: string; account: string }) => beginEnrolWith(deps, db, input)
export const confirmTotpEnrol = (input: { userId: string; code: string; sessionId?: string | null; ip?: string | null }) => confirmEnrolWith(deps, db, input)
export const verifySecondFactorCode = (input: { userId: string; code: string; sessionId?: string | null; ip?: string | null; grant?: boolean }) => verifyFactorWith(deps, db, input)
export const regenerateBackupCodes = (userId: string) => regenerateBackupCodesWith(deps, db, { userId })
export const disableTotp = (userId: string) => disableTotpWith(deps, db, { userId })