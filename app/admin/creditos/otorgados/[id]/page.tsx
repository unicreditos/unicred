import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DataGrid } from '@/components/uc/data-grid'
import { BackLink, Badge, NoAccess, PageHead, Pad, ProgressBar, SectionTitle } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDesk } from '@/lib/admin-desk/load'
import { badge, clientIndex, fullName } from '@/lib/uc/admin'
import { fdate, fmtPct, money } from '@/lib/uc/format'

export const metadata = { title: 'Crédito' }

const TONE = { paid: 'success', pending: 'neutral', overdue: 'danger', partial: 'warning' } as const
const LABEL = { paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida', partial: 'Parcial' } as const

export default async function CreditoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { state, perms, userId } = await loadDesk()
  if (!perms.has('credits.read')) return <NoAccess what="la cartera de créditos" />
  await auditAdminView(userId, 'credito', id)

  const credit = state.credits.find((c) => c.id === id)
  if (!credit) notFound()

  const idx = clientIndex(state)
  const client = idx.get(credit.clientId)
  const product = state.products.find((p) => p.id === credit.productId)
  const paid = credit.schedule.filter((i) => i.status === 'paid').length
  const late = credit.status === 'active' && credit.bucket !== 'al_dia'
  const rows: GridRow[] = credit.schedule.map((i) => ({
    id: String(i.number),
    n: `${i.number}/${credit.installments}`,
    nro: i.number,
    venc: i.dueDate,
    importe: i.amount,
    pagado: i.paidAmount || null,
    estadoKey: i.status,
    estado: badge(LABEL[i.status] ?? i.status, TONE[i.status] ?? 'neutral'),
    pagoFecha: i.paidAt,
  }))

  return (
    <>
      <BackLink href="/admin/creditos/otorgados">Créditos otorgados</BackLink>
      <PageHead
        title={`Crédito de ${fullName(client)}`}
        description={`${money(credit.amount)} en ${credit.installments} cuotas · …${credit.id.slice(-8)}`}
        actions={late ? <Badge tone={credit.daysPastDue > 30 ? 'danger' : 'warning'}>Demorado · {credit.daysPastDue} d</Badge> : <Badge tone={credit.status === 'active' ? 'success' : 'neutral'}>{credit.status === 'active' ? 'Vigente' : credit.status === 'paid' ? 'Cancelado' : 'Aprobado'}</Badge>}
      />
      <Pad style={{ marginBottom: 20 }}>
        <div className="uc-detail-head">
          <div className="uc-kvs">
            <div><small>Cliente</small><b>{client ? <Link href={`/admin/clientes/${encodeURIComponent(client.id)}`}>{fullName(client)}</Link> : '—'}</b></div>
            <div><small>Producto</small><b>{product?.name ?? '—'}</b></div>
            <div><small>Importe</small><b className="uc-num">{money(credit.amount)}</b></div>
            <div><small>Cuota</small><b className="uc-num">{money(credit.installmentAmount)}</b></div>
            <div><small>Saldo a cobrar</small><b className="uc-num">{money(credit.principalOutstanding)}</b></div>
            <div><small>TNA / CFT</small><b className="uc-num">{fmtPct(credit.tna)} / {fmtPct(credit.cft)}</b></div>
            <div><small>Acreditado</small><b className="uc-num">{fdate(credit.disbursedAt)}</b></div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <ProgressBar value={credit.installments ? (paid / credit.installments) * 100 : 0} label="Cuotas pagadas" />
          <p className="uc-note" style={{ marginTop: 8 }}>
            <b className="uc-num" style={{ color: 'var(--uc-text)' }}>{paid}</b> de <span className="uc-num">{credit.installments}</span> cuotas pagadas
          </p>
        </div>
      </Pad>
      <SectionTitle title="Plan de cuotas" aside="Importes con impuestos incluidos" />
      <DataGrid
        cfg={{
          id: `crono-${credit.id}`,
          rows,
          sort: { key: 'nro', dir: 1 },
          chips: {
            label: 'Estado de la cuota',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'paid', l: 'Pagadas' },
              { v: 'pending', l: 'Pendientes', in: ['pending', 'partial'] },
              { v: 'overdue', l: 'Vencidas' },
            ],
          },
          empty: 'Todavía no hay plan de cuotas: se genera al acreditar el crédito.',
          columns: [
            { key: 'n', label: 'Cuota', kind: 'num', sortable: false },
            { key: 'venc', label: 'Vencimiento', kind: 'date' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'pagado', label: 'Pagado', kind: 'money', align: 'r' },
            { key: 'estado', label: 'Estado', kind: 'badge' },
            { key: 'pagoFecha', label: 'Pagada el', kind: 'date' },
          ],
          summary: { noun: 'cuotas', sumKey: 'importe', sumLabel: 'en total' },
        }}
      />
    </>
  )
}
