/**
 * Salud del correo de recuperacion de clave (anti-enumeracion).
 * Un fallo del proveedor de correo se detecta al enviar (solo ocurre para cuentas reales), por eso NO se
 * devuelve como error de esa solicitud: se registra y se "abre el circuito": durante unos minutos TODAS las
 * solicitudes (existan o no) reciben el mismo error generico, y se suma un retardo minimo uniforme.
 */
import type { EmailResult } from '@/lib/email'

export const RESET_MAIL_DOWN_WINDOW_MS = 5 * 60_000
export const RESET_MIN_RESPONSE_MS = 800
export const RESET_MAIL_UNAVAILABLE_MESSAGE =
  'No pudimos procesar el pedido en este momento. Intent\u00e1 de nuevo en unos minutos.'

let lastFailureAt = 0

export function recordResetMailResult(ok: boolean, now: number = Date.now()): void {
  if (!ok) lastFailureAt = now
  else lastFailureAt = 0
}

export function resetMailLooksDown(
  opts: { configured: boolean; production: boolean },
  now: number = Date.now(),
): boolean {
  if (opts.production && !opts.configured) return true
  return lastFailureAt > 0 && now - lastFailureAt < RESET_MAIL_DOWN_WINDOW_MS
}

/** Solo es exito si el proveedor confirmo; en desarrollo sin proveedor se acepta (queda en el log). */
export function resetMailSucceeded(result: EmailResult | undefined, production: boolean): boolean {
  if (!result || !result.ok) return false
  return result.delivered || !production
}

export function _resetHealthForTests(): void {
  lastFailureAt = 0
}

export async function padToMinDuration(startedAt: number, minMs: number = RESET_MIN_RESPONSE_MS): Promise<void> {
  const left = minMs - (Date.now() - startedAt)
  if (left > 0) await new Promise((r) => setTimeout(r, left))
}