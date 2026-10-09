import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { brandedEmailHtml, sendEmail } from '@/lib/email'
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtp,
  otpMatches,
  otpState,
  secondFactorFresh,
} from '@/lib/admin-otp-core'

function pepper(): string {
  const p = (process.env.TWOFA_PEPPER || process.env.BETTER_AUTH_SECRET || '').trim()
  if (p.length < 16) throw new Error('Falta TWOFA_PEPPER (o BETTER_AUTH_SECRET) para firmar los c\u00f3digos.')
  return p
}

type Row = Record<string, unknown>

/** Genera y env\u00eda por correo un c\u00f3digo de 6 d\u00edgitos (solo se guarda el hash). Falla cerrado si el correo no sale. */
export async function issueAdminOtp(input: { userId: string; email: string; ip?: string | null }): Promise<{ expiresAt: Date }> {
  const sent = await db.execute(
    sql`SELECT count(*)::int AS n FROM admin_email_otp WHERE "userId" = ${input.userId} AND "createdAt" > now() - interval '1 hour'`,
  )
  if (Number((sent.rows[0] as Row).n) >= OTP_MAX_SENDS_PER_HOUR) {
    throw new Error('Pediste demasiados c\u00f3digos. Prob\u00e1 de nuevo en una hora.')
  }
  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  await db.execute(sql`UPDATE admin_email_otp SET "usedAt" = now() WHERE "userId" = ${input.userId} AND "usedAt" IS NULL`)
  await db.execute(sql`
    INSERT INTO admin_email_otp (id, "userId", "codeHash", "expiresAt", ip)
    VALUES (${`otp_${randomUUID()}`}, ${input.userId}, ${hashOtp(code, input.userId, pepper())}, ${expiresAt.toISOString()}, ${input.ip ?? null})`)
  const minutes = Math.round(OTP_TTL_MS / 60_000)
  const result = await sendEmail({
    to: input.email,
    subject: 'Tu c\u00f3digo de verificaci\u00f3n de UNICR\u00c9DITOS',
    html: brandedEmailHtml({
      title: 'C\u00f3digo de verificaci\u00f3n',
      bodyHtml: `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">Para ver documentaci\u00f3n de identidad de clientes ingres\u00e1 este c\u00f3digo:</p><p style="font-size:30px;letter-spacing:6px;font-weight:700;margin:0 0 16px">${code}</p><p style="font-size:13px;color:#555;margin:0">Vence en ${minutes} minutos y se puede usar una sola vez. Si no lo pediste, avis\u00e1 a seguridad.</p>`,
      footerNote: 'Nunca compartas este c\u00f3digo.',
    }),
    text: `Tu c\u00f3digo de verificaci\u00f3n es ${code}. Vence en ${minutes} minutos y se usa una sola vez.`,
  })
  if (!result.ok || (!result.delivered && process.env.NODE_ENV === 'production')) {
    await db.execute(sql`UPDATE admin_email_otp SET "usedAt" = now() WHERE "userId" = ${input.userId} AND "usedAt" IS NULL`)
    throw new Error('No pudimos enviar el c\u00f3digo por correo. Intent\u00e1 de nuevo en unos minutos.')
  }
  return { expiresAt }
}

export async function verifyAdminOtp(input: {
  userId: string
  code: string
  ip?: string | null
}): Promise<{ ok: true } | { ok: false; reason: 'none' | 'expired' | 'locked' | 'invalid' }> {
  const res = await db.execute(
    sql`SELECT id, "codeHash", "expiresAt", attempts, "usedAt" FROM admin_email_otp WHERE "userId" = ${input.userId} ORDER BY "createdAt" DESC LIMIT 1`,
  )
  const row = res.rows[0] as Row | undefined
  if (!row) return { ok: false, reason: 'none' }
  const state = otpState({
    expiresAt: new Date(row.expiresAt as string),
    attempts: Number(row.attempts),
    usedAt: row.usedAt ? new Date(row.usedAt as string) : null,
  })
  if (state === 'used') return { ok: false, reason: 'none' }
  if (state === 'locked') return { ok: false, reason: 'locked' }
  if (state === 'expired') return { ok: false, reason: 'expired' }
  // Cada intento cuenta, acierte o no, para frenar la fuerza bruta.
  await db.execute(sql`UPDATE admin_email_otp SET attempts = attempts + 1 WHERE id = ${row.id as string}`)
  if (!otpMatches(String(input.code ?? '').trim(), input.userId, pepper(), String(row.codeHash))) {
    return { ok: false, reason: Number(row.attempts) + 1 >= OTP_MAX_ATTEMPTS ? 'locked' : 'invalid' }
  }
  await db.execute(sql`UPDATE admin_email_otp SET "usedAt" = now() WHERE id = ${row.id as string}`)
  await db.execute(sql`INSERT INTO admin_second_factor (id, "userId", ip) VALUES (${`sf_${randomUUID()}`}, ${input.userId}, ${input.ip ?? null})`)
  return { ok: true }
}

export async function hasFreshSecondFactor(userId: string): Promise<boolean> {
  const res = await db.execute(sql`SELECT max("verifiedAt") AS v FROM admin_second_factor WHERE "userId" = ${userId}`)
  const v = (res.rows[0] as Row | undefined)?.v
  return secondFactorFresh(v ? new Date(v as string) : null)
}