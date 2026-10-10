import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getMyBankAccounts } from '@/app/actions/banking'
import { InAppDocumentPanel } from '@/components/dashboard/in-app-document-panel'
import { AcceptContractBar, GenerateBcraButton, GenerateContractButton } from '@/components/dashboard/document-actions'
import { DataGrid } from '@/components/uc/data-grid'
import type { GridRow, RowAction } from '@/components/uc/grid-types'
import { BackLink, Callout, Card, PageHead, Pad, CardHead } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'
import { db } from '@/lib/db'
import { bcraReport, disbursement, paymentReceipt } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'
import { loadCustomer, loadCustomerContracts } from '@/lib/customer/load'
import { solRef } from '@/lib/customer/view'
import { documentKindTitle, documentPrintPath, isCustomerDocKind, type CustomerDocKind } from '@/lib/documents/customer-view'
import { money } from '@/lib/uc/format'

export const metadata = { title: 'Documentos' }

const TYPE_TONE = { Contrato: 'info', Pagaré: 'neutral', Cuponera: 'neutral', Recibo: 'success', 'Libre deuda': 'success', Otros: 'neutral' } as const
type DocType = keyof typeof TYPE_TONE

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<{ doc?: string; docId?: string }> }) {
  const sp = await searchParams
  const { userId, loans } = await loadCustomer()
  const activeKind = isCustomerDocKind(sp.doc ?? null) ? (sp.doc as CustomerDocKind) : null
  const activeId = sp.docId?.trim() || null

  const [contracts, reports, receipts, disbursements, accounts] = await Promise.all([
    loadCustomerContracts(userId),
    db
      .select({ id: bcraReport.id, reportNumber: bcraReport.reportNumber, createdAt: bcraReport.createdAt })
      .from(bcraReport)
      .where(eq(bcraReport.userId, userId))
      .orderBy(desc(bcraReport.createdAt))
      .limit(20)
      .catch(() => []),
    db
      .select({
        id: paymentReceipt.id,
        receiptNumber: paymentReceipt.receiptNumber,
        amount: paymentReceipt.amount,
        loanId: paymentReceipt.loanId,
        paidAt: paymentReceipt.paidAt,
        createdAt: paymentReceipt.createdAt,
      })
      .from(paymentReceipt)
      .where(eq(paymentReceipt.userId, userId))
      .orderBy(desc(paymentReceipt.createdAt))
      .limit(60)
      .catch(() => []),
    db
      .select({
        id: disbursement.id,
        amount: disbursement.amount,
        status: disbursement.status,
        loanId: disbursement.loanId,
        creditedAt: disbursement.creditedAt,
        createdAt: disbursement.createdAt,
      })
      .from(disbursement)
      .where(eq(disbursement.userId, userId))
      .orderBy(desc(disbursement.createdAt))
      .limit(20)
      .catch(() => []),
    getMyBankAccounts().catch(() => []),
  ])

  /* ---- Visor de un documento ---- */
  if (activeKind && activeId) {
    const pendingContract =
      activeKind === 'contrato' || activeKind === 'pagare'
        ? contracts.find((c) => c.id === activeId && c.status !== 'accepted' && c.status !== 'rejected')
        : undefined
    return (
      <>
        <BackLink href="/dashboard/documentos">Documentos</BackLink>
        <PageHead
          title={documentKindTitle(activeKind)}
          actions={
            <a className="uc-btn" href={documentPrintPath(activeKind, activeId)} target="_blank" rel="noreferrer">
              <Icon name="download" size="sm" />
              Abrir para imprimir
            </a>
          }
        />
        <div style={{ display: 'grid', gap: 20 }}>
          {pendingContract ? (
            accounts.length === 0 ? (
              <Callout icon="alert" title="Falta tu cuenta para recibir el dinero" tone="warning">
                Para firmar necesitás una cuenta a tu nombre. <Link href="/dashboard/perfil">Cargala en Perfil</Link>.
              </Callout>
            ) : (
              <AcceptContractBar contractId={pendingContract.id} />
            )
          ) : null}
          <Card style={{ background: '#fff', color: '#111', padding: 24, overflow: 'auto' }}>
            <InAppDocumentPanel kind={activeKind} id={activeId} />
          </Card>
        </div>
      </>
    )
  }

  /* ---- Índice ---- */
  const loanOf = new Map(loans.map((l) => [l.id, l]))
  const rows: GridRow[] = []
  const view = (kind: CustomerDocKind, id: string, label = 'Ver'): RowAction[] => [
    { kind: 'link', label, icon: label === 'Firmar' ? 'pen' : 'file', href: `/dashboard/documentos?doc=${kind}&docId=${encodeURIComponent(id)}` },
  ]
  const push = (id: string, nombre: string, tipo: DocType, credito: string, fecha: Date | string | null, acc: RowAction[]) =>
    rows.push({
      id,
      nombre,
      tipo: badge(tipo, TYPE_TONE[tipo]),
      tipoKey: tipo,
      credito,
      fecha: fecha ? new Date(fecha).toISOString() : null,
      acc,
    })

  for (const c of contracts) {
    const loan = loanOf.get(c.loanId)
    const ref = solRef(c.loanId)
    const pending = c.status !== 'accepted' && c.status !== 'rejected'
    push(`contrato-${c.id}`, `Contrato de mutuo ${ref}${pending ? ' (para firmar)' : ''}`, 'Contrato', ref, c.createdAt as Date, view('contrato', c.id, pending ? 'Firmar' : 'Ver'))
    push(`pagare-${c.id}`, `Pagaré ${ref}`, 'Pagaré', ref, c.createdAt as Date, view('pagare', c.id))
    push(`cuponera-${c.id}`, `Cuponera de pagos ${ref}`, 'Cuponera', ref, c.createdAt as Date, view('talonario', c.loanId))
    if (loan?.status === 'paid') push(`libre-${c.id}`, `Constancia de libre deuda ${ref}`, 'Libre deuda', ref, loan.updatedAt as Date, view('libre-deuda', c.loanId))
  }
  for (const r of receipts) {
    push(`recibo-${r.id}`, `Recibo ${r.receiptNumber} · ${money(Number(r.amount))}`, 'Recibo', r.loanId ? solRef(r.loanId) : '—', (r.paidAt ?? r.createdAt) as Date, view('recibo', r.id))
  }
  for (const d of disbursements.filter((x) => x.status === 'credited')) {
    push(`liq-${d.id}`, `Liquidación del crédito · ${money(Number(d.amount))}`, 'Otros', solRef(d.loanId), (d.creditedAt ?? d.createdAt) as Date, view('liquidacion', d.id))
  }
  for (const r of reports) {
    push(`bcra-${r.id}`, `Informe de situación BCRA ${r.reportNumber}`, 'Otros', '—', r.createdAt as Date, view('bcra', r.id))
  }

  const toGenerate = loans.filter((l) => l.status === 'approved' && !contracts.some((c) => c.loanId === l.id))

  return (
    <>
      <PageHead
        title="Documentos"
        description="Todos tus contratos, pagarés, cuponeras, recibos y certificados en un solo lugar."
        actions={<GenerateBcraButton />}
      />
      {toGenerate.length > 0 ? (
        <Pad style={{ marginBottom: 20, borderLeft: '4px solid var(--uc-accent)' }}>
          <CardHead title="Tenés un crédito aprobado para firmar" aside={undefined} />
          <p className="uc-muted" style={{ margin: '0 0 14px' }}>Generá el contrato para revisarlo y firmarlo.</p>
          <div className="uc-cta-row">
            {toGenerate.map((l) => (
              <GenerateContractButton key={l.id} loanId={l.id} />
            ))}
          </div>
        </Pad>
      ) : null}
      <DataGrid
        cfg={{
          id: 'misdocs',
          rows,
          pageSize: 12,
          sort: { key: 'fecha', dir: -1 },
          dateKey: 'fecha',
          dateLabel: 'Fecha',
          searchKeys: ['nombre', 'credito'],
          searchPlaceholder: 'Buscar documento',
          empty: 'Todavía no hay documentos. Cuando se apruebe tu crédito vas a encontrar acá el contrato, el pagaré y los comprobantes.',
          chips: {
            label: 'Tipo de documento',
            key: 'tipoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Contrato', l: 'Contratos' },
              { v: 'Pagaré', l: 'Pagarés' },
              { v: 'Cuponera', l: 'Cuponeras' },
              { v: 'Recibo', l: 'Recibos' },
              { v: 'Libre deuda', l: 'Libre deuda' },
              { v: 'Otros', l: 'Otros' },
            ],
          },
          selects: [{ key: 'credito', label: 'Crédito', all: 'Crédito: todos' }],
          columns: [
            { key: 'nombre', label: 'Documento' },
            { key: 'tipo', label: 'Tipo', kind: 'badge' },
            { key: 'credito', label: 'Crédito', kind: 'num' },
            { key: 'fecha', label: 'Fecha', kind: 'date' },
            { key: 'acc', label: 'Acción', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'documentos' },
        }}
      />
    </>
  )
}
