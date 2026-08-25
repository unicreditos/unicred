import { CouponPayDesk } from '@/components/payments/coupon-pay-desk'
import { getCouponInstallment } from '@/app/actions/payments'
import { getAccountHref } from '@/lib/session'
import { installmentPosPath } from '@/lib/workspace-gate'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
  const { isLoggedIn } = await getAccountHref()
  if (isLoggedIn) {
    redirect(installmentPosPath(installmentId))
  }
  const data = await getCouponInstallment(installmentId)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo showText />
          <Button asChild variant="outline" size="sm">
            <Link href={`/sign-in?next=${encodeURIComponent(installmentPosPath(installmentId))}`}>Ingresar</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cuponera UNICRÉDITOS</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-navy-900">Pagar cuota</h1>
        <p className="mt-1 text-sm text-slate-600">
          Desde el talón podés pagar en Pago Fácil, Rapipago o transferir. Para crédito o débito ingresá a tu cuenta: la
          caja se abre en el panel, sin volver al sitio público.
        </p>
        <div className="mt-6">
          {!data ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="font-semibold">No encontramos esta cuota</p>
              <p className="mt-1 text-sm text-muted-foreground">El talón no existe o el vínculo está incompleto.</p>
              <Button asChild className="mt-4">
                <Link href="/sign-in">Ingresar</Link>
              </Button>
            </div>
          ) : (
            <CouponPayDesk installment={data} mpStatus={mpStatus} guest />
          )}
        </div>
      </main>
    </div>
  )
}
