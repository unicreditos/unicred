import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch } from '@/lib/uc/admin'

export const metadata = { title: 'Créditos otorgados' }

export default async function OtorgadosPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Créditos otorgados" description="Préstamos vigentes y la situación de pago de la próxima cuota." />
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="la cartera de créditos" /></>

  const idx = clientIndex(state)
  const rows: GridRow[] = state.credits
    .filter((c) => c.status === 'active')
    .map((c) => {
      const paid = c.schedule.filter((i) => i.status === 'paid').length
      const next = c.schedule.find((i) => i.status !== 'paid')
      const late = c.bucket !== 'al_dia'
      return {
        id: c.id,
        sol: `…${c.id.slice(-8)}`,
        cliente: clientCell(idx, c.clientId),
        q: clientSearch(idx, c.clientId),
        importe: c.amount,
        cuotas: `${paid}/${c.installments}`,
        otorg: c.disbursedAt,
        pago: next?.dueDate ?? null,
        sitKey: late ? 'Demorado' : 'Normal',
        sit: late ? badge(`Demorado · ${c.daysPastDue} d`, c.daysPastDue > 30 ? 'danger' : 'warning') : badge('Normal', 'success'),
        ver: [{ kind: 'link', label: 'Ver', href: `/admin/creditos/otorgados/${encodeURIComponent(c.id)}` }],
      }
    })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'otorgados',
          rows,
          pageSize: 15,
          sort: { key: 'otorg', dir: -1 },
          dateKey: 'otorg',
          dateLabel: 'Otorgamiento',
          searchKeys: ['sol', 'q'],
          searchPlaceholder: 'Cliente, DNI o N° de solicitud',
          chips: {
            label: 'Situación de pago',
            key: 'sitKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Normal', l: 'Normal' },
              { v: 'Demorado', l: 'Demorado' },
            ],
          },
          columns: [
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'otorg', label: 'Fecha de otorgamiento', kind: 'date' },
            { key: 'pago', label: 'Próximo vencimiento', kind: 'date' },
            { key: 'sit', label: 'Situación de pago', kind: 'badge', order: ['Normal'] },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'créditos', sumKey: 'importe', sumLabel: 'otorgados' },
        }}
      />
    </>
  )
}
