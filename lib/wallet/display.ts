/**
 * Cómo se muestra un asiento de la billetera. Módulo puro (sirve en el navegador y en el servidor).
 *
 * Algunos asientos heredados de `unicred` guardan en `notes` un JSON del proveedor (p. ej. una carga "pendiente"):
 * nunca se muestra crudo, y un asiento pendiente NO suma ni resta (todavía no se acreditó).
 */

export type MovementNote = { pending: boolean; text: string | null }

export function parseMovementNote(notes: string | null | undefined): MovementNote {
  const raw = String(notes ?? '').trim()
  if (!raw) return { pending: false, text: null }
  if (raw.startsWith('{')) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>
      const state = String(j.estado ?? j.status ?? '').toLowerCase()
      const pending = state === 'pendiente' || state === 'pending'
      const kind = String(j.tipo ?? '').toLowerCase()
      const text = pending
        ? kind === 'carga' ? 'Carga pendiente de acreditación' : 'Operación pendiente de acreditación'
        : kind === 'carga' ? 'Carga de saldo' : null
      return { pending, text }
    } catch {
      return { pending: false, text: null }
    }
  }
  return { pending: false, text: raw }
}

export function isPendingMovement(notes: string | null | undefined) {
  return parseMovementNote(notes).pending
}

/** Condición SQL equivalente (para sumar solo lo acreditado). */
export const POSTED_SQL = `(coalesce(notes, '') not like '%"estado":"pendiente"%' and coalesce(notes, '') not like '%"estado": "pendiente"%')`

/** Medios de pago de Mercado Pago tal como los informa su API → cómo los lee una persona. */
const MP_METHODS: Record<string, string> = {
  account_money: 'dinero en cuenta de Mercado Pago',
  interop_transfer: 'transferencia',
  bank_transfer: 'transferencia bancaria',
  debvisa: 'débito Visa',
  debmaster: 'débito Mastercard',
  debcabal: 'débito Cabal',
  visa: 'crédito Visa',
  master: 'crédito Mastercard',
  amex: 'American Express',
  naranja: 'Naranja',
  cabal: 'Cabal',
  argencard: 'Argencard',
  cordobesa: 'Cordobesa',
  consumer_credits: 'crédito de Mercado Pago',
}

/** Reemplaza los códigos técnicos entre paréntesis (p. ej. "(debvisa)") por su nombre legible. */
export function humanizeText(text: string): string {
  // Los retiros viejos guardaron un alias cortado ("ALIAS …icia"), que no dice nada.
  text = text.replace(/\(ALIAS …[^)]*\)/g, '(alias)')
  return text.replace(/\(([a-z_]+)\)/g, (m, id: string) => (MP_METHODS[id] ? `(${MP_METHODS[id]})` : m))
}

/**
 * Detalle de un movimiento para mostrar debajo de su título: sin códigos técnicos y sin repetir el título
 * ("Ajuste de administración: …" → solo el motivo; "Devolución de un cobro con QR" bajo el mismo título → nada).
 */
export function cleanNoteText(label: string, text: string | null | undefined): string | null {
  if (!text) return null
  let t = humanizeText(text).trim()
  const low = (s: string) => s.toLowerCase()
  if (low(t) === low(label)) return null
  if (low(t).startsWith(`${low(label)}:`)) t = t.slice(label.length + 1).trim()
  else if (low(t).startsWith(`${low(label)} `)) t = t.slice(label.length).trim().replace(/^de\s+/i, '')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null
}
