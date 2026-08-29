import { OnlineConsumoForm } from '@/components/payments/online-consumo-form'
import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { formatARS } from '@/lib/finance'
import { CONSUMO_QUOTE } from '@/lib/loan-catalog'
import { listPublicMerchants } from '@/lib/merchants/directory'
import { pageMetadata } from '@/lib/seo'
import { getAccountHref } from '@/lib/session'
import { QrCode, ShoppingBag, Store } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Comprar en cuotas sin tarjeta',
  description:
    'Financiá compras en tienda física u online sin tarjeta de crédito. Cuotas fijas, KYC biométrico y red de comercios UNICRÉDITOS.',
  path: '/comprar-en-cuotas',
})

export default async function ComprarEnCuotasPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string }>
}) {
  const { merchant: merchantParam } = await searchParams
  const merchants = await listPublicMerchants({ limit: 80 })
  const { isLoggedIn } = await getAccountHref()

  return (
    <PublicPageShell
      eyebrow="Cuotas sin tarjeta"
      title="Comprá ahora. Pagá en cuotas fijas."
      description={`Hasta ${formatARS(CONSUMO_QUOTE.maxAmount)} en comercios físicos y online. Sin tarjeta de crédito: usás tu cuenta UNICRÉDITOS.`}
      icon={<ShoppingBag className="h-3.5 w-3.5" />}
      primaryAction={{
        href: isLoggedIn ? '#online' : '/sign-up',
        label: isLoggedIn ? 'Financiar compra online' : 'Crear cuenta y comprar',
      }}
      secondaryAction={{ href: '/red-comercios', label: 'Ver comercios' }}
    >
      <PageSection eyebrow="Dos canales" title="¿Cómo empezar a comprar?">
        <Grid cols={2}>
          <FeatureCard
            icon={<Store className="h-5 w-5" />}
            title="En tienda física"
            description="Avisale al vendedor que pagás con UNICRÉDITOS. Escaneás el QR o das tu CUIL. En minutos tenés la financiación."
          />
          <FeatureCard
            icon={<QrCode className="h-5 w-5" />}
            title="En tienda online"
            description="Elegí el comercio adherido, el monto y las cuotas. Evaluamos BCRA + KYC y te dejamos el contrato listo para firmar."
          />
        </Grid>
      </PageSection>

      <PageSection eyebrow="Promociones" title="Cuotas fijas y 0% en locales adheridos">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="text-sm font-bold text-brand-navy">Cuotas fijas en pesos</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ves TNA y CFT antes de firmar. Sin sorpresas post-contrato fuera de lo pactado.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5">
            <p className="text-sm font-bold text-brand-navy">Promoción 0%</p>
            <p className="mt-2 text-sm text-muted-foreground">
              En comercios con promo, el local absorbe el interés. El vendedor la activa en el POS.
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection id="online" eyebrow="Checkout online" title="Financiá tu compra ahora">
        {isLoggedIn ? (
          <OnlineConsumoForm merchants={merchants} initialMerchantId={merchantParam} />
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            Ingresá a tu cuenta para financiar una compra online.{' '}
            <a className="font-semibold text-brand-primary" href="/sign-in">
              Ingresar
            </a>{' '}
            o{' '}
            <a className="font-semibold text-brand-primary" href="/sign-up">
              crear cuenta
            </a>
            .
          </p>
        )}
      </PageSection>
    </PublicPageShell>
  )
}
