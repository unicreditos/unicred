'use client'

import type { AdminOpsDesk } from '@/app/actions/admin-ops'
import type { StatsData } from '@/components/admin/summary-cards'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { adminLoanHref } from '@/lib/admin-nav'
import { formatARS } from '@/lib/finance'
import { loanStatusLabel } from '@/lib/labels'
import Link from 'next/link'
import { useMemo } from 'react'

type LoanRow = {
  id: string
  userId: string
  productId?: string | null
  principal: string | number
  term: number
  status: string
  scoreAtApproval: number | null
  createdAt: Date | string
}

type ProductRow = { id: string; name: string }

function money(v: string | number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function daysAgo(iso: Date | string, days: number, now: number) {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime()
  return now - t <= days * 86400000
}

export function AdminAnalyticsDesk({
  stats,
  loans,
  products,
  opsDesk,
}: {
  stats: StatsData
  loans: LoanRow[]
  products: ProductRow[]
  opsDesk: AdminOpsDesk
}) {
  const derived = useMemo(() => {
    // "Últimos 30 días" es relativo al momento de la consulta; no hay forma pura de expresarlo.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const last30 = loans.filter((l) => daysAgo(l.createdAt, 30, now))
    const approved = loans.filter((l) => l.status === 'approved' || l.status === 'active' || l.status === 'paid')
    const rejected = loans.filter((l) => l.status === 'rejected')
    const volume30 = last30.reduce((s, l) => s + money(l.principal), 0)
    const ticket = loans.length ? loans.reduce((s, l) => s + money(l.principal), 0) / loans.length : 0
    const byProduct = new Map<string, { name: string; n: number; volume: number }>()
    for (const p of products) byProduct.set(p.id, { name: p.name, n: 0, volume: 0 })
    for (const l of loans) {
      const key = l.productId || '_sin'
      const cur = byProduct.get(key) ?? { name: 'Sin producto', n: 0, volume: 0 }
      cur.n += 1
      cur.volume += money(l.principal)
      byProduct.set(key, cur)
    }
    return {
      last30: last30.length,
      volume30,
      ticket,
      approvalRate: loans.length ? Math.round((approved.length / loans.length) * 100) : 0,
      rejectRate: loans.length ? Math.round((rejected.length / loans.length) * 100) : 0,
      byProduct: [...byProduct.values()].sort((a, b) => b.volume - a.volume),
    }
  }, [loans, products])

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
        <MetricTile label="Originación 30d" value={String(derived.last30)} hint={formatARS(derived.volume30)} />
        <MetricTile label="Calificación" value={`${derived.approvalRate}%`} hint="Aprobado + vigente + pagado" />
        <MetricTile label="Rechazo" value={`${derived.rejectRate}%`} tone={derived.rejectRate > 40 ? 'warn' : 'default'} />
        <MetricTile label="Ticket" value={formatARS(derived.ticket)} hint={`${loans.length} solicitudes`} />
        <MetricTile label="Capital vivo" value={formatARS(stats.loans.outstanding ?? stats.loans.volume)} />
        <MetricTile label="Mora" value={String(opsDesk.kpis.overdueCount)} hint={formatARS(opsDesk.kpis.overdueAmount)} tone={opsDesk.kpis.overdueCount ? 'warn' : 'ok'} />
        <MetricTile label="Cobrado mes" value={formatARS(opsDesk.kpis.collectedMonth)} hint={`${opsDesk.kpis.receiptsMonth} recibos`} />
        <MetricTile label="Vence 7d" value={String(opsDesk.kpis.due7Count)} hint={formatARS(opsDesk.kpis.due7Amount)} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <header className="shrink-0 border-b border-border px-3 py-1.5">
            <h3 className="text-[12px] font-semibold">Por producto</h3>
          </header>
          <ul className="min-h-0 flex-1 overflow-auto divide-y">
            {derived.byProduct.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">Sin originación.</li>
            ) : (
              derived.byProduct.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {p.n} · {formatARS(p.volume)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <header className="shrink-0 border-b border-border px-3 py-1.5">
            <h3 className="text-[12px] font-semibold">Últimas solicitudes</h3>
          </header>
          <ul className="min-h-0 flex-1 overflow-auto divide-y">
            {loans.slice(0, 16).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
                <Link href={adminLoanHref(l.id, l.status)} className="font-mono text-[11px] hover:underline">
                  {l.id.slice(0, 10)}…
                </Link>
                <span className="text-[11px] text-muted-foreground">{loanStatusLabel(l.status)}</span>
                <span className="tabular-nums">{formatARS(l.principal)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </OpsFloor>
  )
}
