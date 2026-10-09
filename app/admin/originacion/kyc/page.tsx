import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { DeskRowAction, GridRow, RowAction } from '@/components/uc/grid-types'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { badge, clientCell, clientIndex, clientSearch, fullName } from '@/lib/uc/admin'

export const metadata = { title: 'Validación de identidad' }

const RESULT = {
  verified: { l: 'Aprobado', k: 'Aprobado', t: 'success' },
  rejected: { l: 'Rechazado', k: 'Rechazado', t: 'danger' },
  in_review: { l: 'Observado', k: 'En curso', t: 'warning' },
  pending: { l: 'En curso', k: 'En curso', t: 'info' },
  expired: { l: 'Vencido', k: 'Rechazado', t: 'neutral' },
} as const

export default async function KycPage() {
  const { state, perms, userId } = await loadDesk()
  const head = <PageHead title="Validación de identidad (KYC)" description="Resultados de la verificación biométrica y el cruce con RENAPER." />
  if (!perms.has('kyc.review')) return <>{head}<NoAccess what="las verificaciones de identidad" /></>
  await auditAdminView(userId, 'kyc')

  const idx = clientIndex(state)
  const rows: GridRow[] = state.kyc.map((k) => {
    const r = RESULT[k.status] ?? RESULT.pending
    const open = k.status === 'pending' || k.status === 'in_review'
    const name = fullName(idx.get(k.clientId))
    const actions: RowAction[] = open
      ? ([
          {
            kind: 'desk',
            label: 'Verificar',
            icon: 'check',
            action: 'decideKyc',
            payload: { kycId: k.id, status: 'verified' },
            title: 'Verificar identidad',
            sub: name,
            summary: [
              ['Prueba de vida', k.liveness ? 'Superada' : 'Pendiente'],
              ['Documento', k.documentMatch ? 'Coincide' : 'No coincide'],
            ],
            warning: k.documentMatch ? undefined : 'El documento no coincide con los datos del cliente.',
            confirmLabel: 'Verificar identidad',
            success: 'Identidad verificada.',
            field: { name: 'notes', label: 'Nota (opcional)' },
          },
          {
            kind: 'desk',
            label: 'Rechazar',
            action: 'decideKyc',
            payload: { kycId: k.id, status: 'rejected' },
            title: 'Rechazar identidad',
            sub: name,
            confirmLabel: 'Rechazar',
            success: 'Identidad rechazada.',
            field: { name: 'notes', label: 'Motivo', required: true },
            danger: true,
          },
        ] satisfies DeskRowAction[])
      : []

    const rowActions: RowAction[] = [
      {
        kind: 'link',
        label: 'Ver legajo',
        href: `/admin/clientes/${encodeURIComponent(k.clientId)}`,
      },
      ...actions,
    ]

    return {
      id: k.id,
      sesion: `…${(k.sessionId || k.id).slice(-8)}`,
      cliente: clientCell(idx, k.clientId),
      q: clientSearch(idx, k.clientId),
      rostroTxt: k.faceMatchScore == null ? null : `${Math.round(k.faceMatchScore)} %`,
      vida: k.liveness ? badge('Superada', 'success') : badge(open ? 'Pendiente' : 'Falló', open ? 'neutral' : 'danger'),
      renaper: k.documentMatch ? badge('Coincide', 'success') : badge(open ? 'Pendiente' : 'No coincide', open ? 'neutral' : 'danger'),
      resultadoKey: r.k,
      resultado: badge(r.l, r.t),
      fecha: k.startedAt,
      acc: rowActions,
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'kyc',
          rows,
          pageSize: 15,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['sesion', 'q'],
          searchPlaceholder: 'Cliente, DNI o sesión',
          chips: {
            label: 'Resultado',
            key: 'resultadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'En curso', l: 'En curso' },
              { v: 'Aprobado', l: 'Aprobados' },
              { v: 'Rechazado', l: 'Rechazados' },
            ],
          },
          columns: [
            { key: 'sesion', label: 'Sesión Didit', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'rostroTxt', label: 'Coincidencia facial', kind: 'num', align: 'r' },
            { key: 'vida', label: 'Prueba de vida', kind: 'badge' },
            { key: 'renaper', label: 'Documento', kind: 'badge' },
            { key: 'resultado', label: 'Resultado', kind: 'badge', order: ['En curso', 'Observado', 'Aprobado', 'Rechazado'] },
            { key: 'fecha', label: 'Fecha', kind: 'datetime' },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'validaciones' },
        }}
      />
    </>
  )
}
