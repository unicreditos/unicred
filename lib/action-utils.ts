import { WalletError } from '@/lib/wallet/ledger'
import { consumeRateLimit, formatRetry } from '@/lib/rate-limit'
import { AMOUNT_HELP, amountProblem, parseAmountText } from '@/lib/wallet/adjustment'

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * Envuelve una acción: los errores pensados para la persona (WalletError, o el texto de un permiso faltante) se
 * devuelven tal cual; cualquier otro se registra en el servidor y se muestra genérico para no filtrar detalles.
 */
export async function guard<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) }
  } catch (err) {
    if (err instanceof WalletError) return { ok: false, error: err.message }
    const msg = err instanceof Error ? err.message : ''
    if (/^(No tenés el permiso|No autorizado|Tu sesión venció|Cuenta suspendida|La sesión de administrador)/.test(msg)) {
      return { ok: false, error: msg }
    }
    // Violación de índice único (referencia repetida por un doble clic).
    if (((err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code) === '23505' || /duplicate key|unique constraint/i.test(msg)) {
      return { ok: false, error: 'Esa operación ya se registró. Revisá tus movimientos antes de reintentar.' }
    }
    console.error('[action] error inesperado:', msg)
    return { ok: false, error: 'No pudimos completar la operación. Probá de nuevo en unos minutos.' }
  }
}

/** Parsea un importe escrito por una persona ("1.250,50" o "1250.5") a centavos enteros. Misma regla que el navegador. */
export function parseAmountToCents(input: string | number): number {
  if (typeof input === 'number') {
    const cents = Math.round(input * 100)
    // Un número de la API con más de dos decimales (10.005) casi seguro es un error: no se redondea en silencio.
    if (!Number.isFinite(input) || input <= 0 || Math.abs(input * 100 - cents) > 1e-6) throw new WalletError('Ingresá un importe válido, con hasta dos decimales.')
    return cents
  }
  if (!String(input ?? '').trim()) throw new WalletError('Ingresá un importe.')
  const cents = parseAmountText(String(input))
  if (cents === null) throw new WalletError(amountProblem(String(input)) ?? AMOUNT_HELP)
  return cents
}

/**
 * Verifica el rate limit para una acción del servidor y lanza WalletError si se superó.
 * Centraliza el helper `limit()` que existía duplicado en cada archivo de acciones.
 */
export async function assertRateLimit(key: string, max: number, windowMs: number): Promise<void> {
  const gate = await consumeRateLimit(key, max, windowMs)
  if (!gate.ok) throw new WalletError(`Hiciste muchos intentos. Probá de nuevo en ${formatRetry(gate.retryInMs)}.`)
}
