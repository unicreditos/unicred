/** Nucleo puro del OTP por correo para operadores (sin base de datos ni correo). */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

export const OTP_DIGITS = 6
export const OTP_TTL_MS = 10 * 60_000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_MAX_SENDS_PER_HOUR = 5
export const SECOND_FACTOR_TTL_MS = 30 * 60_000

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, '0')
}

export function hashOtp(code: string, userId: string, pepper: string): string {
  return createHmac('sha256', pepper).update(`${userId}:${code}`).digest('hex')
}

export function otpMatches(code: string, userId: string, pepper: string, expectedHash: string): boolean {
  if (!new RegExp(`^\\d{${OTP_DIGITS}}$`).test(code)) return false
  const a = Buffer.from(hashOtp(code, userId, pepper), 'hex')
  const b = Buffer.from(String(expectedHash), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export type OtpRowState = { expiresAt: Date; attempts: number; usedAt: Date | null }

export function otpState(row: OtpRowState, now: Date = new Date()): 'ok' | 'expired' | 'locked' | 'used' {
  if (row.usedAt) return 'used'
  if (row.attempts >= OTP_MAX_ATTEMPTS) return 'locked'
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'ok'
}

export function secondFactorFresh(verifiedAt: Date | null | undefined, now: Date = new Date()): boolean {
  return !!verifiedAt && now.getTime() - verifiedAt.getTime() < SECOND_FACTOR_TTL_MS
}

export function requireSecondFactorForEvidence(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ADMIN_EVIDENCE_REQUIRE_2FA ?? 'yes').trim().toLowerCase() !== 'no'
}