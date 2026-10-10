import { arMonthKey, arParts, daysPastDueAR } from '@/lib/date-ar'
import { Bars, ButtonLink, NoAccess, PageHead, Pad, CardHead, Grid, SectionTitle } from '@/components/uc/blocks'
import { DataGrid } from '@/components/uc/data-grid'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'

export const metadata = { title: 'Analíticas' }

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Clave "AAAA-MM" en hora de Buenos Aires. */
function monthKey(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return arMonthKey(d)
}

export default async function AnaliticasPage() {
  const { state, perms } = await loadDesk()
  const head = (
    <PageHead
      title="Analíticas"
      description="Evolución de la colocación y de las cobranzas en los últimos 12 meses."
      actions={
        <div className="uc-cta-row" style={{ gap: 10 }}>
          <ButtonLink primary href="/admin/panel-control">
            Ver Panel Ejecutivo Recharts
          </ButtonLink>
        </div>
      }
    />
  )
  if (!perms.has('finance.read')) return <>{head}<NoAccess what="las analíticas" /></>

  const nowMs = new Date().getTime()
  const nowAR = arParts(new Date(nowMs))
  const months: Array<{ key: string; label: string }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(nowAR.year, nowAR.month - 1 - i, 1))
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: MONTHS[d.getUTCMonth()] })
  }

  const placed = new Map<string, { n: number; amount: number; outstanding: number; late: number; due: number; paid: number }>()
  for (const c of state.credits) {
    const k = monthKey(c.disbursedAt)
    if (!k) continue
    const cur = placed.get(k) ?? { n: 0, amount: 0, outstanding: 0, late: 0, due: 0, paid: 0 }
    cur.n += 1
    cur.amount += c.amount
    if (c.status === 'active') {
      cur.outstanding += c.principalOutstanding
      if (c.daysPastDue > 30) cur.late += c.principalOutstanding
    }
    for (const i of c.schedule) {
      if (daysPastDueAR(i.dueDate, new Date(nowMs)) >= 0) {
        cur.due += i.amount
        cur.paid += Math.min(i.paidAmount, i.amount)
      }
    }
    placed.set(k, cur)
  }
  const collected = new Map<string, number>()
  for (const p of state.payments) {
    if (p.status !== 'reconciled' && p.status !== 'matched') continue
    const k = monthKey(p.paidAt)
    if (k) collected.set(k, (collected.get(k) ?? 0) + p.amount)
  }

  const placedBars = months.map((m) => ({ label: m.label, value: (placed.get(m.key)?.amount ?? 0) / 1_000_000 }))
  const collectedBars = months.map((m) => ({ label: m.label, value: (collected.get(m.key) ?? 0) / 1_000_000 }))

  const cohorts: GridRow[] = months
    .filter((m) => placed.has(m.key))
    .map((m) => {
      const c = placed.get(m.key)!
      return {
        id: m.key,
        mes: m.key,
        mesTxt: `${m.label} ${m.key.slice(0, 4)}`,
        creditos: c.n,
        importe: c.amount,
        mora: c.outstanding ? (c.late / c.outstanding) * 100 : null,
        cobr: c.due ? (c.paid / c.due) * 100 : null,
      }
    })

  return (
    <>
      {head}
      <Grid cols="2">
        <Pad>
          <CardHead title="Colocación mensual" aside={<span>en millones de $</span>} />
          <Bars data={placedBars} ariaLabel="Colocación mensual de los últimos 12 meses" />
        </Pad>
        <Pad>
          <CardHead title="Cobranzas mensuales" aside={<span>en millones de $</span>} />
          <Bars data={collectedBars} tone="warning" ariaLabel="Cobranzas mensuales de los últimos 12 meses" />
        </Pad>
      </Grid>
      <SectionTitle title="Cosechas por mes de otorgamiento" aside="Mora +30 y cobrabilidad de cada cosecha" />
      <DataGrid
        cfg={{
          id: 'cosechas',
          rows: cohorts,
          toolbar: false,
          sort: { key: 'mes', dir: -1 },
          empty: 'Todavía no hay créditos acreditados para armar cosechas.',
          columns: [
            { key: 'mesTxt', label: 'Cosecha', sortable: false },
            { key: 'creditos', label: 'Créditos', kind: 'num', align: 'r' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'mora', label: 'Mora +30 (del saldo)', kind: 'pct', align: 'r' },
            { key: 'cobr', label: 'Cobrabilidad', kind: 'pct', align: 'r' },
          ],
        }}
      />
    </>
  )
}
