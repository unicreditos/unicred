import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { brandedEmailHtml, sendEmail } from '@/lib/email'
import { secondFactorFresh } from '@/lib/admin-otp-core'
import { issueOtp, verifyOtp, type OtpDeps, type OtpRecord, type OtpStore } from '@/lib/otp-service'

export { OtpError } from '@/lib/otp-service'

type Row = Record<string, unknown>

function pepper(): string {
  const p = (process.env.TWOFA_PEPPER || process.env.BETTER_AUTH_SECRET || '').trim()
  if (p.length < 16) throw new Error('Falta TWOFA_PEPPER (o BETTER_AUTH_SECRET) para firmar los códigos.')
  return p
}

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

const pgStore: OtpStore = {
  async countSendsSince(userId, since) {
    const r = await db.execute(sql`SELECT count(*)::int AS n FROM admin_email_otp WHERE "userId" = ${userId} AND "createdAt" > ${since.toISOString()}`)
    return Number((r.rows[0] as Row).n)
  },
  async latestCreatedAt(userId) {
    const r = await db.execute(sql`SELECT max("createdAt") AS v FROM admin_email_otp WHERE "userId" = ${userId}`)
    const v = (r.rows[0] as Row | undefined)?.v
    return v ? new Date(v as string) : null
  },
  async invalidateOpen(userId, now) {
    await db.execute(sql`UPDATE admin_email_otp SET "usedAt" = ${now.toISOString()} WHERE "userId" = ${userId} AND "usedAt" IS NULL`)
  },
  async insert(rec) {
    await db.execute(sql`
      INSERT INTO admin_email_otp (id, "userId", "codeHash", "expiresAt", ip, "createdAt")
      VALUES (${rec.id}, ${rec.userId}, ${rec.codeHash}, ${rec.expiresAt.toISOString()}, ${rec.ip}, ${rec.createdAt.toISOString()})`)
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

const deps: OtpDeps = {
  store: pgStore,
  now: () => new Date(),
  pepper,
  production: process.env.NODE_ENV === 'production',
  newId: (prefix) => `${prefix}_${randomUUID()}`,
  async audit(e) {
    await recordAudit({
      actorUserId: e.userId,
      action: e.action,
      entityType: 'session',
      entityId: e.userId,
      targetUserId: e.userId,
      severity: e.severity ?? 'info',
      summary: e.summary,
      changes: e.changes,
    }).catch(() => undefined)
  },
  async sendMail({ to, code, minutes }) {
    return sendEmail({
      to,
      subject: 'Tu código de verificación de UNICRÉDITOS',
      html: brandedEmailHtml({
        title: 'Código de verificación',
        bodyHtml: `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">Ingresá este código para continuar:</p><p style="font-size:30px;letter-spacing:6px;font-weight:700;margin:0 0 16px">${code}</p><p style="font-size:13px;color:#555;margin:0">Vence en ${minutes} minutos y se puede usar una sola vez. Si no lo pediste, avisá a seguridad.</p>`,
        footerNote: 'Nunca compartas este código.',
      }),
      text: `Tu código de verificación es ${code}. Vence en ${minutes} minutos y se usa una sola vez. Nunca lo compartas.`,
    })
  },
}

export const issueAdminOtp = (input: { userId: string; email: string; ip?: string | null }) => issueOtp(deps, input)
export const verifyAdminOtp = (input: { userId: string; code: string; ip?: string | null; sessionId?: string | null }) =>
  verifyOtp(deps, input)

export async function hasFreshSecondFactor(userId: string, sessionId?: string | null): Promise<boolean> {
  const res = await db.execute(
    sessionId
      ? sql`SELECT max("verifiedAt") AS v FROM admin_second_factor WHERE "userId" = ${userId} AND "sessionId" = ${sessionId}`
      : sql`SELECT max("verifiedAt") AS v FROM admin_second_factor WHERE "userId" = ${userId}`,
  )
  const v = (res.rows[0] as Row | undefined)?.v
  return secondFactorFresh(v ? new Date(v as string) : null)
}