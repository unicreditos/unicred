import { MarkPaidForm } from '@/app/admin/comercios/operaciones/_forms'
import { DataGrid } from '@/components/uc/data-grid'
import { CardHead, KpiGrid, NoAccess, PageHead, Pad } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDeskChrome } from '@/lib/admin-desk/load'
import { formatCBU } from '@/lib/finance'
import { formatPayDate, nextSettlementDate } from '@/lib/merchant-orders/rules'
import { listSettlements } from '@/lib/merchant-orders/service'
import { fdate, money } from '@/lib/uc/format'

export const metadata = { title: 'Liquidaciones a comercios' }
export const dynamic = 'force-dynamic'

export default async function LiquidacionesComerciosPage() {
  const { perms } = await loadDeskChrome()
  const head = (
    <PageHead
      title="Liquidaciones a comercios"
      description="Todos los viernes (o el próximo día hábil) se transfiere a cada comercio lo entregado en la semana: precio de contado menos comisión."
    />
  )
  if (!perms.has('payments.read') && !perms.has('finance.read')) return <>{head}<NoAccess what="las liquidaciones a comercios" /></>
  const canPay = perms.has('disbursements.credit')

  const rows = await listSettlements({ limit: 1000 })
  const scheduled = rows.filter((r) => r.s.status === 'scheduled').sort((a, b) => a.s.payDate.localeCompare(b.s.payDate))
  const byDate = new Map<string, typeof scheduled>()
  for (const r of scheduled) byDate.set(r.s.payDate, [...(byDate.get(r.s.payDate) ?? []), r])
  const today = new Date().toISOString().slice(0, 10)
  const overdue = scheduled.filter((r) => r.s.payDate < today)
  const paid = rows.filter((r) => r.s.status === 'paid')

  const history: GridRow[] = paid.map((r) => ({
    id: r.s.id,
    lote: { a: r.s.code, b: `${r.s.orderCount} ventas` },
    comercio: { a: r.merchantName, b: `CUIT ${r.merchantCuit}` },
    q: `${r.s.code} ${r.merchantName} ${r.merchantCuit} ${r.s.transferReference ?? ''}`,
    fecha: r.s.payDate,
    pagada: r.s.paidAt ? new Date(r.s.paidAt).toISOString() : null,
    neto: Number(r.s.netAmount),
    comision: Number(r.s.commissionAmount),
    ref: r.s.transferReference ?? '—',
    ver: [{ kind: 'link' as const, label: 'Comprobante', href: `/admin/comercios/liquidaciones/${r.s.id}` }],
  }))

  return (
    <>
      {head}
      <KpiGrid
        items={[
          { href: '#proximos', label: 'Próxima fecha de pago', value: nextSettlementDate().split('-').reverse().slice(0, 2).join('/'), foot: `${formatPayDate(nextSettlementDate())} · entregas de hoy` },
          { href: '#proximos', label: 'Programado', value: money(scheduled.reduce((s, r) => s + Number(r.s.netAmount), 0)), money: true, foot: `${scheduled.length} lotes` },
          { href: '#proximos', label: 'Vencidos sin transferir', value: overdue.length, foot: overdue.length ? 'Transferir hoy' : 'Al día' },
          { href: '#historial', label: 'Transferido', value: money(paid.reduce((s, r) => s + Number(r.s.netAmount), 0)), money: true, foot: `${paid.length} lotes` },
        ]}
      />
      <div id="proximos" style={{ display: 'grid', gap: 20, margin: '20px 0' }}>
        {[...byDate.entries()].map(([date, list]) => (
          <Pad key={date}>
            <CardHead title={`${formatPayDate(date)}${date < today ? ' · VENCIDO' : ''}`} aside={<b className="uc-num">{money(list.reduce((s, r) => s + Number(r.s.netAmount), 0))}</b>} />
            <div className="uc-table-scroll">
              <table className="uc-dt" style={{ width: '100%', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Comercio</th>
                    <th>Cuenta de cobro</th>
                    <th style={{ textAlign: 'right' }}>Ventas</th>
                    <th style={{ textAlign: 'right' }}>Comisión</th>
                    <th style={{ textAlign: 'right' }}>Neto</th>
                    <th style={{ textAlign: 'right' }}>Transferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.s.id}>
                      <td>
                        <b>{r.merchantName}</b>
                        <div className="uc-small uc-muted">
                          <a href={`/admin/comercios/liquidaciones/${r.s.id}`} target="_blank" rel="noreferrer">{r.s.code}</a> · {r.s.orderCount} ventas
                        </div>
                      </td>
                      <td className="uc-num uc-small">
                        {r.payoutCbu ? (
                          <>
                            {formatCBU(r.payoutCbu)}
                            <div className="uc-muted">{r.payoutHolder}{r.payoutBank ? ` · ${r.payoutBank}` : ''}</div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--uc-danger)' }}>Sin cuenta cargada</span>
                        )}
                      </td>
                      <td className="uc-num" style={{ textAlign: 'right' }}>{money(Number(r.s.grossAmount))}</td>
                      <td className="uc-num" style={{ textAlign: 'right' }}>{money(Number(r.s.commissionAmount))}</td>
                      <td className="uc-num" style={{ textAlign: 'right' }}><b>{money(Number(r.s.netAmount))}</b></td>
                      <td style={{ textAlign: 'right' }}>
                        {canPay ? <MarkPaidForm settlementId={r.s.id} net={money(Number(r.s.netAmount))} ready={Boolean(r.payoutCbu)} /> : <span className="uc-small uc-muted">Sin permiso</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Pad>
        ))}
        {!scheduled.length ? <Pad><p className="uc-muted">No hay liquidaciones programadas. Se generan cuando un comercio confirma una entrega.</p></Pad> : null}
      </div>
      <div id="historial">
        <DataGrid
          cfg={{
            id: 'liquidaciones-pagadas',
            rows: history,
            pageSize: 20,
            sort: { key: 'pagada', dir: -1 },
            searchKeys: ['q'],
            searchPlaceholder: 'Lote, comercio, CUIT o transferencia',
            exportName: 'liquidaciones-comercios',
            columns: [
              { key: 'lote', label: 'Lote', kind: 'stack' },
              { key: 'comercio', label: 'Comercio', kind: 'stack' },
              { key: 'fecha', label: 'Fecha de pago' },
              { key: 'pagada', label: 'Transferida', kind: 'date' },
              { key: 'comision', label: 'Comisión', kind: 'money', align: 'r' },
              { key: 'neto', label: 'Neto', kind: 'money', align: 'r', amount: true },
              { key: 'ref', label: 'N.º transferencia', muted: true },
              { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
            ],
            summary: { noun: 'liquidaciones', sumKey: 'neto', sumLabel: 'transferido' },
          }}
        />
      </div>
      <p className="uc-small uc-muted" style={{ marginTop: 12 }}>Actualizado el {fdate(new Date())}.</p>
    </>
  )
}
