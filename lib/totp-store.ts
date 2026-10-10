/**
 * Servicio de TOTP + codigos de respaldo con el ejecutor de SQL inyectado (la app pasa su db; las pruebas, una base de prueba).
 * Atomicidad: el reuso de un codigo y de un codigo de respaldo se decide con UN UPDATE ... RETURNING (no leer y luego escribir).
 */
import { sql } from 'drizzle-orm'
import {
  BACKUP_CODE_COUNT,
  TOTP_ATTEMPT_LIMIT,
  TOTP_ATTEMPT_WINDOW_MS,
  base32Decode,
  base32Encode,
  classifyFactorInput,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  matchTotp,
  otpauthUri,
} from '@/lib/totp-core'
import type { SqlExecutor } from '@/lib/otp-pg-store'

export type TotpAudit = {
  action: string
  userId: string
  severity: 'info' | 'warning'
  summary: string
  changes?: Record<string, unknown>
}

export type TotpDeps = {
  pepper: () => string
  now: () => Date
  newId: (prefix: string) => string
  limiter: (key: string, limit: number, windowMs: number) => Promise<{ ok: boolean }>
  audit: (e: TotpAudit) => Promise<void>
}

export type FactorFailure = 'rate_limited' | 'not_enrolled' | 'invalid' | 'replayed'
export type FactorResult = { ok: true; method: 'totp' | 'backup_code'; backupRemaining?: number } | { ok: false; reason: FactorFailure }

const attemptKey = (userId: string) => `totp:${userId}`

async function grant(db: SqlExecutor, deps: TotpDeps, input: { userId: string; sessionId?: string | null; ip?: string | null; method: string }) {
  if (!input.sessionId) return
  await db.execute(sql`INSERT INTO admin_second_factor (id, "userId", "sessionId", method, ip, "verifiedAt")
    VALUES (${deps.newId('sf')}, ${input.userId}, ${input.sessionId}, ${input.method}, ${input.ip ?? null}, ${deps.now().toISOString()})`)
}

export async function totpStatusWith(db: SqlExecutor, userId: string) {
  const r = await db.execute(sql`SELECT "confirmedAt" FROM user_totp WHERE "userId" = ${userId}`)
  const row = r.rows[0] as { confirmedAt: string | Date | null } | undefined
  const enabled = !!row?.confirmedAt
  let backupRemaining = 0
  if (enabled) {
    const b = await db.execute(sql`SELECT count(*)::int AS n FROM user_backup_code WHERE "userId" = ${userId} AND "usedAt" IS NULL`)
    backupRemaining = Number((b.rows[0] as { n: number }).n)
  }
  return { enabled, pending: !!row && !enabled, backupRemaining }
}

