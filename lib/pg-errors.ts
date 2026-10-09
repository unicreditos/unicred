/** Violacion de restriccion unica de Postgres (23505), tambien cuando drizzle envuelve el error original. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  return e?.code === '23505' || e?.cause?.code === '23505'
}