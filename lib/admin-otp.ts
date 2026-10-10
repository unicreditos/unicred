import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { brandedEmailHtml, sendEmail } from '@/lib/email'
import { createPgOtpStore, hasFreshSecondFactorWith } from '@/lib/otp-pg-store'
import { issueOtp, otpAuditEntry, verifyOtp, type OtpDeps } from '@/lib/otp-service'

export { OtpError } from '@/lib/otp-service'

function pepper(): string {
  const p = (process.env.TWOFA_PEPPER || process.env.BETTER_AUTH_SECRET || '').trim()
  if (p.length < 16) throw new Error('Falta TWOFA_PEPPER (o BETTER_AUTH_SECRET) para firmar los códigos.')
  return p
}

const deps: OtpDeps = {
  store: createPgOtpStore(db),
  now: () => new Date(),
  pepper,
  production: process.env.NODE_ENV === 'production',
  newId: (prefix) => `${prefix}_${randomUUID()}`,
  async audit(e) {
    await recordAudit(otpAuditEntry(e)).catch(() => undefined)
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

export const hasFreshSecondFactor = (userId: string, sessionId?: string | null) => hasFreshSecondFactorWith(db, userId, sessionId)
