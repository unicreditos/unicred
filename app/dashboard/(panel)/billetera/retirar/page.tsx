import type { Metadata } from 'next'
import Link from 'next/link'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { CancelPayoutButton } from '@/components/wallet/cancel-payout-button'
import { PayoutStatusBadge } from '@/components/wallet/payout-status'
import { WithdrawForm } from '@/components/wallet/withdraw-form'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import { getKycOverview } from '@/lib/kyc'
import { requireCustomerId } from '@/lib/session'
import { listOwnBankAccounts } from '@/lib/wallet/bank-accounts'
import { formatMoney } from '@/lib/wallet/ledger'
import { listPayoutsForUser } from '@/lib/wallet/payouts'
import { getWalletOverview } from '@/lib/wallet/queries'

export const metadata: Metadata = { title: 'Retirar' }

export default async function WithdrawPage() {
  const userId = await requireCustomerId()
  const [{ wallet }, accounts, payouts, kyc] = await Promise.all([
    getWalletOverview(userId),
    listOwnBankAccounts(userId),
    listPayoutsForUser(userId, 15),
    getKycOverview(userId),
  ])
  return (
    <PageWidth width="max-w-3xl">
      <PageTitle
        title="Retirar a mi cuenta"
        description="Pedí el retiro a una cuenta a tu nombre. Un administrador lo aprueba al enviar la transferencia."
        actions={
          <Link href="/dashboard/billetera/cuentas" className={buttonVariants({ variant: 'outline' })}>
            Mis cuentas
          </Link>
        }
      />
      <WithdrawForm
        accounts={accounts
          .filter((a) => (a.isVerified || a.verificationMethod === 'manual_declared') && !a.networkBlocked)
          .map((a) => ({ id: a.id, bankName: a.bankName, holderName: a.holderName, cbu: a.cbu, cvu: a.cvu, alias: a.alias, verified: a.isVerified }))}
        balance={wallet.balance}
        canSend={kyc.status === 'approved' && wallet.status === 'active'}
      />

      <section className="mt-10" aria-labelledby="historial">
        <h2 id="historial" className="mb-3 text-lg font-semibold">
          Tus retiros
        </h2>
        {payouts.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">Todavía no pediste ningún retiro.</Card>
        ) : (
          <Card className="divide-y overflow-hidden">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="tnum text-sm font-semibold">{formatMoney(p.amount)}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {p.reference} · {formatDateTime(p.createdAt)} · {p.destinationKind === 'alias' ? `@${p.destinationValue}` : `…${p.destinationValue.slice(-4)}`}
                    {p.status === 'cancelled' && p.failureReason ? ` · ${p.failureReason}` : ''}
                  </p>
                </div>
                <PayoutStatusBadge status={p.status} />
                {p.status === 'queued' ? <CancelPayoutButton payoutId={p.id} /> : null}
              </div>
            ))}
          </Card>
        )}
      </section>
    </PageWidth>
  )
}
