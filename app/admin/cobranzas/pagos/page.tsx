import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch } from '@/lib/uc/admin'

export const metadata = { title: 'Pagos' }

const LABEL = { pending: 'Pendiente', matched: 'Conciliado', reconciled: 'Acreditado', rejected: 'Rechazado', refunded: 'Reintegrado' } as const
const TONE = { pending: 'info', matched: 'info', reconciled: 'success', rejected: 'danger', refunded: 'neutral' } as const

export default async function PagosPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Pagos" description="Cobranzas recibidas por todos los medios." />
  if (!perms.has('payments.read')) return <>{head}<NoAccess what="los pagos" /></>

  const idx = clientIndex(state)
  const rows: GridRow[] = state.payments.map((p) => ({
    id: p.id,
    nro: `…${p.id.slice(-8)}`,
    cliente: clientCell(idx, p.clientId),
    q: clientSearch(idx, p.clientId),
    sol: p.creditId ? `…${p.creditId.slice(-8)}` : '—',
    importe: p.amount,
    medio: p.channel === 'mercadopago' ? 'Mercado Pago' : 'Transferencia',
    ref: p.transferRef || p.mpPaymentId || '',
    fecha: p.paidAt,
    estadoKey: p.status === 'matched' ? 'reconciled' : p.status,
    estado: badge(LABEL[p.status] ?? p.status, TONE[p.status] ?? 'neutral'),
    ver: [{ kind: 'link', label: 'Ver legajo', href: `/admin/clientes/${encodeURIComponent(p.clientId)}` }],
  }))

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'pagos',
          rows,
          pageSize: 15,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['nro', 'sol', 'ref', 'q'],
          searchPlaceholder: 'Cliente, DNI, pago o solicitud',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'reconciled', l: 'Acreditados' },
              { v: 'pending', l: 'Pendientes' },
              { v: 'rejected', l: 'Rechazados' },
            ],
          },
          selects: [{ key: 'medio', label: 'Medio de pago', all: 'Medio: todos' }],
          columns: [
            { key: 'nro', label: 'N° de pago', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'sol', label: 'Solicitud', kind: 'num' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'medio', label: 'Medio' },
            { key: 'ref', label: 'Referencia', muted: true },
            { key: 'fecha', label: 'Fecha', kind: 'datetime' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Pendiente', 'Acreditado', 'Rechazado'] },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'pagos', sumKey: 'importe', sumLabel: 'en total' },
        }}
      />
    </>
  )
}
