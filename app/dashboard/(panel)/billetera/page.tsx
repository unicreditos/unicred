import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, FileText } from 'lucide-react'
import { PageWidth } from '@/components/wallet/page-width'
import { AccountCard } from '@/components/dashboard/account-card'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { SectionCard } from '@/components/ui/section-card'
import { CancelPayoutButton } from '@/components/wallet/cancel-payout-button'
import { ActivityFeed } from '@/components/wallet/activity-feed'
import { PayoutStatusBadge } from '@/components/wallet/payout-status'
import { formatDateTime } from '@/lib/format'
import { getKycOverview } from '@/lib/kyc'
import { formatMoney } from '@/lib/money'
import { requireCustomerId } from '@/lib/session'
import { cashflowByMonth } from '@/lib/wallet/analytics'
import { getWalletOverview } from '@/lib/wallet/queries'

export const metadata: Metadata = { title: 'Mi billetera' }

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default async function WalletPage() {
  const userId = await requireCustomerId()
  const [{ wallet, recent, payouts, held }, kyc] = await Promise.all([getWalletOverview(userId), getKycOverview(userId)])
  const month = (await cashflowByMonth(wallet.id, 1))[0]
  const verified = kyc.status === 'approved'
  const pendingPayouts = payouts.filter((p) => p.status === 'queued')
  const monthName = MONTH_NAMES[Number(month.key.slice(5, 7)) - 1]

  return (
    <PageWidth width="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight sm:text-[1.75rem]">Mi billetera</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Tu saldo en pesos: recibí, transferí, cobrá con QR y retirá a tus cuentas.</p>
      </div>

      {wallet.status !== 'active' ? (
        <Alert variant="destructive" className="mb-5">
          Tu billetera está bloqueada. No podés enviar ni recibir dinero hasta que soporte la reactive.
        </Alert>
      ) : null}
      {!verified ? (
        <Alert variant="warning" className="mb-5">
          Podés recibir dinero, pero para enviarlo o retirarlo necesitás verificar tu identidad.{' '}
          <Link href="/dashboard/perfil/identidad" className="font-semibold underline">
            Verificarme ahora
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AccountCard balance={wallet.balance} held={held} alias={wallet.alias} cvu={wallet.cvu} holder={wallet.holderName ?? null} active={wallet.status === 'active'} canOperate={verified} />
        </div>

        <SectionCard className="lg:col-span-4" title={`Resumen de ${monthName}`} description="Dinero acreditado en lo que va del mes.">
          <dl className="divide-y">
            <div className="flex items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-success/12 text-success" aria-hidden="true">
                <ArrowDownLeft className="size-4" />
              </span>
              <dt className="flex-1 text-sm text-muted-foreground">Ingresos</dt>
              <dd className="tnum text-sm font-semibold text-success">+ {formatMoney(month.income)}</dd>
            </div>
            <div className="flex items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground/70" aria-hidden="true">
                <ArrowUpRight className="size-4" />
              </span>
              <dt className="flex-1 text-sm text-muted-foreground">Egresos</dt>
              <dd className="tnum text-sm font-semibold">− {formatMoney(month.expense)}</dd>
            </div>
          </dl>
          <Link href="/dashboard/billetera/resumen" className={`${buttonVariants({ variant: 'outline', size: 'sm' })} mt-2 w-full`}>
            <FileText aria-hidden="true" />
            Resumen de cuenta (PDF)
          </Link>
        </SectionCard>

        <SectionCard className="lg:col-span-8" title="Actividad" href="/dashboard/billetera/movimientos" hrefLabel="Ver todo">
          <ActivityFeed rows={recent} />
        </SectionCard>

        <SectionCard className="lg:col-span-4" title="Retiros pendientes" description="Un administrador revisa y envía cada retiro.">
          {pendingPayouts.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tenés retiros esperando aprobación.</p>
          ) : (
            <ul className="divide-y">
              {pendingPayouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="tnum text-sm font-semibold">{formatMoney(p.amount)}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {formatDateTime(p.createdAt)} · …{p.destinationValue.slice(-4)}
                    </p>
                  </div>
                  <PayoutStatusBadge status={p.status} />
                  <CancelPayoutButton payoutId={p.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-muted-foreground">Si lo rechaza o lo cancelás, el dinero vuelve a tu billetera.</p>
        </SectionCard>
      </div>
    </PageWidth>
  )
}
