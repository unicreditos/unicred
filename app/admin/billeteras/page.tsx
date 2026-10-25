import type { Metadata } from 'next'
import Link from 'next/link'
import { PageTitle } from '@/components/wallet/page-width'
import { CreateWalletsButton } from '@/components/admin/create-wallets-button'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/format'
import { getAdminPermissions, requirePagePermission } from '@/lib/rbac'
import { formatMoney } from '@/lib/wallet/ledger'
import { listWalletsForAdmin } from '@/lib/wallet/queries'
import { Pagination } from '@/components/ui/pagination'
import { parsePage } from '@/lib/page-param'

export const metadata: Metadata = { title: 'Billeteras' }

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function AdminWalletsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const adminId = await requirePagePermission('finance.read')
  const perms = await getAdminPermissions(adminId)
  const params = await searchParams
  const q = one(params.q) ?? ''
  const status = one(params.estado) ?? ''
  const page = parsePage(params.page)
  const data = await listWalletsForAdmin({ q, status, page })
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const href = (over: Record<string, string | number>) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, estado: status, page, ...over })) if (v !== '' && v !== 0) sp.set(k, String(v))
    return `/admin/billeteras${sp.toString() ? `?${sp}` : ''}`
  }

  return (
    <>
      <PageTitle
        eyebrow="Tesorería"
        title="Billeteras"
        description="Una billetera por persona. Desde acá ves los saldos, los movimientos y operás cada cuenta."
        actions={perms.has('clients.write') ? <CreateWalletsButton missing={data.withoutWallet} /> : undefined}
      />

      <dl className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { l: 'Saldo total en billeteras', v: formatMoney(data.balanceTotal) },
          { l: 'Billeteras', v: String(data.total) },
          { l: 'Retiros por aprobar', v: `${data.pendingPayoutsCount} · ${formatMoney(data.pendingPayoutsTotal)}`, href: '/admin/retiros' },
          { l: 'Bloqueadas / sin billetera', v: `${data.blocked} / ${data.withoutWallet}` },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <dt className="text-[13px] text-muted-foreground">{s.l}</dt>
            <dd className="tnum mt-1 text-lg font-semibold">
              {s.href ? (
                <Link href={s.href} className="hover:underline">
                  {s.v}
                </Link>
              ) : (
                s.v
              )}
            </dd>
          </Card>
        ))}
      </dl>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {[['', 'Todas'], ['active', 'Activas'], ['blocked', 'Bloqueadas']].map(([v, l]) => (
            <Link key={v || 'all'} href={href({ estado: v, page: 1 })} className={buttonVariants({ variant: status === v ? 'default' : 'outline', size: 'sm' })}>
              {l}
            </Link>
          ))}
        </div>
        <form action="/admin/billeteras" className="flex w-full gap-2 sm:w-auto">
          {status ? <input type="hidden" name="estado" value={status} /> : null}
          <label htmlFor="q" className="sr-only">Buscar por correo, nombre, alias, CVU o DNI</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Correo, nombre, alias, CVU o DNI" className="h-9 min-w-0 flex-1 sm:w-72 sm:flex-none" />
          <button type="submit" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Buscar</button>
        </form>
      </div>

      <Card className="overflow-x-auto">
        <table className="data-table min-w-[46rem]">
          <caption className="sr-only">Billeteras</caption>
          <thead>
            <tr>
              <th scope="col" >Titular</th>
              <th scope="col" >Alias</th>
              <th scope="col" className="num">Saldo</th>
              <th scope="col" >Estado</th>
              <th scope="col" >Actualizada</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground">No hay billeteras con esos filtros.</td></tr>
            ) : (
              data.rows.map(({ wallet, name, email, kycStatus }) => (
                <tr key={wallet.id} className="hover:bg-muted/50">
                  <td >
                    <Link href={`/admin/billeteras/${wallet.userId}`} className="font-medium text-primary hover:underline">{name}</Link>
                    <div className="text-muted-foreground">{email}{kycStatus !== 'approved' ? ' · identidad sin verificar' : ''}</div>
                  </td>
                  <td className="tnum">{wallet.alias}</td>
                  <td className="tnum text-right font-semibold">{formatMoney(wallet.balance)}</td>
                  <td ><Badge variant={wallet.status === 'active' ? 'success' : 'destructive'}>{wallet.status === 'active' ? 'Activa' : 'Bloqueada'}</Badge></td>
                  <td className="text-muted-foreground">{formatDateTime(wallet.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} pages={pages} total={data.total} pageSize={data.pageSize} href={(p) => href({ page: p })} />
    </>
  )
}
