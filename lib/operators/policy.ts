/**
 * Reglas puras de la gestión de operadores (sin base ni red): se prueban solas
 * y el servicio las aplica antes de tocar nada.
 */

export const OPERATOR_PASSWORD_MIN = 12
export const OPERATOR_PASSWORD_MAX = 128
export const REASON_MIN = 10
export const VERIFY_MAIL_LIMIT = 3
export const VERIFY_MAIL_WINDOW_MS = 60 * 60_000

export function normalizeEmail(raw: string): string {
  return String(raw ?? '').trim().toLowerCase()
}

const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && email.length >= 6 && EMAIL_RE.test(email)
}

/** Dominios que nunca reciben correo real: sirven para marcar usuarios de prueba o inventados. */
export function isPlaceholderEmail(email: string): boolean {
  const domain = normalizeEmail(email).split('@')[1] ?? ''
  if (!domain) return true
  if (/(^|\.)(invalid|test|example|localhost|local|localdomain)$/.test(domain)) return true
  return /^(example|test|mailinator|yopmail|tempmail|10minutemail|guerrillamail)\./.test(domain)
}

export type PolicyResult = { ok: true } | { ok: false; message: string }

export function validateNewPassword(password: string, email?: string): PolicyResult {
  const pw = String(password ?? '')
  if (pw.length < OPERATOR_PASSWORD_MIN) return { ok: false, message: `La clave debe tener al menos ${OPERATOR_PASSWORD_MIN} caracteres.` }
  if (pw.length > OPERATOR_PASSWORD_MAX) return { ok: false, message: `La clave no puede superar ${OPERATOR_PASSWORD_MAX} caracteres.` }
  if (/^(.)\1+$/.test(pw)) return { ok: false, message: 'La clave no puede repetir un solo carácter.' }
  if (pw.trim() !== pw) return { ok: false, message: 'La clave no puede empezar ni terminar con espacios.' }
  const e = normalizeEmail(email ?? '')
  if (e && (pw.toLowerCase() === e || pw.toLowerCase() === e.split('@')[0])) {
    return { ok: false, message: 'La clave no puede ser igual al email.' }
  }
  return { ok: true }
}

export function validateReason(reason: string): PolicyResult {
  if (String(reason ?? '').trim().length < REASON_MIN) {
    return { ok: false, message: `Escribí el motivo (al menos ${REASON_MIN} caracteres).` }
  }
  return { ok: true }
}

/** Tablas que cuelgan del usuario pero no son historial: se van con él. */
export const NON_HISTORY_TABLES = new Set([
  'session',
  'account',
  'profile',
  'inbox_receipt',
  'support_presence',
])

export type DeleteFacts = {
  actorId: string
  targetId: string
  targetIsOperator: boolean
  /** Otros operadores activos con permiso users.manage, sin contar al objetivo. */
  otherActiveManagers: number
  /** Tabla -> filas del objetivo, solo tablas que cuentan como historial. */
  historyCounts: Record<string, number>
  /** Entradas de auditoría de negocio escritas por el objetivo (sin ingresos/cierres de sesión). */
  authoredAudit: number
  /** Entradas de auditoría sobre el objetivo (alta, ingresos, etc.). */
  anyAuditRows: number
  sessions: number
  emailVerified: boolean
}

export type DeleteDecision =
  | { allowed: true; mode: 'hard' | 'soft' }
  | { allowed: false; message: string; code: 'not_operator' | 'self' | 'last_manager' | 'has_history' }

export function decideDelete(f: DeleteFacts): DeleteDecision {
  if (!f.targetIsOperator) {
    return { allowed: false, code: 'not_operator', message: 'Desde esta pantalla solo se gestionan operadores. Los clientes no se eliminan acá.' }
  }
  if (f.actorId === f.targetId) return { allowed: false, code: 'self', message: 'No podés eliminar tu propia cuenta.' }
  if (f.otherActiveManagers < 1) {
    return { allowed: false, code: 'last_manager', message: 'No se puede eliminar al último administrador activo con permiso para gestionar operadores.' }
  }
  const blocking = Object.entries(f.historyCounts).filter(([, n]) => n > 0)
  if (blocking.length || f.authoredAudit > 0) {
    const parts = blocking.map(([t, n]) => `${t} (${n})`)
    if (f.authoredAudit > 0) parts.push(`auditoría propia (${f.authoredAudit})`)
    return {
      allowed: false,
      code: 'has_history',
      message: `Tiene historial y no se puede eliminar: ${parts.join(', ')}. Bloqueá la cuenta en su lugar.`,
    }
  }
  // Huérfano real: nunca entró, nunca verificó y no dejó rastro. El resto se desactiva y anonimiza.
  const orphan = f.sessions === 0 && !f.emailVerified && f.anyAuditRows === 0
  return { allowed: true, mode: orphan ? 'hard' : 'soft' }
}

export function anonymizedEmail(userId: string): string {
  return `eliminado+${userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}@example.invalid`
}

export function isAnonymizedEmail(email: string): boolean {
  return /^eliminado\+[a-z0-9]+@example\.invalid$/.test(normalizeEmail(email))
}
