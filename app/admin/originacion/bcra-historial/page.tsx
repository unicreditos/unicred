import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { bcraLatestPerClient } from '@/lib/admin-external'

export const metadata = { title: 'Historial BCRA' }
export const dynamic = 'force-dynamic'

export default async function BcraHistorialPage() {
  const { perms, userId } = await loadDeskChrome()
  const head = <PageHead title="Historial BCRA" description="Última consulta de cada cliente y cantidad de consultas. Abrí un cliente para ver el historial completo y actualizarlo." />
  if (!perms.has('risk.read')) return <>{head}<NoAccess what="el historial BCRA" /></>
  await auditAdminView(userId, 'historial_bcra')
  const found = await bcraLatestPerClient().catch(() => [])
  const rows: GridRow[] = found.map((r) => ({
    id: String(r.userId),
    cliente: { a: String(r.name || r.email || 'Cliente'), b: String(r.email || '') || undefined },
    q: `${r.name ?? ''} ${r.email ?? ''} ${r.cuil ?? ''}`,
    cuil: String(r.cuil ?? ''),
    situacion: r.worstSituation == null ? null : Number(r.worstSituation),
    deuda: r.totalDebt == null ? null : Number(r.totalDebt),
    entidades: r.entitiesCount == null ? null : Number(r.entitiesCount),
    score: r.computedScore == null ? null : Number(r.computedScore),
    consultas: Number(r.consultas ?? 0),
    ultima: r.createdAt ? new Date(String(r.createdAt)).toISOString() : null,
    acciones: [{ kind: 'link' as const, label: 'Historial', href: `/admin/originacion/bcra-historial/${String(r.userId)}` }],
  }))
  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'bcra-hist',
          rows,
          pageSize: 15,
          sort: { key: 'ultima', dir: -1 },
          dateKey: 'ultima',
          dateLabel: 'Última consulta',
          searchKeys: ['q'],
          searchPlaceholder: 'Nombre, email o CUIL',
          columns: [
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'cuil', label: 'CUIL' },
            { key: 'situacion', label: 'Peor situación', kind: 'num' },
            { key: 'deuda', label: 'Deuda total', kind: 'money' },
            { key: 'entidades', label: 'Entidades', kind: 'num' },
            { key: 'score', label: 'Score', kind: 'num' },
            { key: 'consultas', label: 'Consultas', kind: 'num' },
            { key: 'ultima', label: 'Última', kind: 'date' },
            { key: 'acciones', label: 'Acciones', kind: 'actions' },
          ],
          summary: { noun: 'clientes' },
        }}
      />
    </>
  )
}