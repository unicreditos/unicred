import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { arcaOverview } from '@/lib/admin-external'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Padrón ARCA' }
export const dynamic = 'force-dynamic'

export default async function PadronArcaPage() {
  const { perms, userId } = await loadDeskChrome()
  const head = <PageHead title="Padrón ARCA" description="Constancia ARCA de cada cliente. Los nombres que no coinciden quedan marcados para revisión manual." />
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="el padrón ARCA" /></>
  await auditAdminView(userId, 'padron_arca')
  const found = await arcaOverview().catch(() => [])
  const rows: GridRow[] = found.map((r) => ({
    id: r.userId,
    cliente: { a: r.name || r.email || 'Cliente', b: r.email || undefined },
    q: `${r.name ?? ''} ${r.email ?? ''} ${r.snapshot?.cuil ?? ''}`,
    cuil: r.snapshot?.cuil ?? '—',
    nombreArca: r.snapshot?.name ?? '—',
    condicion: r.snapshot?.taxConditionLabel ?? '—',
    clave: r.snapshot?.taxStatus ?? '—',
    revisionKey: r.manualReview ? 'Revisión manual' : r.snapshot ? 'Consultado' : 'Sin consulta',
    revision: r.manualReview ? badge('Revisión manual', 'warning') : r.snapshot ? badge('Consultado', 'success') : badge('Sin consulta', 'neutral'),
    consultado: r.snapshot?.consultedAt ?? null,
    acciones: [{ kind: 'link' as const, label: 'Ver constancia', href: `/admin/originacion/padron-arca/${r.userId}` }],
  }))
  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'padron-arca',
          rows,
          pageSize: 15,
          sort: { key: 'consultado', dir: -1 },
          dateKey: 'consultado',
          dateLabel: 'Consultado',
          searchKeys: ['q'],
          searchPlaceholder: 'Nombre, email o CUIL',
          chips: {
            label: 'Estado',
            key: 'revisionKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Revisión manual', l: 'Revisión manual' },
              { v: 'Consultado', l: 'Consultados' },
              { v: 'Sin consulta', l: 'Sin consulta' },
            ],
          },
          columns: [
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'cuil', label: 'CUIL' },
            { key: 'nombreArca', label: 'Nombre en ARCA' },
            { key: 'condicion', label: 'Condición' },
            { key: 'clave', label: 'Clave fiscal' },
            { key: 'revision', label: 'Estado', kind: 'badge', order: ['Revisión manual', 'Consultado', 'Sin consulta'] },
            { key: 'consultado', label: 'Consultado', kind: 'date' },
            { key: 'acciones', label: 'Acciones', kind: 'actions' },
          ],
          summary: { noun: 'clientes' },
        }}
      />
    </>
  )
}