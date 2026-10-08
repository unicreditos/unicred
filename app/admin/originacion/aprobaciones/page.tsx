import { DataGrid } from '@/components/uc/data-grid'
import { Callout, NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow, RowAction } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge, bcraByClient, bcraBadge, clientCell, clientIndex, clientSearch, fullName } from '@/lib/uc/admin'
import { cuotaFrancesa, money } from '@/lib/uc/format'

export const metadata = { title: 'Aprobaciones' }

export default async function AprobacionesPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Aprobaciones" description="Decisión manual de Finanzas sobre cada solicitud." />
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="las aprobaciones" /></>

  const idx = clientIndex(state)
  const bcra = bcraByClient(state)
  const products = new Map(state.products.map((p) => [p.id, p]))

  const rows: GridRow[] = state.applications.map((a) => {
    const c = idx.get(a.clientId)
    const p = products.get(a.productId)
    const income = c?.declaredIncome ?? 0
    const rci = income > 0 && p ? (cuotaFrancesa(a.amount, a.installments, p.tna) / income) * 100 : null
    const sit = bcra.get(a.clientId)?.sit
    const name = fullName(c)
    const summary: Array<[string, string]> = [
      ['Cliente', name],
      ['Importe', `${money(a.amount)} en ${a.installments} cuotas`],
      ['Score interno', c?.score ? String(c.score) : '—'],
    ]
    const actions: RowAction[] =
      a.status === 'pending'
        ? [
            ...(perms.has('credits.approve')
              ? ([
                  {
                    kind: 'desk',
                    label: 'Aprobar',
                    icon: 'check',
                    action: 'approveApplication',
                    payload: { applicationId: a.id },
                    title: 'Aprobar crédito',
                    sub: name,
                    summary,
                    warning: c?.kycStatus === 'verified' ? 'Se genera el desembolso pendiente.' : 'La identidad no está verificada: el sistema no deja aprobar.',
                    confirmLabel: 'Aprobar',
                    success: 'Crédito aprobado.',
                    field: { name: 'comment', label: 'Comentario del analista', placeholder: 'Motivo de la decisión' },
                  },
                ] as RowAction[])
              : []),
            ...(perms.has('credits.reject')
              ? ([
                  {
                    kind: 'desk',
                    label: 'Rechazar',
                    action: 'rejectApplication',
                    payload: { applicationId: a.id },
                    title: 'Rechazar solicitud',
                    sub: name,
                    summary,
                    confirmLabel: 'Rechazar',
                    success: 'Solicitud rechazada.',
                    field: { name: 'comment', label: 'Motivo del rechazo', required: true },
                    danger: true,
                  },
                ] as RowAction[])
              : []),
            { kind: 'link', label: 'Detalle', href: `/admin/originacion/solicitudes/${encodeURIComponent(a.id)}` },
          ]
        : [{ kind: 'link', label: 'Ver', href: `/admin/originacion/solicitudes/${encodeURIComponent(a.id)}` }]
    const decision = a.status === 'pending' ? 'Pendiente' : a.status === 'approved' ? 'Aprobada' : a.status === 'rejected' ? 'Rechazada' : 'Anulada'
    return {
      id: a.id,
      sol: `…${a.id.slice(-8)}`,
      cliente: clientCell(idx, a.clientId),
      q: clientSearch(idx, a.clientId),
      importe: a.amount,
      cuotas: a.installments,
      bcra: bcraBadge(sit),
      score: c?.score || null,
      rci: rci == null ? null : Math.round(rci * 10) / 10,
      decisionKey: decision,
      decision: badge(decision, decision === 'Aprobada' ? 'success' : decision === 'Rechazada' ? 'danger' : decision === 'Anulada' ? 'neutral' : 'warning'),
      ingreso: a.createdAt,
      acc: actions,
    }
  })

  return (
    <>
      {head}
      <div style={{ marginBottom: 20 }}>
        <Callout icon="lock" title="Decisiones manuales y automáticas" tone="warning">
          El scoring puede calificar o rechazar solo las solicitudes claras (queda registrado como decisión automática). Las que caen en revisión
          manual las decide una persona del equipo, con comentario, y queda en Auditoría.
        </Callout>
      </div>
      <DataGrid
        cfg={{
          id: 'aprob',
          rows,
          pageSize: 15,
          sort: { key: 'ingreso', dir: -1 },
          dateKey: 'ingreso',
          dateLabel: 'Ingreso',
          searchKeys: ['sol', 'q'],
          searchPlaceholder: 'Cliente, DNI o N° de solicitud',
          chips: {
            label: 'Decisión',
            key: 'decisionKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'Pendiente', l: 'Pendientes' },
              { v: 'Aprobada', l: 'Aprobadas' },
              { v: 'Rechazada', l: 'Rechazadas' },
            ],
          },
          columns: [
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'bcra', label: 'BCRA', kind: 'badge', order: ['Sin consultar', 'Situación 1', 'Situación 2', 'Situación 3', 'Situación 4', 'Situación 5'] },
            { key: 'score', label: 'Score', kind: 'num', align: 'r' },
            { key: 'rci', label: 'Cuota / ingreso', kind: 'pct', align: 'r' },
            { key: 'decision', label: 'Decisión', kind: 'badge', order: ['Pendiente', 'Aprobada', 'Rechazada', 'Anulada'] },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'solicitudes' },
        }}
      />
    </>
  )
}
