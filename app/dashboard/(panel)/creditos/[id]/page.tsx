import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { EarlySettlementCard } from '@/components/dashboard/early-settlement-card'
import { DataGrid } from '@/components/uc/data-grid'
import type { GridRow } from '@/components/uc/grid-types'
import { BackLink, Badge, ButtonLink, Callout, PageHead, Pad, ProgressBar, SectionTitle } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'
import { db } from '@/lib/db'
import { loanContract } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'
import { latestLoanInfoRequests } from '@/lib/customer/info-request'
import { loadCustomer } from '@/lib/customer/load'
import { creditState, INSTALLMENT_LABEL, INSTALLMENT_TONE, solRef } from '@/lib/customer/view'
import { fdate, fmtPct, money } from '@/lib/uc/format'
import { documentPrintPath } from '@/lib/documents/customer-view'
import { getMyMerchantOrders } from '@/app/actions/merchant-order-customer'
import { PurchaseCard } from '@/components/merchant-orders/purchase-card'

export const metadata = { title: 'Crédito' }

const n = (v: unknown) => Number(v) || 0

export default async function CreditoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, loans, installments } = await loadCustomer()
  const l = loans.find((x) => x.id === id)
  if (!l) notFound()
  const infoRequest = l.status === 'pending' ? (await latestLoanInfoRequests(userId)).get(id) : null

  const [contract] = await db
    .select()
    .from(loanContract)
    .where(and(eq(loanContract.loanId, id), eq(loanContract.userId, userId)))
    .limit(1)
    .catch(() => [])
  const st = creditState(l.status, contract?.status === 'accepted')
  const purchases = l.merchantId ? await getMyMerchantOrders() : null
  const purchase = purchases?.orders.find((o) => o.loanId === id) ?? null
  const mine = installments.filter((i) => i.loanId === id)
  const paid = mine.filter((i) => i.status === 'paid').length
  const open = mine
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .sort((a, b) => new Date(a.dueDate as Date).getTime() - new Date(b.dueDate as Date).getTime())
  const next = open[0]
  const owed = open.reduce((s, i) => s + n(i.amount), 0)

  const rows: GridRow[] = mine.map((i) => ({
    id: i.id,
    nro: i.number,
    n: `${i.number}/${l.term}`,
    venc: new Date(i.dueDate as Date).toISOString(),
    importe: n(i.amount),
    estadoKey: i.status,
    estado: badge(INSTALLMENT_LABEL[i.status] ?? i.status, INSTALLMENT_TONE[i.status] ?? 'neutral'),
    pagada: i.paidAt ? new Date(i.paidAt as Date).toISOString() : null,
    acc: i.status === 'pending' || i.status === 'overdue' ? [{ kind: 'link' as const, label: 'Pagar', icon: 'wallet' as const, href: `/dashboard/pagos?pay=${i.id}` }] : [],
  }))

  return (
    <>
      <BackLink href="/dashboard/creditos">Mis créditos</BackLink>
      <PageHead
        title="Préstamo personal"
        description={`${solRef(l.id)} · pedido el ${fdate(l.createdAt as Date)}`}
        actions={
          <div className="uc-cta-row" style={{ gap: 8 }}>
            {next ? (
              <ButtonLink primary href={`/dashboard/pagos?pay=${next.id}`}>
                <Icon name="wallet" size="sm" />
                Pagar cuota {next.number}/{l.term}
              </ButtonLink>
            ) : null}
            {l.status === 'active' ? (
              <ButtonLink href={`/dashboard/pagos/pago-parcial?loan=${l.id}`}>
                <Icon name="wallet" size="sm" />
                Simular pago parcial
              </ButtonLink>
            ) : null}
            {contract ? (
              <a className="uc-btn" href={documentPrintPath('contrato', contract.id)} target="_blank" rel="noreferrer">
                <Icon name="download" size="sm" />
                Contrato
              </a>
            ) : null}
          </div>
        }
      />

      {infoRequest ? (
        <div style={{ marginBottom: 20 }}>
          <Callout icon="alert" title="Necesitamos un dato para seguir" tone="warning">
            {infoRequest}
          </Callout>
        </div>
      ) : null}
      {purchase && purchases ? (
        <div style={{ marginBottom: 20 }}>
          <PurchaseCard order={purchase} treasury={purchases.treasury} />
        </div>
      ) : null}
      {st.key === 'Firma pendiente' && !purchase ? (
        <div style={{ marginBottom: 20 }}>
          <Callout icon="pen" title="Falta firmar el contrato">
            Tu crédito fue aprobado. Firmá el contrato y el pagaré en <a href="/dashboard/documentos">Documentos</a> para que lo acreditemos en tu cuenta.
          </Callout>
        </div>
      ) : null}
      {l.status === 'rejected' && l.rejectionReason ? (
        <div style={{ marginBottom: 20 }}>
          <Callout icon="alert" title="Solicitud rechazada">{l.rejectionReason}</Callout>
        </div>
      ) : null}

      <Pad style={{ marginBottom: 20 }}>
        <div className="uc-detail-head">
          <div className="uc-kvs">
            <div><small>Estado</small><Badge tone={st.tone}>{st.key}</Badge></div>
            <div><small>Importe</small><b className="uc-num">{money(n(l.principal))}</b></div>
            <div><small>Cuota</small><b className="uc-num">{money(n(l.installmentAmount))}</b></div>
            <div><small>Cuotas pagadas</small><b className="uc-num">{paid}/{l.term}</b></div>
            <div><small>Saldo adeudado</small><b className="uc-num">{money(owed)}</b></div>
            <div><small>TNA / CFT</small><b className="uc-num">{fmtPct(n(l.tna))} / {l.cft ? fmtPct(n(l.cft)) : '—'}</b></div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <ProgressBar value={l.term ? (paid / l.term) * 100 : 0} label="Cuotas pagadas" />
        </div>
      </Pad>

      {l.status === 'active' ? (
        <div style={{ marginBottom: 20 }}>
          <EarlySettlementCard loanId={l.id} loanStatus={l.status} />
        </div>
      ) : null}

      <SectionTitle title="Cronograma de cuotas" aside="Importes con impuestos incluidos" />
      <DataGrid
        cfg={{
          id: `crono-${l.id}`,
          rows,
          sort: { key: 'nro', dir: 1 },
          searchKeys: ['n'],
          searchPlaceholder: 'Buscar cuota',
          empty: 'El cronograma se genera cuando se acredita el crédito.',
          chips: {
            label: 'Estado de la cuota',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'paid', l: 'Pagadas' },
              { v: 'pending', l: 'Pendientes', in: ['pending', 'partial', 'overdue'] },
            ],
          },
          columns: [
            { key: 'n', label: 'Cuota', kind: 'num', sortable: false },
            { key: 'venc', label: 'Vencimiento', kind: 'date' },
            { key: 'importe', label: 'Total cuota', kind: 'money', align: 'r', amount: true },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Pagada', 'Pendiente', 'Vencida'] },
            { key: 'pagada', label: 'Pagada el', kind: 'date' },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'cuotas', sumKey: 'importe', sumLabel: 'en total' },
        }}
      />
    </>
  )
}
