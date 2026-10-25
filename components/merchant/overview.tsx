'use client'

import { btnGhost, btnPrimary, Figure, Panel, StagePill, type Commerce } from '@/components/merchant/shared'
import { formatARS } from '@/lib/finance'
import { formatPayDate } from '@/lib/merchant-orders/rules'
import { ArrowRight, PackageCheck, Sparkles } from 'lucide-react'

function monthKey(d: Date | string) {
  return new Date(d).toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
}

export function OverviewTab({ data, onGoto }: { data: Commerce; onGoto: (tab: string) => void }) {
  const live = data.orders.filter((o) => o.stage !== 'rechazada' && o.stage !== 'anulada')
  const toDeliver = data.orders.filter((o) => o.stage === 'lista_para_entregar')
  const inReview = data.orders.filter((o) => o.stage === 'en_revision').length
  const waiting = data.orders.filter((o) => o.stage === 'esperando_cliente').length
  const nextSettlement = data.settlements.filter((s) => s.status === 'scheduled').sort((a, b) => a.payDate.localeCompare(b.payDate))[0]
  const now = new Date()
  const thisMonth = monthKey(now)
  const monthSales = live.filter((o) => o.deliveredAt && monthKey(o.deliveredAt) === thisMonth)

  // Ventas entregadas de los últimos 6 meses (precio de contado)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 15)
    return monthKey(d)
  })
  const byMonth = months.map((m) => live.filter((o) => o.deliveredAt && monthKey(o.deliveredAt) === m).reduce((s, o) => s + Number(o.totalAmount), 0))
  const max = Math.max(1, ...byMonth)

  return (
    <div className="space-y-5">
      {toDeliver.length ? (
        <button type="button" onClick={() => onGoto('operaciones')} className="flex w-full items-center gap-4 rounded-2xl bg-emerald-600 p-5 text-left text-white shadow-lg shadow-emerald-600/20">
          <PackageCheck className="h-8 w-8 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <b className="block text-lg">{toDeliver.length} {toDeliver.length === 1 ? 'operación lista' : 'operaciones listas'} para entregar</b>
            <span className="text-sm text-white/85">El cliente firmó y pagó el anticipo. Entregá y cargá su código.</span>
          </span>
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Figure label="Próxima liquidación" value={formatARS(nextSettlement?.netAmount ?? 0)} hint={nextSettlement ? formatPayDate(nextSettlement.payDate) : 'Sin entregas pendientes de pago'} tone="accent" />
        <Figure label="Vendido este mes" value={formatARS(monthSales.reduce((s, o) => s + Number(o.totalAmount), 0))} hint={`${monthSales.length} entregas`} />
        <Figure label="En revisión" value={inReview} hint="Las decide la mesa de créditos" />
        <Figure label="Esperando al cliente" value={waiting} hint="Firma y anticipo del 30%" tone={waiting ? 'warn' : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel eyebrow="Últimos 6 meses" title="Ventas entregadas">
          <div className="flex h-40 items-end gap-2" role="img" aria-label="Ventas entregadas por mes">
            {byMonth.map((v, i) => (
              <div key={months[i]} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-brand-primary/80" style={{ height: `${Math.max(2, (v / max) * 100)}%` }} title={formatARS(v)} />
                <span className="text-[11px] text-muted-foreground">{months[i]}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel eyebrow="Atajos" title="¿Qué querés hacer?">
          <div className="grid gap-2">
            <button type="button" className={btnPrimary} onClick={() => onGoto('venta')}>
              <Sparkles className="h-4 w-4" aria-hidden /> Nueva venta en cuotas
            </button>
            <button type="button" className={btnGhost} onClick={() => onGoto('catalogo')}>Cargar productos al catálogo</button>
            <button type="button" className={btnGhost} onClick={() => onGoto('liquidaciones')}>{data.payout ? 'Ver liquidaciones' : 'Cargar cuenta de cobro'}</button>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Actividad" title="Últimas operaciones" action={<button type="button" className="text-sm font-semibold text-brand-primary-700 underline dark:text-brand-primary-300" onClick={() => onGoto('operaciones')}>Ver todas</button>}>
        {data.orders.length ? (
          <ul className="divide-y divide-border">
            {data.orders.slice(0, 6).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="font-mono text-xs font-bold">{o.code}</span>
                <span className="min-w-0 flex-1 truncate">{o.customerName ?? 'Cliente'}</span>
                <span className="font-mono tabular-nums">{formatARS(o.totalAmount)}</span>
                <StagePill stage={o.stage} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay operaciones. Empezá por cargar tu catálogo y armar la primera venta.</p>
        )}
      </Panel>
    </div>
  )
}

export function CustomersTab({ data }: { data: Commerce }) {
  const map = new Map<string, { name: string; cuil: string | null; ops: number; total: number; last: Date | string }>()
  for (const o of data.orders) {
    if (o.stage === 'rechazada' || o.stage === 'anulada') continue
    const cur = map.get(o.customerUserId) ?? { name: o.customerName ?? 'Cliente', cuil: o.customerCuil, ops: 0, total: 0, last: o.createdAt }
    cur.ops += 1
    cur.total += Number(o.totalAmount)
    if (new Date(o.createdAt) > new Date(cur.last)) cur.last = o.createdAt
    map.set(o.customerUserId, cur)
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total)
  return (
    <Panel eyebrow="Clientes" title={`${rows.length} clientes financiados`}>
      {rows.length ? (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">CUIL</th>
                <th className="py-2 pr-3 text-right font-medium">Operaciones</th>
                <th className="py-2 text-right font-medium">Comprado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.cuil}-${r.name}`} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{r.name}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.cuil ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right font-mono">{r.ops}</td>
                  <td className="py-2.5 text-right font-mono">{formatARS(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Cuando vendas en cuotas, tus clientes aparecen acá.</p>
      )}
    </Panel>
  )
}
