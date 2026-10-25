import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { POSTED_SQL } from '@/lib/wallet/display'

const POSTED = sql.raw(POSTED_SQL)
const TZ = 'America/Argentina/Buenos_Aires'
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export type CashflowPoint = { key: string; label: string; income: number; expense: number }

/** Ingresos y egresos acreditados por mes (hora argentina), con los meses sin movimientos en cero. */
export async function cashflowByMonth(walletId: string, months = 6): Promise<CashflowPoint[]> {
  const span = Math.max(1, Math.min(24, Math.floor(months)))
  const r = await db.execute<{ m: string; income: string; expense: string }>(sql`
    select to_char(date_trunc('month', "createdAt" at time zone ${TZ}), 'YYYY-MM') as m,
           coalesce(sum(case when direction in ('credit','in') then amount else 0 end), 0)::text as income,
           coalesce(sum(case when direction in ('debit','out') then amount else 0 end), 0)::text as expense
      from wallet_movement
     where "walletId" = ${walletId}
       and ${POSTED}
       and "createdAt" >= (date_trunc('month', now() at time zone ${TZ}) - make_interval(months => ${span - 1})) at time zone ${TZ}
     group by 1`)
  const byKey = new Map(r.rows.map((row) => [row.m, row]))
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  const out: CashflowPoint[] = []
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = byKey.get(key)
    out.push({ key, label: MONTHS[d.getMonth()], income: Number(row?.income ?? 0), expense: Number(row?.expense ?? 0) })
  }
  return out
}

/** Cómo se agrupan los tipos de movimiento de salida para mostrar "en qué se fue el dinero". */
export const OUTFLOW_CATEGORIES: Array<{ label: string; kinds: string[] }> = [
  { label: 'Transferencias', kinds: ['p2p_out', 'outbound_transfer'] },
  { label: 'Retiros a bancos', kinds: ['treasury_payout'] },
  { label: 'Cuotas de créditos', kinds: ['pay_installment'] },
  { label: 'Servicios y recargas', kinds: ['service_payment', 'service_bill', 'service_recharge'] },
]

export type OutflowSlice = { label: string; value: number }

/** Egresos acreditados de los últimos días, agrupados por categoría (de mayor a menor; lo que no encaja va a "Otros"). */
export async function outflowByCategory(walletId: string, days = 30): Promise<OutflowSlice[]> {
  const r = await db.execute<{ kind: string; total: string }>(sql`
    select kind, coalesce(sum(amount), 0)::text as total
      from wallet_movement
     where "walletId" = ${walletId}
       and direction in ('debit','out')
       and ${POSTED}
       and "createdAt" >= now() - make_interval(days => ${Math.max(1, Math.min(365, Math.floor(days)))})
     group by kind`)
  const slices = new Map<string, number>()
  for (const row of r.rows) {
    const cat = OUTFLOW_CATEGORIES.find((c) => c.kinds.includes(row.kind))?.label ?? 'Otros'
    slices.set(cat, (slices.get(cat) ?? 0) + Number(row.total))
  }
  return [...slices.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
}
