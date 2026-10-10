/**
 * Logica del OTP por correo con dependencias inyectadas (base, correo, reloj, auditoria).
 * Asi se prueba completa sin base ni proveedor. Nunca registra ni devuelve el codigo.
 */
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtp,
  otpMatches,
  otpState,
} from '@/lib/admin-otp-core'

export type OtpRecord = {
  id: string
  userId: string
  codeHash: string
  expiresAt: Date
  attempts: number
  usedAt: Date | null
  createdAt: Date
  ip: string | null
}

export interface OtpStore {
  /**
   * ATOMICO por usuario (serializa envios simultaneos): verifica la espera entre envios y el tope por hora,
   * invalida los codigos abiertos y guarda el nuevo. Sin esto, pedidos en paralelo saltan los limites.
   */
  reserveSend(input: { rec: OtpRecord; cooldownMs: number; maxPerHour: number }): Promise<
    { ok: true } | { ok: false; reason: 'cooldown'; retryAfterSec: number } | { ok: false; reason: 'rate_limited' }
  >
  /** Invalida todo codigo abierto del usuario (usedAt = ahora). */
  invalidateOpen(userId: string, now: Date): Promise<void>
  latest(userId: string): Promise<OtpRecord | null>
  /** Atomico: suma 1 intento solo si sigue abierto, sin vencer y con intentos disponibles. */
  consumeAttempt(id: string, now: Date): Promise<OtpRecord | null>
  /** Atomico: marca usado solo si seguia abierto. Devuelve si lo logro. */
  markUsed(id: string, now: Date): Promise<boolean>
  grantFactor(input: { id: string; userId: string; sessionId: string; ip: string | null; now: Date }): Promise<void>
}

export type MailResult = { ok: boolean; delivered: boolean; error?: string }

export type OtpDeps = {
  store: OtpStore
  sendMail: (input: { to: string; code: string; minutes: number }) => Promise<MailResult>
  audit: (event: { action: string; userId: string; severity?: 'info' | 'warning' | 'error'; summary: string; changes?: Record<string, unknown> }) => Promise<void>
  now: () => Date
  pepper: () => string
  production: boolean
  newId: (prefix: string) => string
}

export type OtpAuditEvent = Parameters<OtpDeps['audit']>[0]

/** Fila de auditoria (la misma que graba recordAudit) para un evento del OTP. */
export function otpAuditEntry(e: OtpAuditEvent) {
  return {
    actorUserId: e.userId,
    action: e.action,
    entityType: 'session',
    entityId: e.userId,
    targetUserId: e.userId,
    severity: e.severity ?? 'info',
    summary: e.summary,
    changes: e.changes,
  }
}

export class OtpError extends Error {
  constructor(
    public code: 'rate_limited' | 'cooldown' | 'mail_failed' | 'config',
    message: string,
    public retryAfterSec?: number,
  ) {
    super(message)
  }
}

export type VerifyFailure = 'none' | 'expired' | 'locked' | 'invalid' | 'no_session'

