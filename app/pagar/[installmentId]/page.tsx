import { BrandWordmark } from '@/components/brand-mark'
import { verifyCouponPayToken } from '@/lib/payments/coupon-link'
import { openCouponCheckout, type CouponCheckoutResult } from '@/lib/payments/coupon-checkout'
import { getAccountHref } from '@/lib/session'
import { installmentPosPath } from '@/lib/workspace-gate'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

function CouponNotice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandWordmark subtitle={null} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{body}</p>
        <Link href="/sign-in" className="inline-block text-sm font-semibold text-teal-700 underline-offset-4 hover:underline">
          Ingresar a mi cuenta
        </Link>
      </div>
    </main>
  )
}

export default async function PublicPagarPage({
  params,
  searchParams,
}: {
  params: Promise<{ installmentId: string }>
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const installmentId = String((await params).installmentId ?? '').trim()
  const rawToken = (await searchParams).t
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken

  if (token) {
    if (!verifyCouponPayToken(installmentId, token)) {
      return <CouponNotice title="Código no válido" body="Este QR no corresponde a una cuota de UNICRÉDITOS. Descargá la cuponera de nuevo desde tu cuenta." />
    }
    let result: CouponCheckoutResult
    try {
      result = await openCouponCheckout(installmentId)
    } catch (err) {
      console.error('[pagar] checkout cuponera', installmentId, (err as Error).message)
      result = { kind: 'unavailable', reason: 'Mercado Pago no respondió. Probá de nuevo en unos minutos.' }
    }
    if (result.kind === 'redirect') redirect(result.url)
    if (result.kind === 'paid') {
      return (
        <CouponNotice
          title={`La cuota ${result.number} ya está pagada`}
          body="No hace falta volver a pagarla. Podés ver el comprobante en tu cuenta UNICRÉDITOS."
        />
      )
    }
    return <CouponNotice title="No se puede pagar esta cuota ahora" body={result.reason} />
  }

  const dest = installmentPosPath(installmentId)
  const { isLoggedIn } = await getAccountHref()
  if (isLoggedIn) {
    redirect(dest)
  }
  redirect(`/sign-in?next=${encodeURIComponent(dest)}`)
}
