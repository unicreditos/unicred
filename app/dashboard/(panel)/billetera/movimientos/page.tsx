import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, Search } from 'lucide-react'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { MovementList } from '@/components/wallet/movement-list'
import { requireCustomerId } from '@/lib/session'
import { ensureWallet } from '@/lib/wallet/ledger'
import { MOVEMENT_GROUPS, listMovementsFiltered, parseDay } from '@/lib/wallet/queries'
import { parsePage } from '@/lib/page-param'

export const metadata: Metadata = { title: 'Movimientos' }

const SELECT =
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm'

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const userId = await requireCustomerId()
  const params = await searchParams
  const page = parsePage(params.page)
  const group = MOVEMENT_GROUPS.some((g) => g.key === one(params.grupo)) ? one(params.grupo) : ''
  const dir = one(params.dir) === 'in' || one(params.dir) === 'out' ? (one(params.dir) as 'in' | 'out') : ''
  let desde = parseDay(one(params.desde)) ? one(params.desde) : ''
  let hasta = parseDay(one(params.hasta)) ? one(params.hasta) : ''
  // Si el rango viene al revés se da vuelta (las fechas AAAA-MM-DD se ordenan como texto).
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde]
  const q = one(params.q).slice(0, 80)
  const filtered = Boolean(group || dir || desde || hasta || q)

  const wallet = await ensureWallet(userId)
  const { rows, total, pageSize } = await listMovementsFiltered(wallet.id, page, {
    group: group || undefined,
    dir: dir || undefined,
    from: parseDay(desde),
    to: parseDay(hasta),
    q,
  })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const query = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ grupo: group, dir, desde, hasta, q, ...extra })) if (v) p.set(k, v)
    return p.toString()
  }
  const exportHref = `/dashboard/billetera/movimientos/export${query() ? `?${query()}` : ''}`

  return (
    <PageWidth width="max-w-5xl">
      <PageTitle
        title="Movimientos"
        description={`${total} movimiento${total === 1 ? '' : 's'}${filtered ? ' con estos filtros' : ' en tu billetera'}.`}
        actions={
          <a href={exportHref} download className={buttonVariants({ variant: 'outline' })}>
            <Download aria-hidden="true" /> {filtered ? 'Descargar CSV (con filtros)' : 'Descargar extracto (últimos 30 días)'}
          </a>
        }
      />

      <form action="/dashboard/billetera/movimientos" method="get" role="search" aria-label="Filtrar movimientos" className="mb-5 rounded-xl border bg-card p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <label className="flex flex-col gap-1.5 lg:col-span-3">
            <span className="text-[13px] font-medium">Tipo de operación</span>
            <select name="grupo" defaultValue={group} className={SELECT}>
              <option value="">Todas</option>
              {MOVEMENT_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[13px] font-medium">Dinero</span>
            <select name="dir" defaultValue={dir} className={SELECT}>
              <option value="">Entra y sale</option>
              <option value="in">Solo ingresos</option>
              <option value="out">Solo egresos</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[13px] font-medium">Desde</span>
            <Input type="date" name="desde" defaultValue={desde} />
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[13px] font-medium">Hasta</span>
            <Input type="date" name="hasta" defaultValue={hasta} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-[13px] font-medium">Buscar</span>
            <Input type="search" name="q" defaultValue={q} placeholder="Referencia o detalle" maxLength={80} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm">
            <Search aria-hidden="true" /> Aplicar filtros
          </Button>
          {filtered ? (
            <Link href="/dashboard/billetera/movimientos" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      <Card className="overflow-hidden">
        <MovementList rows={rows} empty={filtered ? 'No hay movimientos con esos filtros.' : 'Todavía no tenés movimientos.'} />
      </Card>
      <Pagination page={page} pages={pages} total={total} pageSize={pageSize} href={(p) => `/dashboard/billetera/movimientos?${query({ page: String(p) })}`} />
    </PageWidth>
  )
}
