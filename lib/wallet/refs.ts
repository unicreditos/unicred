import { createHash } from 'node:crypto'

/**
 * Referencia estable por (persona, clave de idempotencia). Incluye un hash de la persona para que dos personas que
 * manden la misma clave no choquen: la unicidad de la referencia es global en la base.
 */
export function scopedRef(prefix: string, userId: string, key: string) {
  const h = createHash('sha256').update(`${userId}:${key}`).digest('hex').slice(0, 14).toUpperCase()
  return `${prefix}-${h}`
}
