import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch } from '@/lib/uc/admin'

export const metadata = { title: 'Solicitudes' }

const LABEL: Record<string, string> = { pending: 'En revisión', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Anulada' }
const TONE = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'neutral' } as const

export default async function SolicitudesPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Solicitudes" description="Todas las solicitudes de crédito, desde que entran hasta la decisión final." />
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="las solicitudes de crédito" /></>

  const idx = clientIndex(state)
  const rows: GridRow[] = state.applications.map((a) => ({
    id: a.id,
    sol: `…${a.id.slice(-8)}`,
    cliente: clientCell(idx, a.clientId),
    q: clientSearch(idx, a.clientId),
    importe: a.amount,
    cuotas: a.installments,
    canal: a.merchantId ? 'Comercio' : 'Directo',
    estadoKey: a.status,
    estado: badge(LABEL[a.status] ?? a.status, TONE[a.status] ?? 'neutral'),
    ingreso: a.createdAt,
    ver: [{ kind: 'link', label: a.status === 'pending' ? 'Revisar' : 'Ver', href: `/admin/originacion/solicitudes/${encodeURIComponent(a.id)}` }],
  }))

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'solicitudes',
          rows,
          pageSize: 15,
          sort: { key: 'ingreso', dir: -1 },
          dateKey: 'ingreso',
          dateLabel: 'Ingreso',
          searchKeys: ['sol', 'q'],
          searchPlaceholder: 'Cliente, DNI o N° de solicitud',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'abiertas', l: 'Abiertas', in: ['pending'] },
              { v: 'approved', l: 'Aprobadas' },
              { v: 'rejected', l: 'Rechazadas' },
            ],
          },
          selects: [{ key: 'canal', label: 'Canal', all: 'Canal: todos' }],
          columns: [
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'canal', label: 'Canal' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['En revisión', 'Aprobada', 'Rechazada', 'Anulada'] },
            { key: 'ingreso', label: 'Ingreso', kind: 'date' },
            { key: 'ver', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'solicitudes', sumKey: 'importe', sumLabel: 'solicitados' },
        }}
      />
    </>
  )
}
