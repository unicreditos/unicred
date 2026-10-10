/**
 * Topes de intentos para acciones caras o con proveedor externo (BCRA, solicitudes de credito, reclamos, pagos, cupones).
 * Reutiliza consumeRateLimit (contador atomico en Postgres) y falla CERRADO, igual que el segundo factor:
 * si el contador no responde, la accion se rechaza en vez de dejarse pasar sin limite.
 */
export const ACTION_LIMITS = {
  /** Consultas al BCRA del propio cliente (cada una llama a la API y guarda un registro). */
  bcra: { limit: 5, windowMs: 10 * 60_000 },
  /** Calculo de oferta: lo dispara la pantalla al cambiar plazo o monto. */
  'credit-quote': { limit: 20, windowMs: 10 * 60_000 },
  /** Solicitud de credito (y cambio de ficha verificada). */
  'credit-request': { limit: 5, windowMs: 10 * 60_000 },
  /** Reclamos y mensajes de soporte. */
  claim: { limit: 5, windowMs: 15 * 60_000 },
  /** Alta de pagos con proveedor: links, cancelacion anticipada, aviso de transferencia, procesar pago. */
  payment: { limit: 10, windowMs: 10 * 60_000 },
  /** Cupon publico (checkout desde /pagar): por usuario o, sin sesion, por IP. */
  'coupon-action': { limit: 10, windowMs: 10 * 60_000 },
  /** Consultas de cupones y cuponeras. */
  'coupon-lookup': { limit: 60, windowMs: 10 * 60_000 },
} as const

export type ActionLimitScope = keyof typeof ACTION_LIMITS

export type LimitConsumer = (key: string, limit: number, windowMs: number) => Promise<{ ok: boolean; retryInMs?: number }>

export const LIMIT_EXCEEDED_MESSAGE = 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
export const LIMIT_UNAVAILABLE_MESSAGE = 'No pudimos verificar el límite de intentos. Probá de nuevo en unos minutos.'

export type ActionLimitResult = { ok: true } | { ok: false; message: string; retryAfterSec: number; unavailable: boolean }

export const actionLimitKey = (scope: ActionLimitScope, subject: string) => `act:${scope}:${String(subject).slice(0, 200)}`

export async function checkActionLimit(scope: ActionLimitScope, subject: string, consume?: LimitConsumer): Promise<ActionLimitResult> {
  const { limit, windowMs } = ACTION_LIMITS[scope]
  try {
    const run = consume ?? (await import('@/lib/rate-limit')).consumeRateLimit
    const gate = await run(actionLimitKey(scope, subject), limit, windowMs)
    if (gate.ok) return { ok: true }
    return { ok: false, message: LIMIT_EXCEEDED_MESSAGE, retryAfterSec: Math.max(1, Math.ceil((gate.retryInMs ?? windowMs) / 1000)), unavailable: false }
  } catch {
    return { ok: false, message: LIMIT_UNAVAILABLE_MESSAGE, retryAfterSec: 60, unavailable: true }
  }
}

/** Para acciones que reportan errores lanzando (como createClaim o los pagos). */
export async function enforceActionLimit(scope: ActionLimitScope, subject: string, consume?: LimitConsumer) {
  const gate = await checkActionLimit(scope, subject, consume)
  if (!gate.ok) throw new Error(gate.message)
}