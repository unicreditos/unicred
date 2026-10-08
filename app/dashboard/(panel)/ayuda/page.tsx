import { listMyClaims } from '@/app/actions/claims'
import { ClaimsPanel } from '@/components/dashboard/claims-panel'
import { DataGrid } from '@/components/uc/data-grid'
import type { GridRow } from '@/components/uc/grid-types'
import { PageHead, SectionTitle } from '@/components/uc/blocks'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Reclamos y consultas' }

const STATE: Record<string, [string, 'success' | 'info' | 'warning']> = {
  open: ['En curso', 'info'],
  pending: ['En curso', 'info'],
  waiting: ['En curso', 'info'],
  resolved: ['Resuelto', 'success'],
  closed: ['Resuelto', 'success'],
}

export default async function AyudaPage() {
  const claims = await listMyClaims().catch(() => [])
  const rows: GridRow[] = claims.map((c) => {
    const [label, tone] = STATE[c.status] ?? ['En curso', 'info']
    return {
      id: c.id,
      nro: `…${c.id.slice(-6)}`,
      asunto: c.subject,
      estadoKey: label,
      estado: badge(label, tone),
      creado: new Date(c.createdAt as Date).toISOString(),
      actualizado: new Date((c.lastMessageAt ?? c.updatedAt) as Date).toISOString(),
    }
  })

  return (
    <>
      <PageHead title="Reclamos y consultas" description="Tus reclamos, con su número de seguimiento, y un lugar para presentar uno nuevo." />
      <DataGrid
        cfg={{
          id: 'mistickets',
          rows,
          sort: { key: 'creado', dir: -1 },
          searchKeys: ['nro', 'asunto'],
          searchPlaceholder: 'Buscar reclamo',
          empty: 'No tenés reclamos. Si necesitás ayuda, escribinos desde el formulario de abajo.',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'En curso', l: 'En curso' },
              { v: 'Resuelto', l: 'Resueltos' },
            ],
          },
          columns: [
            { key: 'nro', label: 'N°', kind: 'num' },
            { key: 'asunto', label: 'Asunto' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['En curso', 'Resuelto'] },
            { key: 'creado', label: 'Creado', kind: 'datetime' },
            { key: 'actualizado', label: 'Última respuesta', kind: 'datetime' },
          ],
          summary: { noun: 'reclamos' },
        }}
      />
      <SectionTitle title="Nuevo reclamo o consulta" aside="Te respondemos en menos de 24 h hábiles" />
      <ClaimsPanel />
    </>
  )
}
