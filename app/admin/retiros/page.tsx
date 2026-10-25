import type { Metadata } from 'next'
import Link from 'next/link'
import { formatCuil } from '@/lib/personal-data'
import { PageTitle } from '@/components/wallet/page-width'
import { PayoutActions } from '@/components/admin/payout-actions'
import { PayoutStatusBadge } from '@/components/wallet/payout-status'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCbu, formatDateTime } from '@/lib/format'
import { getAdminPermissions, requirePagePermission } from '@/lib/rbac'
import { formatMoney } from '@/lib/wallet/ledger'
import { listPayoutsForAdmin } from '@/lib/wallet/payouts'

export const metadata: Metadata = { title: 'Retiros' }

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const adminId = await requirePagePermission('finance.read')
  const canResolve = (await getAdminPermissions(adminId)).has('disbursements.credit')
  const params = await searchParams
  const status = one(params.estado) ?? 'queued'
  const rows = await listPayoutsForAdmin({ status: status === 'all' ? undefined : status })

  return (
    <>
      <PageTitle
        eyebrow="Tesorería"
        title="Retiros"
        description="Cada retiro a una cuenta propia espera tu aprobación. Enviá la transferencia desde el banco y aprobá cargando la referencia, o rechazalo para devolver el dinero."
      />
      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
        {[['queued', 'Pendientes'], ['executed', 'Enviados'], ['cancelled', 'Rechazados / cancelados'], ['all', 'Todos']].map(([v, l]) => (
          <Link key={v} href={`/admin/retiros?estado=${v}`} className={buttonVariants({ variant: status === v ? 'default' : 'outline', size: 'sm' })}>
            {l}
          </Link>
        ))}
      </div>
      {!canResolve ? <Alert variant="info" className="mb-5">Tu rol puede ver los retiros pero no resolverlos.</Alert> : null}

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No hay retiros en este estado.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ payout: p, name, email }) => {
            const payload = (p.providerPayload as Record<string, string | boolean> | null) ?? {}
            const unverified = payload.accountVerified === false
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="tnum text-xl font-semibold">{formatMoney(p.amount)}</p>
                      <PayoutStatusBadge status={p.status} />
                    </div>
                    <p className="text-sm">
                      <Link href={`/admin/billeteras/${p.userId}`} className="font-medium text-primary hover:underline">{name}</Link>
                      <span className="text-muted-foreground"> · {email}</span>
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {p.reference} · pedido el {formatDateTime(p.createdAt)}
                    </p>
                    {unverified ? (
                      <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-[13px] font-medium text-warning">
                        Cuenta cargada a mano: antes de transferir, verificá que el titular sea el mismo que la persona (CUIL {formatCuil(String(payload.holderCuil ?? '')) || '—'}).
                      </p>
                    ) : null}
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                      <div><dt className="inline text-muted-foreground">Banco: </dt><dd className="inline font-medium">{String(payload.bankName ?? '—')}</dd></div>
                      <div><dt className="inline text-muted-foreground">Titular: </dt><dd className="inline font-medium">{String(payload.holderName ?? '—')}</dd></div>
                      <div className="sm:col-span-2"><dt className="inline text-muted-foreground">{p.destinationKind === 'alias' ? 'Alias' : p.destinationKind.toUpperCase()}: </dt><dd className="tnum inline font-medium">{p.destinationKind === 'alias' ? p.destinationValue : formatCbu(p.destinationValue)}</dd></div>
                      {payload.alias && p.destinationKind !== 'alias' ? <div><dt className="inline text-muted-foreground">Alias: </dt><dd className="inline font-medium">@{String(payload.alias)}</dd></div> : null}
                      {p.concept ? <div><dt className="inline text-muted-foreground">Concepto: </dt><dd className="inline font-medium">{p.concept}</dd></div> : null}
                      {payload.bankReference ? <div><dt className="inline text-muted-foreground">Referencia del banco: </dt><dd className="inline font-medium">{String(payload.bankReference)}</dd></div> : null}
                      {p.failureReason ? <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Motivo: </dt><dd className="inline font-medium">{p.failureReason}</dd></div> : null}
                    </dl>
                  </div>
                  {p.status === 'queued' && canResolve ? <PayoutActions payoutId={p.id} label={p.reference} /> : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
