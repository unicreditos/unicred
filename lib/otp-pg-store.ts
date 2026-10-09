/**
 * Acceso a Postgres del OTP por correo y del segundo factor. Recibe el ejecutor de SQL (no importa lib/db),
 * asi el mismo codigo corre en la app y en las pruebas de integracion contra una base de prueba.
 */
import { sql, type SQL } from 'drizzle-orm'
import { secondFactorFresh } from '@/lib/admin-otp-core'
import type { OtpRecord, OtpStore } from '@/lib/otp-service'

type Exec = { execute: (query: SQL) => Promise<{ rows: unknown[] }> }
export type SqlExecutor = Exec & { transaction: <T>(fn: (tx: Exec) => Promise<T>) => Promise<T> }
type Row = Record<string, unknown>

function toRecord(r: Row): OtpRecord {
  return {
    id: String(r.id),
    userId: String(r.userId),
    codeHash: String(r.codeHash),
    expiresAt: new Date(r.expiresAt as string),
    attempts: Number(r.attempts),
    usedAt: r.usedAt ? new Date(r.usedAt as string) : null,
    createdAt: new Date(r.createdAt as string),
    ip: (r.ip as string | null) ?? null,
  }
}

export function createPgOtpStore(db: SqlExecutor): OtpStore {
  return {
    async reserveSend({ rec, cooldownMs, maxPerHour }) {
      return db.transaction(async (tx) => {
        // Serializa los envios del mismo usuario: el segundo espera a que el primero termine.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`otp_send:${rec.userId}`}))`)
        const now = rec.createdAt
        const last = await tx.execute(sql`SELECT max("createdAt") AS v FROM admin_email_otp WHERE "userId" = ${rec.userId}`)
        const lastAt = (last.rows[0] as Row | undefined)?.v ? new Date((last.rows[0] as Row).v as string) : null
        if (lastAt) {
          const wait = cooldownMs - (now.getTime() - lastAt.getTime())
          if (wait > 0) return { ok: false as const, reason: 'cooldown' as const, retryAfterSec: Math.ceil(wait / 1000) }
        }
        const since = new Date(now.getTime() - 3_600_000)
        const sent = await tx.execute(sql`SELECT count(*)::int AS n FROM admin_email_otp WHERE "userId" = ${rec.userId} AND "createdAt" > ${since.toISOString()}`)
        if (Number((sent.rows[0] as Row).n) >= maxPerHour) return { ok: false as const, reason: 'rate_limited' as const }
        await tx.execute(sql`UPDATE admin_email_otp SET "usedAt" = ${now.toISOString()} WHERE "userId" = ${rec.userId} AND "usedAt" IS NULL`)
        await tx.execute(sql`
          INSERT INTO admin_email_otp (id, "userId", "codeHash", "expiresAt", ip, "createdAt")
          VALUES (${rec.id}, ${rec.userId}, ${rec.codeHash}, ${rec.expiresAt.toISOString()}, ${rec.ip}, ${rec.createdAt.toISOString()})`)
        return { ok: true as const }
      })
    },
    async invalidateOpen(userId, now) {
      await db.execute(sql`UPDATE admin_email_otp SET "usedAt" = ${now.toISOString()} WHERE "userId" = ${userId} AND "usedAt" IS NULL`)
    },
    async latest(userId) {
      const r = await db.execute(sql`SELECT * FROM admin_email_otp WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 1`)
      return r.rows[0] ? toRecord(r.rows[0] as Row) : null
    },
    async consumeAttempt(id, now) {
      const r = await db.execute(sql`
        UPDATE admin_email_otp SET attempts = attempts + 1
         WHERE id = ${id} AND "usedAt" IS NULL AND attempts < 5 AND "expiresAt" > ${now.toISOString()}
     RETURNING *`)
      return r.rows[0] ? toRecord(r.rows[0] as Row) : null
    },
    async markUsed(id, now) {
      const r = await db.execute(sql`UPDATE admin_email_otp SET "usedAt" = ${now.toISOString()} WHERE id = ${id} AND "usedAt" IS NULL RETURNING id`)
      return r.rows.length > 0
    },
    async grantFactor({ id, userId, sessionId, ip, now }) {
      await db.execute(sql`INSERT INTO admin_second_factor (id, "userId", "sessionId", ip, "verifiedAt") VALUES (${id}, ${userId}, ${sessionId}, ${ip}, ${now.toISOString()})`)
    },
  }
}

/** La sesion ya paso el codigo por correo. Falla cerrado ante errores. */
export async function sessionPassedSecondFactorWith(db: SqlExecutor, userId: string, sessionId: string | null | undefined): Promise<boolean> {
  if (!sessionId) return false
  try {
    const res = await db.execute(sql`SELECT 1 FROM admin_second_factor WHERE "userId" = ${userId} AND "sessionId" = ${sessionId} LIMIT 1`)
    return res.rows.length > 0
  } catch (err) {
    console.warn('[2fa] no se pudo leer el segundo factor:', (err as Error).message)
    return false
  }
}

export async function hasFreshSecondFactorWith(db: SqlExecutor, userId: string, sessionId?: string | null, now: Date = new Date()): Promise<boolean> {
  const res = await db.execute(
    sessionId
      ? sql`SELECT max("verifiedAt") AS v FROM admin_second_factor WHERE "userId" = ${userId} AND "sessionId" = ${sessionId}`
      : sql`SELECT max("verifiedAt") AS v FROM admin_second_factor WHERE "userId" = ${userId}`,
  )
  const v = (res.rows[0] as Row | undefined)?.v
  return secondFactorFresh(v ? new Date(v as string) : null, now)
}