export async function issueOtp(deps: OtpDeps, input: { userId: string; email: string; ip?: string | null }) {
  const now = deps.now()
  let pepper: string
  try {
    pepper = deps.pepper()
  } catch (err) {
    await deps.audit({ action: 'AUTH_2FA_SEND_FAILED', userId: input.userId, severity: 'error', summary: 'Falta la clave para firmar los códigos', changes: { error: (err as Error).message } })
    throw new OtpError('config', 'No pudimos generar el código. Intentá más tarde.')
  }

  const code = generateOtpCode()
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS)
  const reservation = await deps.store.reserveSend({
    rec: {
      id: deps.newId('otp'),
      userId: input.userId,
      codeHash: hashOtp(code, input.userId, pepper),
      expiresAt,
      attempts: 0,
      usedAt: null,
      createdAt: now,
      ip: input.ip ?? null,
    },
    cooldownMs: OTP_RESEND_COOLDOWN_MS,
    maxPerHour: OTP_MAX_SENDS_PER_HOUR,
  })
  if (!reservation.ok) {
    if (reservation.reason === 'cooldown') {
      throw new OtpError('cooldown', 'Esperá unos segundos antes de pedir otro código.', reservation.retryAfterSec)
    }
    await deps.audit({ action: 'AUTH_2FA_SEND_LIMIT', userId: input.userId, severity: 'warning', summary: 'Límite de envíos de código por hora alcanzado' })
    throw new OtpError('rate_limited', 'Pediste demasiados códigos. Probá de nuevo en una hora.', 3600)
  }

  let result: MailResult
  try {
    result = await deps.sendMail({ to: input.email, code, minutes: Math.round(OTP_TTL_MS / 60_000) })
  } catch (err) {
    result = { ok: false, delivered: false, error: (err as Error).message }
  }
  // Falla cerrado: si el correo no salio (o en produccion no se confirmo la entrega), el codigo no sirve.
  if (!result.ok || (deps.production && !result.delivered)) {
    await deps.store.invalidateOpen(input.userId, deps.now())
    await deps.audit({ action: 'AUTH_2FA_SEND_FAILED', userId: input.userId, severity: 'error', summary: 'No se pudo enviar el código de verificación por correo', changes: { error: result.error ?? 'sin confirmación de entrega' } })
    throw new OtpError('mail_failed', 'No pudimos enviar el código por correo. Intentá de nuevo en unos minutos.')
  }
  await deps.audit({ action: 'AUTH_2FA_CODE_SENT', userId: input.userId, summary: 'Código de verificación enviado por correo', changes: { expiraEn: '10 min', ip: input.ip ?? null } })
  return { expiresAt, resendAfterSec: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) }
}

export async function verifyOtp(
  deps: OtpDeps,
  input: { userId: string; code: string; ip?: string | null; sessionId?: string | null },
): Promise<{ ok: true } | { ok: false; reason: VerifyFailure }> {
  const now = deps.now()
  if (!input.sessionId) return { ok: false, reason: 'no_session' }
  const row = await deps.store.latest(input.userId)
  if (!row) return { ok: false, reason: 'none' }
  const state = otpState(row, now)
  if (state === 'used') return { ok: false, reason: 'none' }
  if (state === 'locked') return { ok: false, reason: 'locked' }
  if (state === 'expired') return { ok: false, reason: 'expired' }

  // Cada intento cuenta (acierte o no) y se descuenta de forma atomica: no se puede apurar en paralelo.
  const updated = await deps.store.consumeAttempt(row.id, now)
  if (!updated) {
    const fresh = await deps.store.latest(input.userId)
    const s = fresh ? otpState(fresh, now) : 'used'
    return { ok: false, reason: s === 'locked' ? 'locked' : s === 'expired' ? 'expired' : 'none' }
  }
  if (!otpMatches(String(input.code ?? '').trim(), input.userId, deps.pepper(), updated.codeHash)) {
    const locked = updated.attempts >= OTP_MAX_ATTEMPTS
    if (locked) await deps.store.markUsed(updated.id, now)
    await deps.audit({
      action: locked ? 'AUTH_2FA_LOCKED' : 'AUTH_2FA_FAILED',
      userId: input.userId,
      severity: 'warning',
      summary: locked ? 'Código invalidado por demasiados intentos' : 'Código de verificación incorrecto',
      changes: { intento: updated.attempts, ip: input.ip ?? null },
    })
    return { ok: false, reason: locked ? 'locked' : 'invalid' }
  }
  // Un solo uso: si otro pedido lo consumio primero, este falla.
  if (!(await deps.store.markUsed(updated.id, now))) return { ok: false, reason: 'none' }
  await deps.store.grantFactor({ id: deps.newId('sf'), userId: input.userId, sessionId: input.sessionId, ip: input.ip ?? null, now })
  await deps.audit({ action: 'AUTH_2FA_VERIFIED', userId: input.userId, summary: 'Segundo factor verificado para la sesión', changes: { ip: input.ip ?? null } })
  return { ok: true }
}