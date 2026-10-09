import { sql } from 'drizzle-orm'

/**
 * Fusion ATOMICA de claves de kyc_verification.ocrData (jsonb || jsonb en una sola sentencia).
 * Leer el objeto, modificarlo y reescribirlo entero pisa los cambios simultaneos (p. ej. un webhook de
 * Didit mientras un operador actualiza el padron ARCA). Con esto cada quien solo toca sus propias claves.
 */
export function ocrMergeSql(patch: Record<string, unknown>) {
  return sql`COALESCE("ocrData", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`
}