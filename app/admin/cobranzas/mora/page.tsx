import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow, RowAction } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, BUCKET_LABEL, clientCell, clientIndex, clientSearch, fullName } from '@/lib/uc/admin'
import { money } from '@/lib/uc/format'

export const metadata = { title: 'Mora' }

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'email', label: 'Email' },
  { value: 'otro', label: 'Otro' },
]

export default async function MoraPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Mora" description="Créditos con cuotas vencidas, por tramo de días de atraso." />
  if (!perms.has('payments.read')) return <>{head}<NoAccess what="la mora" /></>
  const canLog = perms.has('payments.reconcile')

  const idx = clientIndex(state)
  const rows: GridRow[] = state.collections.map((c) => {
    const tramo = BUCKET_LABEL[c.bucket] ?? c.bucket
    const name = fullName(idx.get(c.clientId))
    const actions: RowAction[] = canLog
      ? [
          {
            kind: 'desk',
            label: 'Registrar contacto',
            icon: 'phone',
            action: 'logCollectionContact',
            payload: { caseId: c.id },
            title: 'Registrar contacto',
            sub: name,
            summary: [
              ['Monto vencido', money(c.overdueAmount)],
              ['Atraso', `${c.daysPastDue} días`],
            ],
            confirmLabel: 'Guardar contacto',
            success: 'Contacto registrado.',
            choice: { name: 'channel', label: 'Canal', options: CHANNELS },
            field: { name: 'note', label: 'Qué se habló', required: true, placeholder: 'Ej.: promete pagar el viernes' },
          },
        ]
      : []
    return {
      id: c.id,
      sol: `…${c.creditId.slice(-8)}`,
      cliente: clientCell(idx, c.clientId),
      q: clientSearch(idx, c.clientId),
      tel: idx.get(c.clientId)?.phone ?? '',
      vencido: c.overdueAmount,
      atraso: c.daysPastDue,
      tramoKey: tramo,
      tramo: badge(tramo, c.bucket === '1_30' || c.bucket === '31_60' ? 'warning' : 'danger'),
      contacto: c.lastContactAt,
      acc: actions,
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'mora',
          rows,
          pageSize: 15,
          sort: { key: 'atraso', dir: -1 },
          searchKeys: ['sol', 'q', 'tel'],
          searchPlaceholder: 'Cliente, DNI, teléfono o solicitud',
          chips: {
            label: 'Tramo de atraso',
            key: 'tramoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Hasta 30 d', l: 'Hasta 30 d' },
              { v: '31–60 d', l: '31–60 d' },
              { v: 'Más de 60 d', l: 'Más de 60 d' },
            ],
          },
          columns: [
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'tel', label: 'Teléfono', kind: 'num' },
            { key: 'vencido', label: 'Monto vencido', kind: 'money', align: 'r', amount: true },
            { key: 'atraso', label: 'Días de atraso', kind: 'num', align: 'r' },
            { key: 'tramo', label: 'Tramo', kind: 'badge', order: ['Hasta 30 d', '31–60 d', 'Más de 60 d'] },
            { key: 'contacto', label: 'Último contacto', kind: 'date' },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'créditos en mora', sumKey: 'vencido', sumLabel: 'vencido' },
          empty: 'No hay créditos con cuotas vencidas.',
        }}
      />
    </>
  )
}
