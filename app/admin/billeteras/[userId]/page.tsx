import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText, Landmark } from 'lucide-react'
import { PageTitle } from '@/components/wallet/page-width'
import { WalletActions } from '@/components/admin/wallet-actions'
import { PayoutStatusBadge } from '@/components/wallet/payout-status'
import { MovementList } from '@/components/wallet/movement-list'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/wallet/copy-button'
import { formatCbu, formatDateTime } from '@/lib/format'
import { getAdminPermissions, requirePagePermission } from '@/lib/rbac'
import { centsOf, formatMoney, fromCents } from '@/lib/wallet/ledger'
import { getWalletForAdmin } from '@/lib/wallet/queries'

export const metadata: Metadata = { title: 'Billetera' }

export default async function AdminWalletDetail({ params }: { params: Promise<{ userId: string }> }) {
  const adminId = await requirePagePermission('finance.read')
  const perms = await getAdminPermissions(adminId)
  const { userId } = await params
  const d = await getWalletForAdmin(userId)
  if (!d) notFound()
  const { wallet } = d
  const heldCents = d.payouts.filter((p) => p.status === 'queued').reduce((acc, p) => acc + centsOf(p.amount), 0)

  return (
    <>
      <Link href="/admin/billeteras" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-3 mb-3' })}>
        <ArrowLeft />
        Billeteras
      </Link>
      <PageTitle
        eyebrow="Billetera"
        title={d.name}
        description={d.email}
        actions={
          <>
            <Link href={`/dashboard/billetera/resumen?usuario=${userId}`} className={buttonVariants({ variant: 'outline' })}>
              <FileText />
              Resumen de cuenta
            </Link>
            <Link href={`/admin/usuarios/${userId}`} className={buttonVariants({ variant: 'outline' })}>
              Ficha completa
            </Link>
          </>
        }
      />

      {wallet && d.consistent === false ? (
        <Alert variant="warning" className="mb-5">
          El saldo guardado no coincide con la suma de los movimientos de esta billetera. Revisá el historial antes de operar: puede
          tratarse de movimientos anteriores al libro actual.
        </Alert>
      ) : null}

      {wallet ? (
        <Card className="mb-6 overflow-hidden">
          <div className="grid gap-px bg-border sm:grid-cols-[1.2fr_1fr]">
            <div className="bg-card p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Saldo disponible</p>
                <Badge variant={wallet.status === 'active' ? 'success' : 'warning'}>{wallet.status === 'active' ? 'Activa' : 'Bloqueada'}</Badge>
                {d.kycStatus !== 'approved' ? <Badge variant="reviewing">Identidad sin verificar</Badge> : null}
              </div>
              <p className="tnum mt-1.5 text-4xl font-semibold tracking-tight">{formatMoney(wallet.balance)}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {heldCents > 0 ? (
                  <>
                    <span className="tnum font-medium text-foreground">{formatMoney(fromCents(heldCents))}</span> retenidos en retiros pendientes de aprobación.
                  </>
                ) : (
                  'Sin retiros pendientes de aprobación.'
                )}
              </p>
            </div>
            <dl className="grid content-center gap-3 bg-card p-5 text-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Titular</dt>
                <dd className="min-w-0 truncate font-medium">{wallet.holderName ?? d.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Alias</dt>
                <dd className="tnum flex min-w-0 items-center gap-1 font-medium">
                  <span className="truncate">{wallet.alias}</span>
                  <CopyButton value={wallet.alias} label="el alias" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">CVU</dt>
                <dd className="tnum flex min-w-0 items-center gap-1 text-[13px] font-medium">
                  <span className="truncate">{formatCbu(wallet.cvu)}</span>
                  <CopyButton value={wallet.cvu} label="el CVU" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Creada</dt>
                <dd className="font-medium">{formatDateTime(wallet.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-start">
        <aside className="order-first flex flex-col gap-5 lg:sticky lg:top-20 lg:order-last" aria-label="Acciones sobre la billetera">
          <WalletActions
            userId={userId}
            holderName={wallet?.holderName ?? d.name}
            hasWallet={Boolean(wallet)}
            status={wallet?.status ?? null}
            balance={wallet?.balance ?? '0'}
            canMoney={perms.has('disbursements.credit')}
            canManage={perms.has('clients.write')}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-4 sm:px-6">
              <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-base font-semibold">Retiros</h2>
            </div>
            {d.payouts.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Sin retiros.</p>
            ) : (
              <ul className="divide-y">
                {d.payouts.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="tnum text-sm font-semibold">{formatMoney(p.amount)}</p>
                      <p className="break-words text-[13px] text-muted-foreground">
                        {p.reference} · {formatDateTime(p.createdAt)} · …{p.destinationValue.slice(-4)}
                      </p>
                    </div>
                    <PayoutStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <h2 className="border-b px-5 py-4 text-base font-semibold sm:px-6">Últimos movimientos</h2>
            <MovementList rows={d.recent} empty="Sin movimientos." />
          </Card>
        </div>
      </div>
    </>
  )
}