export async function userHasTotpWith(db: SqlExecutor, userId: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM user_totp WHERE "userId" = ${userId} AND "confirmedAt" IS NOT NULL LIMIT 1`)
  return r.rows.length > 0
}

/** Paso 1 del alta: genera el secreto (cifrado en la base) y devuelve el URI para el QR. No activa nada hasta confirmar. */
export async function beginEnrolWith(deps: TotpDeps, db: SqlExecutor, input: { userId: string; account: string }) {
  const lim = await deps.limiter(`totp-begin:${input.userId}`, 10, 60 * 60_000)
  if (!lim.ok) return { ok: false as const, reason: 'rate_limited' as const }
  const secret = generateTotpSecret()
  const b32 = base32Encode(secret)
  const enc = encryptSecret(b32, deps.pepper(), input.userId)
  const r = await db.execute(sql`
    INSERT INTO user_totp ("userId", "secretEnc", "createdAt") VALUES (${input.userId}, ${enc}, ${deps.now().toISOString()})
    ON CONFLICT ("userId") DO UPDATE SET "secretEnc" = EXCLUDED."secretEnc", "createdAt" = EXCLUDED."createdAt", "lastUsedStep" = NULL
      WHERE user_totp."confirmedAt" IS NULL
    RETURNING "userId"`)
  if (r.rows.length === 0) return { ok: false as const, reason: 'already_enabled' as const }
  await deps.audit({ action: 'TOTP_ENROL_STARTED', userId: input.userId, severity: 'info', summary: 'Inicio de alta de app autenticadora' })
  return { ok: true as const, secretBase32: b32, uri: otpauthUri({ secretBase32: b32, account: input.account }) }
}

/** Paso 2: confirma con un codigo valido, activa TOTP y entrega los codigos de respaldo UNA sola vez. */
export async function confirmEnrolWith(deps: TotpDeps, db: SqlExecutor, input: { userId: string; code: string; sessionId?: string | null; ip?: string | null }) {
  const lim = await deps.limiter(attemptKey(input.userId), TOTP_ATTEMPT_LIMIT, TOTP_ATTEMPT_WINDOW_MS)
  if (!lim.ok) return { ok: false as const, reason: 'rate_limited' as const }
  const r = await db.execute(sql`SELECT "secretEnc" FROM user_totp WHERE "userId" = ${input.userId} AND "confirmedAt" IS NULL`)
  const row = r.rows[0] as { secretEnc: string } | undefined
  if (!row) return { ok: false as const, reason: 'no_pending' as const }
  let step: number | null = null
  try {
    step = matchTotp(base32Decode(decryptSecret(row.secretEnc, deps.pepper(), input.userId)), input.code.trim(), deps.now().getTime())
  } catch {
    step = null
  }
  if (step === null) return { ok: false as const, reason: 'invalid' as const }
  const codes = generateBackupCodes()
  const done = await db.transaction(async (tx) => {
    const up = await tx.execute(sql`UPDATE user_totp SET "confirmedAt" = ${deps.now().toISOString()}, "lastUsedStep" = ${step}
      WHERE "userId" = ${input.userId} AND "confirmedAt" IS NULL RETURNING "userId"`)
    if (up.rows.length === 0) return false
    await tx.execute(sql`DELETE FROM user_backup_code WHERE "userId" = ${input.userId}`)
    for (const c of codes) {
      await tx.execute(sql`INSERT INTO user_backup_code (id, "userId", "codeHash") VALUES (${deps.newId('bc')}, ${input.userId}, ${hashBackupCode(c.replace('-', ''), deps.pepper())})`)
    }
    return true
  })
  if (!done) return { ok: false as const, reason: 'no_pending' as const }
  await grant(db, deps, { userId: input.userId, sessionId: input.sessionId, ip: input.ip, method: 'totp' })
  await deps.audit({ action: 'TOTP_ENABLED', userId: input.userId, severity: 'info', summary: 'App autenticadora activada', changes: { backupCodes: codes.length } })
  return { ok: true as const, backupCodes: codes }
}

/** Verifica un codigo TOTP (6 digitos) o de respaldo. `grant: false` es para re-autenticar sin abrir el segundo factor de la sesion. */
export async function verifyFactorWith(
  deps: TotpDeps,
  db: SqlExecutor,
  input: { userId: string; code: string; sessionId?: string | null; ip?: string | null; grant?: boolean },
): Promise<FactorResult> {
  const lim = await deps.limiter(attemptKey(input.userId), TOTP_ATTEMPT_LIMIT, TOTP_ATTEMPT_WINDOW_MS)
  if (!lim.ok) {
    await deps.audit({ action: 'TOTP_RATE_LIMITED', userId: input.userId, severity: 'warning', summary: 'Demasiados intentos de codigo TOTP/respaldo' })
    return { ok: false, reason: 'rate_limited' }
  }
  const f = classifyFactorInput(input.code)
  if (f.kind === 'invalid') return { ok: false, reason: 'invalid' }
  const toGrant = input.grant !== false

  if (f.kind === 'totp') {
    const r = await db.execute(sql`SELECT "secretEnc" FROM user_totp WHERE "userId" = ${input.userId} AND "confirmedAt" IS NOT NULL`)
    const row = r.rows[0] as { secretEnc: string } | undefined
    if (!row) return { ok: false, reason: 'not_enrolled' }
    let step: number | null = null
    try {
      step = matchTotp(base32Decode(decryptSecret(row.secretEnc, deps.pepper(), input.userId)), f.code, deps.now().getTime())
    } catch {
      return { ok: false, reason: 'invalid' }
    }
    if (step === null) {
      await deps.audit({ action: 'TOTP_FAILED', userId: input.userId, severity: 'warning', summary: 'Codigo TOTP incorrecto' })
      return { ok: false, reason: 'invalid' }
    }
    // Anti-replay ATOMICO: solo gana quien sube lastUsedStep; el mismo codigo (o uno de un paso anterior) no vuelve a servir.
    const claim = await db.execute(sql`UPDATE user_totp SET "lastUsedStep" = ${step}
      WHERE "userId" = ${input.userId} AND "confirmedAt" IS NOT NULL AND ("lastUsedStep" IS NULL OR "lastUsedStep" < ${step}) RETURNING "userId"`)
    if (claim.rows.length === 0) {
      await deps.audit({ action: 'TOTP_REPLAY_BLOCKED', userId: input.userId, severity: 'warning', summary: 'Codigo TOTP ya usado' })
      return { ok: false, reason: 'replayed' }
    }
    if (toGrant) await grant(db, deps, { userId: input.userId, sessionId: input.sessionId, ip: input.ip, method: 'totp' })
    await deps.audit({ action: 'TOTP_VERIFIED', userId: input.userId, severity: 'info', summary: toGrant ? 'Segundo factor TOTP verificado' : 'Re-autenticacion TOTP verificada' })
    return { ok: true, method: 'totp' }
  }

  // Codigo de respaldo: un solo UPDATE ... RETURNING decide quien lo usa (concurrencia segura, un solo uso).
  const enrolled = await userHasTotpWith(db, input.userId)
  if (!enrolled) return { ok: false, reason: 'not_enrolled' }
  const used = await db.execute(sql`UPDATE user_backup_code SET "usedAt" = ${deps.now().toISOString()}
    WHERE "userId" = ${input.userId} AND "codeHash" = ${hashBackupCode(f.code, deps.pepper())} AND "usedAt" IS NULL RETURNING id`)
  if (used.rows.length === 0) {
    await deps.audit({ action: 'BACKUP_CODE_FAILED', userId: input.userId, severity: 'warning', summary: 'Codigo de respaldo incorrecto o ya usado' })
    return { ok: false, reason: 'invalid' }
  }
  if (toGrant) await grant(db, deps, { userId: input.userId, sessionId: input.sessionId, ip: input.ip, method: 'backup_code' })
  const left = (await totpStatusWith(db, input.userId)).backupRemaining
  await deps.audit({ action: 'BACKUP_CODE_USED', userId: input.userId, severity: 'warning', summary: `Codigo de respaldo usado (quedan ${left})`, changes: { remaining: left } })
  return { ok: true, method: 'backup_code', backupRemaining: left }
}

/** Genera codigos nuevos e invalida los anteriores en una sola transaccion (el llamador ya re-autentico al usuario). */
export async function regenerateBackupCodesWith(deps: TotpDeps, db: SqlExecutor, input: { userId: string }) {
  const codes = generateBackupCodes()
  const ok = await db.transaction(async (tx) => {
    const own = await tx.execute(sql`SELECT 1 FROM user_totp WHERE "userId" = ${input.userId} AND "confirmedAt" IS NOT NULL FOR UPDATE`)
    if (own.rows.length === 0) return false
    await tx.execute(sql`DELETE FROM user_backup_code WHERE "userId" = ${input.userId}`)
    for (const c of codes) {
      await tx.execute(sql`INSERT INTO user_backup_code (id, "userId", "codeHash") VALUES (${deps.newId('bc')}, ${input.userId}, ${hashBackupCode(c.replace('-', ''), deps.pepper())})`)
    }
    return true
  })
  if (!ok) return { ok: false as const, reason: 'not_enrolled' as const }
  await deps.audit({ action: 'BACKUP_CODES_REGENERATED', userId: input.userId, severity: 'warning', summary: 'Codigos de respaldo regenerados', changes: { count: BACKUP_CODE_COUNT } })
  return { ok: true as const, backupCodes: codes }
}

export async function disableTotpWith(deps: TotpDeps, db: SqlExecutor, input: { userId: string }) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM user_backup_code WHERE "userId" = ${input.userId}`)
    await tx.execute(sql`DELETE FROM user_totp WHERE "userId" = ${input.userId}`)
  })
  await deps.audit({ action: 'TOTP_DISABLED', userId: input.userId, severity: 'warning', summary: 'App autenticadora desactivada' })
}