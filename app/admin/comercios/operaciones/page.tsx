import { DataGrid } from '@/components/uc/data-grid'
import { Callout, KpiGrid, NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDeskChrome } from '@/lib/admin-desk/load'
import { ORDER_STAGE_LABEL, type OrderStage } from '@/lib/merchant-orders/rules'
import { loadOrders } from '@/lib/merchant-orders/service'
import { badge } from '@/lib/uc/admin'
import { money } from '@/lib/uc/format'

export const metadata = { title: 'Ventas en comercios' }
export const dynamic = 'force-dynamic'

const TONE: Record<OrderStage, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  en_revision: 'info',
  esperando_cliente: 'warning',
  lista_para_entregar: 'success',
  entregada: 'success',
  liquidada: 'neutral',
  rechazada: 'danger',
  anulada: 'neutral',
}

export default async function OperacionesComerciosPage() {
  const { perms } = await loadDeskChrome()
  const head = (
    <PageHead
      title="Ventas en comercios"
      description="Operaciones con anticipo del 30%: la mesa aprueba el crédito, tesorería acredita el anticipo y el comercio entrega con el código del cliente."
    />
  )
  if (!perms.has('merchants.read') && !perms.has('payments.read')) return <>{head}<NoAccess what="las ventas en comercios" /></>

  const orders = await loadOrders({ limit: 1000 })
  const toReview = orders.filter((o) => o.downPaymentStatus === 'reported')
  const toRefund = orders.filter((o) => o.refundStatus === 'pending')
  const pendingCredit = orders.filter((o) => o.stage === 'en_revision')
  const rows: GridRow[] = orders.map((o) => ({
    id: o.id,
    op: { a: o.code, b: o.origin === 'online' ? 'Pedido online' : 'En el local' },
    comercio: o.merchantName,
    cliente: { a: o.customerName ?? '—', b: o.customerCuil ?? '' },
    q: `${o.code} ${o.merchantName} ${o.customerName ?? ''} ${o.customerCuil ?? ''}`,
    total: Number(o.totalAmount),
    anticipo: badge(
      `${money(Number(o.downPaymentAmount))} · ${o.downPaymentStatus === 'confirmed' ? 'acreditado' : o.downPaymentStatus === 'reported' ? 'a revisar' : o.downPaymentStatus === 'rejected' ? 'rechazado' : 'pendiente'}`,
      o.downPaymentStatus === 'confirmed' ? 'success' : o.downPaymentStatus === 'reported' ? 'warning' : 'neutral',
    ),
    financiado: Number(o.financedAmount),
    etapaKey: o.refundStatus === 'pending' ? 'a_devolver' : o.stage,
    etapa: o.refundStatus === 'pending' ? badge('Anulada · anticipo a devolver', 'danger') : badge(ORDER_STAGE_LABEL[o.stage], TONE[o.stage]),
    alta: new Date(o.createdAt).toISOString(),
    ver: [
      { kind: 'link' as const, label: 'Abrir', href: `/admin/comercios/operaciones/${encodeURIComponent(o.id)}` },
      ...(o.stage === 'en_revision' ? [{ kind: 'link' as const, label: 'Evaluar crédito', href: `/admin/originacion/solicitudes/${encodeURIComponent(o.loanId)}` }] : []),
    ],
  }))

  return (
    <>
      {head}
      <KpiGrid
        items={[
          { href: '/admin/originacion/aprobaciones', label: 'Créditos a decidir', value: pendingCredit.length, foot: 'Mesa de créditos' },
          { href: '#anticipos', label: 'Anticipos a acreditar', value: toReview.length, foot: 'Transferencias informadas' },
          { href: '/admin/comercios/operaciones', label: 'Listas para entregar', value: orders.filter((o) => o.stage === 'lista_para_entregar').length, foot: 'Esperan al comercio' },
          {
            href: '/admin/comercios/liquidaciones',
            label: 'A liquidar',
            value: money(orders.filter((o) => o.stage === 'entregada').reduce((s, o) => s + Number(o.netAmount), 0)),
            money: true,
            foot: 'Entregadas, sin pagar al comercio',
          },
        ]}
      />
      {toRefund.length ? (
        <div id="devoluciones" style={{ margin: '20px 0' }}>
          <Callout icon="alert" title={`${toRefund.length} anticipo${toRefund.length === 1 ? '' : 's'} para devolver por ventas anuladas`}>
            {toRefund.map((o, i) => (
              <span key={o.id}>
                {i ? ' · ' : ''}
                <a href={`/admin/comercios/operaciones/${o.id}`}>{o.code}</a> ({money(Number(o.refundAmount ?? o.downPaymentAmount))})
              </span>
            ))}
          </Callout>
        </div>
      ) : null}
      {toReview.length ? (
        <div id="anticipos" style={{ margin: '20px 0' }}>
          <Callout icon="alert" title={`${toReview.length} anticipo${toReview.length === 1 ? '' : 's'} por transferencia para revisar`}>
            {toReview.map((o, i) => (
              <span key={o.id}>
                {i ? ' · ' : ''}
                <a href={`/admin/comercios/operaciones/${o.id}`}>{o.code}</a> ({money(Number(o.downPaymentAmount))})
              </span>
            ))}
          </Callout>
        </div>
      ) : null}
      <DataGrid
        cfg={{
          id: 'ventas-comercios',
          rows,
          pageSize: 20,
          sort: { key: 'alta', dir: -1 },
          dateKey: 'alta',
          dateLabel: 'Alta',
          searchKeys: ['q'],
          searchPlaceholder: 'Operación, comercio, cliente o CUIL',
          exportName: 'ventas-comercios',
          chips: {
            label: 'Etapa',
            key: 'etapaKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'en_revision', l: 'En revisión' },
              { v: 'esperando_cliente', l: 'Esperando cliente' },
              { v: 'lista_para_entregar', l: 'Para entregar' },
              { v: 'entregada', l: 'A liquidar' },
              { v: 'liquidada', l: 'Liquidadas' },
              { v: 'a_devolver', l: 'Anticipo a devolver' },
              { v: 'cerradas', l: 'Rechazadas/anuladas', in: ['rechazada', 'anulada', 'a_devolver'] },
            ],
          },
          columns: [
            { key: 'op', label: 'Operación', kind: 'stack' },
            { key: 'comercio', label: 'Comercio' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'total', label: 'Precio', kind: 'money', align: 'r', amount: true },
            { key: 'anticipo', label: 'Anticipo 30%', kind: 'badge' },
            { key: 'financiado', label: 'Financiado', kind: 'money', align: 'r' },
            { key: 'etapa', label: 'Etapa', kind: 'badge', order: Object.values(ORDER_STAGE_LABEL) },
            { key: 'alta', label: 'Alta', kind: 'date' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'operaciones', sumKey: 'total', sumLabel: 'en ventas' },
        }}
      />
    </>
  )
}
