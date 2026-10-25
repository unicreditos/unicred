/**
 * Lógica pura del ajuste manual de saldo (acreditar / debitar). Sirve en el navegador (vista previa del formulario) y en
 * el servidor (límites y validación), así los dos coinciden. Sin dependencias de base de datos.
 */

export type AdjustDirection = 'credit' | 'debit'

export const MIN_ADJUST_CENTS = 100 // $1
export const MAX_ADJUST_CENTS = 5_000_000_000 // $50.000.000 por ajuste
export const MIN_REASON = 10
export const MAX_REASON = 300

/** Motivos frecuentes: aceleran la carga y dan un vocabulario uniforme a la auditoría. */
export const REASON_SUGGESTIONS: Record<AdjustDirection, string[]> = {
  credit: ['Acreditación manual de una transferencia recibida', 'Corrección de saldo', 'Devolución al cliente', 'Bonificación comercial'],
  debit: ['Corrección de saldo', 'Cobro acreditado por duplicado', 'Reversión de una acreditación', 'Contracargo informado por el procesador'],
}

/**
 * Interpreta un importe escrito por una persona ("1.250,50" o "1250.5") como centavos enteros. Misma regla que
 * `parseAmountToCents` del servidor; devuelve null si no es un importe válido.
 */
export function parseAmountText(input: string): number | null {
  const raw = String(input ?? '').trim().replace(/\s/g, '').replace(/^\$/, '')
  if (!raw) return null
  let normalized = raw
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.')
  else if ((raw.match(/\./g) ?? []).length > 1) normalized = raw.replace(/\./g, '')
  // Solo dígitos y hasta dos decimales: sin notación científica ("1e3"), hexadecimal ("0x10") ni centésimas de centavo.
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

/** "1.250" sin coma: en Argentina suele ser mil doscientos cincuenta, pero con punto decimal sería $1,25. Se rechaza para que lo aclare. */
export function isAmbiguousThousands(input: string) {
  return /^\$?\s*\d{1,3}\.\d{3}$/.test(String(input ?? '').trim())
}

export const AMOUNT_HELP = 'Ingresá un importe válido, con hasta dos decimales (por ejemplo 1250 o 1.250,50).'

/** Por qué no se entiende lo escrito (null si está vacío o es válido), con el mensaje que ve la persona. */
export function amountProblem(input: string): string | null {
  const text = String(input ?? '').trim()
  if (!text || parseAmountText(text) !== null) return null
  if (isAmbiguousThousands(text)) {
    const digits = text.replace(/\D/g, '')
    return `El importe "${text}" es ambiguo: escribilo como ${digits} (sin puntos) o con coma, por ejemplo ${digits},00.`
  }
  return AMOUNT_HELP
}

export type AdjustPreview = {
  /** Importe interpretado, en centavos (null si todavía no hay un importe válido) */
  cents: number | null
  /** Saldo después del ajuste (null si no se puede calcular) */
  resultingCents: number | null
  /** Qué está mal con el importe, para mostrarlo (null si está bien o todavía no escribió nada) */
  error: string | null
  /** El importe escrito se podría haber querido de otra manera */
  ambiguous: boolean
}

export function previewAdjustment(input: { balanceCents: number; direction: AdjustDirection; amountText: string }): AdjustPreview {
  const text = String(input.amountText ?? '').trim()
  if (!text) return { cents: null, resultingCents: null, error: null, ambiguous: false }
  const cents = parseAmountText(text)
  const ambiguous = isAmbiguousThousands(text)
  if (cents === null) return { cents: null, resultingCents: null, error: amountProblem(text) ?? AMOUNT_HELP, ambiguous }
  if (cents < MIN_ADJUST_CENTS) return { cents, resultingCents: null, error: 'El mínimo por ajuste es $1,00.', ambiguous }
  if (cents > MAX_ADJUST_CENTS) return { cents, resultingCents: null, error: 'El máximo por ajuste es $50.000.000,00.', ambiguous }
  const resultingCents = input.direction === 'credit' ? input.balanceCents + cents : input.balanceCents - cents
  if (input.direction === 'debit' && resultingCents < 0) {
    return { cents, resultingCents, error: 'El saldo no alcanza para este débito: la billetera no puede quedar en negativo.', ambiguous }
  }
  return { cents, resultingCents, error: null, ambiguous }
}

export function reasonProblem(reason: string): string | null {
  const len = String(reason ?? '').trim().length
  if (len < MIN_REASON) return `Contá el motivo (faltan ${MIN_REASON - len} caracteres): queda en la auditoría.`
  return null
}

/** Identificador estable por intento: un doble clic repite el mismo y el asiento no se duplica. */
export function isValidAttemptId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id)
}
