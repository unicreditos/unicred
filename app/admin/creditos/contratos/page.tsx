import { desc, eq } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { db } from '@/lib/db'
import { loan, loanContract, user } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Contratos' }

const STATE: Record<string, [string, 'success' | 'warning' | 'danger' | 'neutral']> = {
  accepted: ['Firmado', 'success'],
  pending_acceptance: ['Pendiente de firma', 'warning'],
  generated: ['Pendiente de firma', 'warning'],
  rejected: ['Rechazado', 'danger'],
}
const METHOD: Record<string, string> = { clickwrap: 'Aceptación electrónica', firma_digital: 'Firma digital' }

export default async function ContratosPage() {
  const { perms, userId } = await loadDeskChrome()
  const head = <PageHead title="Contratos" description="Contratos de mutuo y pagarés: emisión y firma electrónica." />
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="los contratos" /></>
  await auditAdminView(userId, 'contratos')

  // Pantalla independiente: consulta solo los contratos, no arma el resto del backoffice.
  const found = await db
    .select({
      id: loanContract.id,
      loanId: loanContract.loanId,
      status: loanContract.status,
      signatureType: loanContract.signatureType,
      createdAt: loanContract.createdAt,
      acceptedAt: loanContract.acceptedAt,
      signerName: loanContract.signerName,
      principal: loan.principal,
      term: loan.term,
      name: user.name,
      email: user.email,
    })
    .from(loanContract)
    .leftJoin(loan, eq(loan.id, loanContract.loanId))
    .leftJoin(user, eq(user.id, loanContract.userId))
    .orderBy(desc(loanContract.createdAt))
    .limit(300)
    .catch(() => [])

  const rows: GridRow[] = found.map((c) => {
    const [label, tone] = STATE[c.status] ?? [c.status, 'neutral' as const]
    return {
      id: c.id,
      nro: `…${c.id.slice(-8)}`,
      sol: `…${c.loanId.slice(-8)}`,
      cliente: { a: c.signerName || c.name || 'Cliente', b: c.email || undefined },
      q: `${c.name ?? ''} ${c.email ?? ''} ${c.signerName ?? ''}`,
      importe: Number(c.principal) || 0,
      cuotas: c.term,
      estadoKey: label,
      estado: badge(label, tone),
      metodo: c.acceptedAt ? (METHOD[c.signatureType ?? ''] ?? 'Aceptación electrónica') : null,
      emitido: c.createdAt ? new Date(c.createdAt).toISOString() : null,
      firmado: c.acceptedAt ? new Date(c.acceptedAt).toISOString() : null,
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'contratos',
          rows,
          pageSize: 15,
          sort: { key: 'emitido', dir: -1 },
          dateKey: 'emitido',
          dateLabel: 'Emisión',
          searchKeys: ['nro', 'sol', 'q'],
          searchPlaceholder: 'Cliente, contrato o solicitud',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Pendiente de firma', l: 'Por firmar' },
              { v: 'Firmado', l: 'Firmados' },
              { v: 'Rechazado', l: 'Rechazados' },
            ],
          },
          columns: [
            { key: 'nro', label: 'N° de contrato', kind: 'num' },
            { key: 'sol', label: 'N° de solicitud', kind: 'num' },
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'importe', label: 'Importe', kind: 'money', align: 'r', amount: true },
            { key: 'cuotas', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Pendiente de firma', 'Firmado', 'Rechazado'] },
            { key: 'metodo', label: 'Método' },
            { key: 'emitido', label: 'Emitido', kind: 'date' },
            { key: 'firmado', label: 'Firmado', kind: 'date' },
          ],
          summary: { noun: 'contratos' },
        }}
      />
    </>
  )
}
