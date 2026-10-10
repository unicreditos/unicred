import { desc, eq } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { db } from '@/lib/db'
import { loan, loanContract } from '@/lib/db/schema'
import { AUTO_APPROVED_LABEL, LOAN_LIST_STATUS, MANUAL_LABEL, loanOriginLabel, loanStatusBadge } from '@/lib/loan-list'
import { badge, clientCell, clientIndex, clientSearch, kycBadge } from '@/lib/uc/admin'

export const metadata = { title: 'Todos los cr\u00e9ditos' }
export const dynamic = 'force-dynamic'

export default async function TodosLosCreditosPage() {
  const { state, perms } = await loadDesk()
  const head = (
    <PageHead
      title="Todos los cr\u00e9ditos"
      description="Todas las solicitudes y cr\u00e9ditos, en cualquier estado. Marca cu\u00e1les se aprobaron autom\u00e1ticamente por puntaje."
    />
  )
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="los cr\u00e9ditos" /></>

  // createdAt se guarda como "timestamp sin zona" en UTC: se lo interpreta como UTC y la grilla lo muestra en hora argentina.
  const loans = await db
    .select({
      id: loan.id,
      userId: loan.userId,
      status: loan.status,
      principal: loan.principal,
      term: loan.term,
      merchantId: loan.merchantId,
      createdAt: loan.createdAt,
      generatedBy: loanContract.generatedBy,
    })
    .from(loan)
    .leftJoin(loanContract, eq(loanContract.loanId, loan.id))
    .orderBy(desc(loan.createdAt))

  const idx = clientIndex(state)
  const rows: GridRow[] = loans.map((l) => {
    const auto = loanOriginLabel(l.generatedBy) === AUTO_APPROVED_LABEL
    return {
      id: l.id,
      sol: `\u2026${l.id.slice(-8)}`,
      cliente: clientCell(idx, l.userId),
      q: clientSearch(idx, l.userId),
      importe: Number(l.principal),
      cuotas: l.term,
      canal: l.merchantId ? 'Comercio' : 'Directo',
      origen: auto ? badge(AUTO_APPROVED_LABEL, 'warning') : badge(MANUAL_LABEL, 'neutral'),
      kyc: kycBadge(idx.get(l.userId)?.kycStatus ?? 'pending'),
      estadoKey: l.status,
      estado: loanStatusBadge(l.status),
      ingreso: new Date(l.createdAt).toISOString(),
      ver: [{ kind: 'link' as const, label: 'Ver', href: `/admin/originacion/solicitudes/${encodeURIComponent(l.id)}` }],
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'todos-los-creditos',
          rows,
          pageSize: 20,
          sort: { key: 'ingreso', dir: -1 },
          dateKey: 'ingreso',
          dateLabel: 'Ingreso',
          amountKey: 'importe',
          amountLabel: 'Importe',
          exportName: 'creditos',
          searchKeys: ['sol', 'q'],
          searchPlaceholder: 'Cliente, DNI o N\u00ba de solicitud',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              ...Object.entries(LOAN_LIST_STATUS).map(([v, s]) => ({ v, l: s.label })),
            ],
          },
          selects: [
            { key: 'origen', label: 'Origen de la aprobaci\u00f3n', all: 'Origen: todos' },
            { key: 'canal', label: 'Canal', all: 'Canal: todos' },
          ],
          columns: [
            { key: 'sol', label: 'N\u00ba de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'canal', label: 'Canal' },
            { key: 'origen', label: 'Aprobaci\u00f3n', kind: 'badge' },
            { key: 'kyc', label: 'Identidad (KYC)', kind: 'badge' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: Object.values(LOAN_LIST_STATUS).map((s) => s.label) },
            { key: 'ingreso', label: 'Ingreso', kind: 'datetime' },
            { key: 'ver', label: 'Acci\u00f3n', kind: 'actions', align: 'r' },
          ],
          summary: { noun: 'cr\u00e9ditos', sumKey: 'importe', sumLabel: 'en total' },
        }}
      />
    </>
  )
}