import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow, RowAction } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch, fullName } from '@/lib/uc/admin'
import { money } from '@/lib/uc/format'

export const metadata = { title: 'Comprobantes' }

export default async function ComprobantesPage() {
  const { state, perms } = await loadDesk()
  const head = (
    <PageHead title="Comprobantes" description="Transferencias que informan los clientes para conciliar contra el banco antes de acreditar la cuota." />
  )
  if (!perms.has('payments.read')) return <>{head}<NoAccess what="los comprobantes" /></>
  const canReconcile = perms.has('payments.reconcile')

  const idx = clientIndex(state)
  const rows: GridRow[] = state.payments
    .filter((p) => p.channel === 'transferencia')
    .map((p) => {
      const name = fullName(idx.get(p.clientId))
      const label = p.status === 'pending' ? 'Por conciliar' : p.status === 'rejected' ? 'Rechazado' : 'Conciliado'
      const actions: RowAction[] =
        p.status === 'pending' && canReconcile
          ? [
              {
                kind: 'desk',
                label: 'Conciliar',
                icon: 'check',
                action: 'matchTransfer',
                payload: { paymentId: p.id },
                title: 'Conciliar comprobante',
                sub: `${name} · …${p.id.slice(-8)}`,
                summary: [
                  ['Importe declarado', money(p.amount)],
                  ['Imputa a', p.creditId ? `crédito …${p.creditId.slice(-8)}` : '—'],
                ],
                warning: 'Verificá que el movimiento figure en el extracto bancario antes de conciliar. Se acredita la cuota.',
                confirmLabel: 'Marcar como conciliado',
                success: 'Pago conciliado y cuota acreditada.',
              },
              {
                kind: 'desk',
                label: 'Rechazar',
                action: 'rejectTransfer',
                payload: { paymentId: p.id },
                title: 'Rechazar comprobante',
                sub: name,
                confirmLabel: 'Rechazar',
                success: 'Comprobante rechazado.',
                field: { name: 'reason', label: 'Motivo', required: true },
                danger: true,
              },
            ]
          : []
      return {
        id: p.id,
        nro: `…${p.id.slice(-8)}`,
        cliente: clientCell(idx, p.clientId),
        q: clientSearch(idx, p.clientId),
        importe: p.amount,
        ref: p.transferRef || '',
        nota: p.notes || '',
        fecha: p.paidAt,
        estadoKey: label,
        estado: badge(label, label === 'Conciliado' ? 'success' : label === 'Rechazado' ? 'danger' : 'warning'),
        acc: actions,
      }
    })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'comprob',
          rows,
          pageSize: 15,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['nro', 'ref', 'q'],
          searchPlaceholder: 'Cliente, DNI o N° de comprobante',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Por conciliar', l: 'Por conciliar' },
              { v: 'Conciliado', l: 'Conciliados' },
              { v: 'Rechazado', l: 'Rechazados' },
            ],
          },
          columns: [
            { key: 'nro', label: 'N° de comprobante', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe declarado', kind: 'money', align: 'r', amount: true },
            { key: 'ref', label: 'Referencia', muted: true },
            { key: 'fecha', label: 'Fecha', kind: 'date' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Por conciliar', 'Conciliado', 'Rechazado'] },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'comprobantes', sumKey: 'importe', sumLabel: 'declarados' },
        }}
      />
    </>
  )
}
