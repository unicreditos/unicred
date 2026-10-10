import { DataGrid } from '@/components/uc/data-grid'
import { ButtonLink, NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Comercios' }

const LABEL = { active: 'Activo', paused: 'Pausado', onboarding: 'En alta', rejected: 'Rechazado' } as const
const TONE = { active: 'success', paused: 'warning', onboarding: 'info', rejected: 'danger' } as const

export default async function ComerciosPage() {
  const { state, perms } = await loadDesk()
  const head = (
    <PageHead
      title="Comercios"
      description="Comercios adheridos que venden en cuotas con Unicréditos."
      actions={perms.has('merchants.write') ? <ButtonLink primary href="/admin/comercios/nuevo">Alta de comercio</ButtonLink> : undefined}
    />
  )
  if (!perms.has('merchants.read')) return <>{head}<NoAccess what="los comercios" /></>

  const ops = new Map<string, { n: number; total: number }>()
  for (const a of state.applications) {
    if (!a.merchantId || (a.status !== 'approved' && a.status !== 'pending')) continue
    const cur = ops.get(a.merchantId) ?? { n: 0, total: 0 }
    cur.n += 1
    cur.total += a.amount
    ops.set(a.merchantId, cur)
  }

  const rows: GridRow[] = state.merchants.map((m) => ({
    id: m.id,
    comercio: { a: m.name, b: `CUIT ${m.cuit}` },
    q: `${m.name} ${m.cuit} ${m.email}`,
    rubro: m.category || '—',
    provincia: m.province || '—',
    ops: ops.get(m.id)?.n ?? 0,
    ventas: ops.get(m.id)?.total ?? 0,
    contacto: m.email || m.phone || '—',
    estadoKey: LABEL[m.status],
    estado: badge(LABEL[m.status], TONE[m.status]),
    alta: m.onboardedAt,
    ver: [{ kind: 'link' as const, label: 'Abrir', href: `/admin/comercios/${encodeURIComponent(m.id)}` }],
  }))

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'comercios',
          rows,
          pageSize: 15,
          sort: { key: 'ventas', dir: -1 },
          dateKey: 'alta',
          dateLabel: 'Alta',
          searchKeys: ['q'],
          searchPlaceholder: 'Comercio o CUIT',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Activo', l: 'Activos' },
              { v: 'En alta', l: 'En alta' },
              { v: 'Pausado', l: 'Pausados' },
            ],
          },
          selects: [{ key: 'rubro', label: 'Rubro', all: 'Rubro: todos' }],
          columns: [
            { key: 'comercio', label: 'Comercio', kind: 'stack' },
            { key: 'rubro', label: 'Rubro' },
            { key: 'provincia', label: 'Provincia' },
            { key: 'contacto', label: 'Contacto', muted: true },
            { key: 'ops', label: 'Operaciones', kind: 'num', align: 'r' },
            { key: 'ventas', label: 'Ventas financiadas', kind: 'money', align: 'r', amount: true },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['En alta', 'Activo', 'Pausado', 'Rechazado'] },
            { key: 'alta', label: 'Alta', kind: 'date' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'comercios', sumKey: 'ventas', sumLabel: 'financiados' },
        }}
      />
    </>
  )
}
