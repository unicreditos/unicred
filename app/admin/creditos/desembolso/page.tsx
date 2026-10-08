import { DataGrid } from '@/components/uc/data-grid'
import { Callout, NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow, RowAction } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch, fullName } from '@/lib/uc/admin'
import { money } from '@/lib/uc/format'

export const metadata = { title: 'Pendientes de desembolso' }

export default async function DesembolsoPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Pendientes de desembolso" description="Créditos aprobados por Finanzas que esperan la transferencia al cliente." />
  if (!perms.has('payments.read')) return <>{head}<NoAccess what="los desembolsos" /></>
  const canCredit = perms.has('disbursements.credit')

  const idx = clientIndex(state)
  const rows: GridRow[] = state.disbursements
    .filter((d) => d.status !== 'completed')
    .map((d) => {
      const name = fullName(idx.get(d.clientId))
      const failed = d.status === 'failed'
      const actions: RowAction[] = !canCredit
        ? []
        : failed
          ? [
              {
                kind: 'desk',
                label: 'Reencolar',
                action: 'retryDisbursement',
                payload: { disbursementId: d.id },
                title: 'Volver a poner en cola',
                sub: name,
                confirmLabel: 'Reencolar',
                success: 'Desembolso reencolado.',
              },
            ]
          : [
              {
                kind: 'desk',
                label: 'Acreditar',
                icon: 'check',
                action: 'markDisbursed',
                payload: { disbursementId: d.id },
                title: 'Registrar desembolso',
                sub: `${name} · …${d.creditId.slice(-8)}`,
                summary: [
                  ['Importe', money(d.amount)],
                  ['Cuenta destino', d.cbu ? `${d.bank || 'Cuenta'} · ···· ${d.cbu.slice(-4)}` : 'Sin CBU/CVU cargado'],
                ],
                warning: 'Acreditá solo después de transferir el dinero. Esto activa el crédito y genera las cuotas.',
                confirmLabel: 'Confirmar desembolso',
                success: 'Desembolso acreditado. El crédito quedó vigente.',
                field: { name: 'reference', label: 'N° de operación bancaria (opcional)' },
              },
              {
                kind: 'desk',
                label: 'Fallido',
                action: 'failDisbursement',
                payload: { disbursementId: d.id },
                title: 'Marcar como fallido',
                sub: name,
                confirmLabel: 'Marcar como fallido',
                success: 'Desembolso marcado como fallido.',
                field: { name: 'reason', label: 'Motivo', required: true },
                danger: true,
              },
            ]
      return {
        id: d.id,
        sol: `…${d.creditId.slice(-8)}`,
        cliente: clientCell(idx, d.clientId),
        q: `${clientSearch(idx, d.clientId)} ${d.bank}`,
        importe: d.amount,
        cuenta: d.cbu ? { a: d.bank || 'Cuenta', b: `CBU ···· ${d.cbu.slice(-4)}` } : { a: 'Sin CBU/CVU cargado' },
        estadoKey: failed ? 'Fallido' : d.cbu ? 'Pendiente' : 'Sin cuenta',
        estado: failed ? badge('Fallido', 'danger') : d.cbu ? badge('Por transferir', 'neutral') : badge('Sin cuenta', 'warning'),
        pedido: d.requestedAt,
        acc: actions,
      }
    })

  return (
    <>
      {head}
      <div style={{ marginBottom: 20 }}>
        <Callout icon="clip" title="Acreditar es un paso definitivo">
          Un crédito pasa a «Vigente» cuando se acredita el desembolso: se generan las cuotas y empieza a correr el plazo. Hacelo solo después de
          transferir el dinero a la cuenta del cliente.
        </Callout>
      </div>
      <DataGrid
        cfg={{
          id: 'desembolso',
          rows,
          sort: { key: 'pedido', dir: 1 },
          dateKey: 'pedido',
          dateLabel: 'Pedido',
          searchKeys: ['sol', 'q'],
          searchPlaceholder: 'Cliente, DNI, solicitud o banco',
          chips: {
            label: 'Transferencia',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'Pendiente', l: 'Por transferir' },
              { v: 'Sin cuenta', l: 'Sin cuenta' },
              { v: 'Fallido', l: 'Fallidos' },
            ],
          },
          columns: [
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuenta', label: 'Cuenta destino', kind: 'stack' },
            { key: 'pedido', label: 'Pedido el', kind: 'date' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Por transferir', 'Sin cuenta', 'Fallido'] },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'desembolsos', sumKey: 'importe', sumLabel: 'a transferir' },
          empty: 'No hay desembolsos pendientes.',
        }}
      />
    </>
  )
}
