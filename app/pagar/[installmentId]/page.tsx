import { CouponPayDesk } from '@/components/payments/coupon-pay-desk'
import { PublicHeader, PublicFooter } from '@/components/unicred/public-chrome'
import { getCouponInstallment } from '@/app/actions/payments'
import { getAccountHref } from '@/lib/session'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PublicPagarPage({
  params,
  searchParams,
}: {
  params: Promise<{ installmentId: string }>
  searchParams: Promise<{ mp_status?: string }>
}) {
  const installmentId = String((await params).installmentId ?? '').trim()
  const mpStatus = String((await searchParams).mp_status ?? '').trim()
  const data = await getCouponInstallment(installmentId)
  const { isLoggedIn, accountHref } = await getAccountHref()

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader isLoggedIn={isLoggedIn} accountHref={accountHref} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cuponera UNICRÉDITOS</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-navy-900">Pagar cuota</h1>
        <p className="mt-1 text-sm text-slate-600">
          Checkout real de Mercado Pago (web o app), Pago Fácil, Rapipago o transferencia a la cuenta de RM
          International Group S.A.S.
        </p>
        <div className="mt-6">
          {!data ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="font-semibold">No encontramos esta cuota</p>
              <p className="mt-1 text-sm text-muted-foreground">El talón no existe o el vínculo está incompleto.</p>
              <Button asChild className="mt-4">
                <Link href={isLoggedIn ? '/dashboard?tab=pagos' : '/sign-in'}>Ir al panel</Link>
              </Button>
            </div>
          ) : (
            <CouponPayDesk installment={data} mpStatus={mpStatus} />
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
