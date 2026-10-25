import { sql } from 'drizzle-orm'

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  const r = result as { rows?: Array<Record<string, unknown>> }
  return Array.isArray(r?.rows) ? r.rows : Array.isArray(result) ? (result as Array<Record<string, unknown>>) : []
}

/**
 * ¿El crédito pertenece a una venta en comercio con anticipo? En ese caso el capital no se gira al cliente:
 * lo cobra el comercio en la liquidación semanal. Tolera bases donde la tabla todavía no existe.
 */
export async function isMerchantOrderLoan(tx: Executor, loanId: string) {
  const reg = rowsOf(await tx.execute(sql`select to_regclass('public.merchant_order')::text as t`))
  if (!reg[0]?.t) return false
  const found = rowsOf(await tx.execute(sql`select 1 as x from merchant_order where "loanId" = ${loanId} limit 1`))
  return found.length > 0
}
