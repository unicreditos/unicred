import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { bcraBadge, clientCell, clientIndex, clientSearch } from '@/lib/uc/admin'

export const metadata = { title: 'BCRA / Riesgo' }

export default async function RiesgoPage() {
  const { state, perms, userId } = await loadDesk()
  const head = <PageHead title="BCRA / Riesgo" description="Situación en la Central de Deudores del BCRA y score interno de cada cliente." />
  if (!perms.has('risk.read')) return <>{head}<NoAccess what="la información de riesgo" /></>
  await auditAdminView(userId, 'riesgo_bcra')

  const idx = clientIndex(state)
  const rows: GridRow[] = state.cendeu.map((r) => {
    const sit = r.sit5 ? 5 : r.sit4 ? 4 : r.sit3 ? 3 : r.sit2 ? 2 : r.sit1 ? 1 : 0
    return {
      id: r.id,
      cliente: clientCell(idx, r.clientId),
      q: `${clientSearch(idx, r.clientId)} ${idx.get(r.clientId)?.cuit ?? ''}`,
      cuil: idx.get(r.clientId)?.cuit ?? '',
      sitKey: sit >= 3 ? '3' : String(sit),
      sit: bcraBadge(sit),
      entidades: r.entities,
      score: r.score,
      obs: r.observations,
      consulta: r.consultedAt,
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'riesgo',
          rows,
          pageSize: 15,
          sort: { key: 'consulta', dir: -1 },
          dateKey: 'consulta',
          dateLabel: 'Consulta',
          searchKeys: ['q'],
          searchPlaceholder: 'Cliente, DNI o CUIL',
          chips: {
            label: 'Situación BCRA',
            key: 'sitKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: '1', l: 'Sit. 1' },
              { v: '2', l: 'Sit. 2' },
              { v: '3', l: 'Sit. 3 o peor' },
            ],
          },
          columns: [
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'cuil', label: 'CUIL', kind: 'num' },
            { key: 'sit', label: 'Situación', kind: 'badge', order: ['Sin consultar', 'Situación 1', 'Situación 2', 'Situación 3', 'Situación 4', 'Situación 5'] },
            { key: 'entidades', label: 'Entidades', kind: 'num', align: 'r' },
            { key: 'score', label: 'Score interno', kind: 'num', align: 'r', amount: true },
            { key: 'obs', label: 'Observaciones', muted: true },
            { key: 'consulta', label: 'Última consulta', kind: 'date' },
          ],
          summary: { noun: 'clientes consultados' },
        }}
      />
    </>
  )
}
