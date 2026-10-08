import { desc, eq } from 'drizzle-orm'
import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { auditAdminView, loadDeskChrome } from '@/lib/admin-desk/load'
import { db } from '@/lib/db'
import { bankAccount, user } from '@/lib/db/schema'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Cuentas CBU' }

export default async function CbuPage() {
  const { perms, userId } = await loadDeskChrome()
  const head = (
    <PageHead title="Cuentas CBU" description="Cuentas de destino para desembolsos. La titularidad se valida contra el CUIL del cliente." />
  )
  if (!perms.has('clients.read')) return <>{head}<NoAccess what="las cuentas de los clientes" /></>
  await auditAdminView(userId, 'cuentas_bancarias')

  // Pantalla independiente: lee solo las cuentas, no el resto del backoffice.
  const found = await db
    .select({
      id: bankAccount.id,
      bankName: bankAccount.bankName,
      type: bankAccount.accountType,
      cbu: bankAccount.cbu,
      cvu: bankAccount.cvu,
      alias: bankAccount.alias,
      holderName: bankAccount.holderName,
      isVerified: bankAccount.isVerified,
      isPrimary: bankAccount.isPrimary,
      networkBlocked: bankAccount.networkBlocked,
      createdAt: bankAccount.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(bankAccount)
    .leftJoin(user, eq(user.id, bankAccount.userId))
    .where(eq(bankAccount.isActive, true))
    .orderBy(desc(bankAccount.createdAt))
    .limit(400)
    .catch(() => [])

  const rows: GridRow[] = found.map((a) => {
    const number = a.cbu || a.cvu || ''
    const kind = a.cvu ? 'CVU' : a.cbu ? 'CBU' : (a.type || 'cbu').toUpperCase()
    const state = a.networkBlocked ? 'Bloqueada' : a.isVerified ? 'Validada' : 'Pendiente'
    return {
      id: a.id,
      cliente: { a: a.name || a.holderName, b: a.email || undefined },
      q: `${a.name ?? ''} ${a.holderName} ${a.email ?? ''} ${a.alias ?? ''} ${a.bankName}`,
      banco: a.bankName,
      tipo: kind,
      cuenta: number ? `···· ${number.slice(-4)}` : '—',
      alias: a.alias || '',
      titular: a.holderName,
      titKey: state,
      tit: state === 'Validada' ? badge('Validada', 'success') : state === 'Bloqueada' ? badge('Bloqueada', 'danger') : badge('Pendiente', 'neutral'),
      principal: a.isPrimary ? 'Sí' : 'No',
      alta: a.createdAt ? new Date(a.createdAt).toISOString() : null,
    }
  })

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'cbu',
          rows,
          pageSize: 15,
          sort: { key: 'alta', dir: -1 },
          dateKey: 'alta',
          dateLabel: 'Alta',
          searchKeys: ['q'],
          searchPlaceholder: 'Cliente, banco, titular o alias',
          chips: {
            label: 'Titularidad',
            key: 'titKey',
            options: [
              { v: 'all', l: 'Todas' },
              { v: 'Validada', l: 'Validadas' },
              { v: 'Pendiente', l: 'Pendientes' },
              { v: 'Bloqueada', l: 'Bloqueadas' },
            ],
          },
          selects: [{ key: 'tipo', label: 'Tipo de cuenta', all: 'Tipo: todos' }],
          columns: [
            { key: 'cliente', label: 'Cliente', kind: 'stack' },
            { key: 'banco', label: 'Banco / billetera' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'cuenta', label: 'CBU / CVU', kind: 'num' },
            { key: 'alias', label: 'Alias', muted: true },
            { key: 'titular', label: 'Titular' },
            { key: 'principal', label: 'Principal', align: 'c' },
            { key: 'tit', label: 'Titularidad', kind: 'badge', order: ['Pendiente', 'Validada', 'Bloqueada'] },
            { key: 'alta', label: 'Alta', kind: 'date' },
          ],
          summary: { noun: 'cuentas' },
        }}
      />
    </>
  )
}
