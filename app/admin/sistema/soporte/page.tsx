import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow, RowAction } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch } from '@/lib/uc/admin'

export const metadata = { title: 'Soporte' }

const STATE = { open: ['Abierto', 'warning'], pending: ['En curso', 'info'], resolved: ['Resuelto', 'success'], closed: ['Resuelto', 'success'] } as const
const PRIO = { urgent: ['Alta', 'danger'], high: ['Alta', 'danger'], medium: ['Media', 'warning'], low: ['Baja', 'neutral'] } as const
const CHANNEL = { email: 'Email', whatsapp: 'WhatsApp', telefono: 'Teléfono', interno: 'Interno' } as const

export default async function SoportePage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Soporte" description="Reclamos y consultas de clientes." />
  if (!perms.has('clients.read')) return <>{head}<NoAccess what="el soporte" /></>

  const idx = clientIndex(state)
  const ops = new Map(state.operators.map((o) => [o.id, o.name]))
  const rows: GridRow[] = state.tickets.map((t) => {
    const [stLabel, stTone] = STATE[t.status]
    const [prLabel, prTone] = PRIO[t.priority]
    const actions: RowAction[] =
      t.status === 'open' || t.status === 'pending'
        ? [
            {
              kind: 'desk',
              label: 'Resolver',
              icon: 'check',
              action: 'resolveTicket',
              payload: { id: t.id },
              title: 'Marcar como resuelto',
              sub: t.subject,
              confirmLabel: 'Marcar como resuelto',
              success: 'Reclamo resuelto.',
            },
          ]
        : []
    return {
      id: t.id,
      nro: `…${t.id.slice(-6)}`,
      cliente: clientCell(idx, t.clientId),
      q: `${clientSearch(idx, t.clientId)} ${t.subject}`,
      asunto: t.subject,
      canal: CHANNEL[t.channel] ?? t.channel,
      prioKey: prLabel,
      prio: badge(prLabel, prTone),
      estadoKey: stLabel,
      estado: badge(stLabel, stTone),
      creado: t.createdAt,
      asignado: ops.get(t.assigneeId) ?? '—',
      acc: actions,
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'tickets',
          rows,
          pageSize: 15,
          sort: { key: 'creado', dir: -1 },
          dateKey: 'creado',
          dateLabel: 'Creado',
          searchKeys: ['nro', 'q'],
          searchPlaceholder: 'Cliente, DNI, ticket o asunto',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Abierto', l: 'Abiertos' },
              { v: 'En curso', l: 'En curso' },
              { v: 'Resuelto', l: 'Resueltos' },
            ],
          },
          selects: [{ key: 'prioKey', label: 'Prioridad', all: 'Prioridad: todas', options: ['Alta', 'Media', 'Baja'] }],
          columns: [
            { key: 'nro', label: 'Ticket', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'asunto', label: 'Asunto' },
            { key: 'canal', label: 'Canal' },
            { key: 'prio', label: 'Prioridad', kind: 'badge', order: ['Baja', 'Media', 'Alta'] },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Abierto', 'En curso', 'Resuelto'] },
            { key: 'creado', label: 'Creado', kind: 'datetime' },
            { key: 'asignado', label: 'Asignado a' },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'tickets' },
        }}
      />
    </>
  )
}
