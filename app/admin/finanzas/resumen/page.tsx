import { DataGrid } from '@/components/uc/data-grid'
import { KpiGrid, NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientIndex, fullName } from '@/lib/uc/admin'
import { daysBetween, fmtPct, money } from '@/lib/uc/format'

export const metadata = { title: 'Finanzas' }

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

export default async function FinanzasPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Finanzas" description="Movimientos de fondos de los últimos 30 días." />
  if (!perms.has('finance.read')) return <>{head}<NoAccess what="las finanzas" /></>

  const now = new Date()
  const idx = clientIndex(state)
  const within = (d: string | null) => d != null && daysBetween(d, now) <= 30 && daysBetween(d, now) >= 0

  const incomes = state.payments.filter((p) => p.status === 'reconciled' || p.status === 'matched')
  const expenses = state.disbursements.filter((d) => d.status === 'completed')

  const movs = [
    ...incomes.map((p) => ({
      id: `in-${p.id}`,
      fecha: p.paidAt,
      ref: `…${p.id.slice(-8)}`,
      concepto: p.channel === 'mercadopago' ? 'Cobranza Mercado Pago' : 'Cobranza transferencias',
      cliente: fullName(idx.get(p.clientId)),
      tipoKey: 'Ingreso',
      tipo: badge('Ingreso', 'success'),
      importe: p.amount,
      neto: p.amount,
    })),
    ...expenses.map((d) => ({
      id: `out-${d.id}`,
      fecha: d.completedAt ?? d.requestedAt,
      ref: d.reference || `…${d.id.slice(-8)}`,
      concepto: 'Desembolso de crédito',
      cliente: fullName(idx.get(d.clientId)),
      tipoKey: 'Egreso',
      tipo: badge('Egreso', 'neutral'),
      importe: d.amount,
      neto: -d.amount,
    })),
  ].filter((r) => within(r.fecha))
  const rows: GridRow[] = movs

  const placed = state.credits.filter((c) => within(c.disbursedAt))
  const collected = sum(movs.filter((r) => r.tipoKey === 'Ingreso'), (r) => r.neto)
  const paidOut = sum(movs.filter((r) => r.tipoKey === 'Egreso'), (r) => -r.neto)
  const active = state.credits.filter((c) => c.status === 'active')
  const total = sum(active, (c) => c.principalOutstanding)
  const late30 = active.filter((c) => c.daysPastDue > 30)
  const late30Sum = sum(late30, (c) => c.principalOutstanding)

  return (
    <>
      {head}
      <KpiGrid
        items={[
          { href: '/admin/creditos/otorgados', label: 'Capital colocado', money: true, value: money(sum(placed, (c) => c.amount)), amount: '', amountLabel: 'últimos 30 días' },
          { href: '/admin/cobranzas/pagos', label: 'Cobranzas (30 días)', money: true, value: money(collected), amount: '', amountLabel: 'acreditadas' },
          { href: '/admin/finanzas/resumen', label: 'Flujo neto (30 días)', money: true, value: money(collected - paidOut), amount: '', amountLabel: 'ingresos menos egresos' },
          { href: '/admin/cobranzas/mora', label: 'Mora +30 días', value: fmtPct(total ? (late30Sum / total) * 100 : 0), amount: money(late30Sum), amountLabel: 'del saldo de cartera' },
        ]}
      />
      <div className="uc-section-gap" />
      <DataGrid
        cfg={{
          id: 'movs',
          rows,
          pageSize: 12,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['concepto', 'ref', 'cliente'],
          searchPlaceholder: 'Concepto, cliente o referencia',
          chips: {
            label: 'Tipo',
            key: 'tipoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Ingreso', l: 'Ingresos' },
              { v: 'Egreso', l: 'Egresos' },
            ],
          },
          columns: [
            { key: 'fecha', label: 'Fecha', kind: 'date' },
            { key: 'ref', label: 'Referencia', kind: 'num' },
            { key: 'concepto', label: 'Concepto' },
            { key: 'cliente', label: 'Cliente' },
            { key: 'tipo', label: 'Tipo', kind: 'badge', order: ['Ingreso', 'Egreso'] },
            { key: 'neto', label: 'Importe', kind: 'money', align: 'r', amount: true },
          ],
          summary: { noun: 'movimientos', sumKey: 'neto', sumLabel: 'neto' },
        }}
      />
    </>
  )
}
