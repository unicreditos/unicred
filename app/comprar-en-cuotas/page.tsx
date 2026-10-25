import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { formatARS } from '@/lib/finance'
import { CONSUMO_QUOTE } from '@/lib/loan-catalog'
import { DOWN_PAYMENT_RATE } from '@/lib/merchant-orders/rules'
import { listPublicMerchants } from '@/lib/merchants/directory'
import { pageMetadata } from '@/lib/seo'
import { BadgeCheck, KeyRound, PackageCheck, QrCode, ShoppingBag, Store } from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Comprar en cuotas sin tarjeta',
  description:
    'Comprá en comercios adheridos sin tarjeta de crédito: pagás el 30% de anticipo a UNICRÉDITOS y el resto en cuotas fijas, con TNA y CFT a la vista.',
  path: '/comprar-en-cuotas',
})

export const revalidate = 300

const PCT = `${Math.round(DOWN_PAYMENT_RATE * 100)}%`

export default async function ComprarEnCuotasPage() {
  const merchants = await listPublicMerchants({ limit: 60 }).catch(() => [])
  return (
    <PublicPageShell
      eyebrow="Cuotas sin tarjeta"
      title="Llevátelo hoy. Pagá el resto en cuotas fijas."
      description={`En comercios adheridos pagás el ${PCT} de anticipo a UNICRÉDITOS y financiás el resto en cuotas fijas en pesos. Financiamos hasta ${formatARS(CONSUMO_QUOTE.maxAmount)} por compra.`}
      icon={<ShoppingBag className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/red-comercios', label: 'Ver comercios adheridos' }}
      secondaryAction={{ href: '/sign-up', label: 'Crear mi cuenta' }}
    >
      <PageSection eyebrow="Cómo funciona" title="Cuatro pasos, todo desde tu cuenta">
        <Grid cols={4}>
          <FeatureCard icon={<Store className="h-5 w-5" />} title="1 · Elegís el producto" description="En el local (el vendedor carga tu CUIL) o en el catálogo online del comercio." />
          <FeatureCard icon={<BadgeCheck className="h-5 w-5" />} title="2 · Lo revisamos" description="Una persona de la mesa de créditos evalúa la operación con tu autorización al BCRA." />
          <FeatureCard icon={<QrCode className="h-5 w-5" />} title={`3 · Firmás y pagás el ${PCT}`} description="Firmás desde tu cuenta y pagás el anticipo a UNICRÉDITOS con QR de Mercado Pago o transferencia." />
          <FeatureCard icon={<PackageCheck className="h-5 w-5" />} title="4 · Retirás con tu código" description="Le das al comercio tu código de 6 dígitos al recibir el producto. Ahí empieza tu crédito." />
        </Grid>
      </PageSection>

      <PageSection eyebrow="Reglas claras" title="Lo que tenés que saber">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            `El anticipo del ${PCT} se paga siempre a UNICRÉDITOS, nunca al comercio.`,
            'Antes de firmar ves la cuota, la TNA, la TEA y el CFT con IVA.',
            'Las cuotas son fijas en pesos. Sin punitorios, gastos de otorgamiento ni seguros.',
            'Necesitás cuenta en UNICRÉDITOS con tu identidad verificada (DNI y prueba de vida).',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 rounded-xl border border-brand-navy-200/70 bg-white p-4 text-sm leading-relaxed text-brand-navy-700">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-700" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection eyebrow="Red UNICRÉDITOS" title={merchants.length ? 'Comercios con catálogo en cuotas' : 'La red está en expansión'}>
        {merchants.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.map((m) => (
              <li key={m.id}>
                <Link href={`/red-comercios/${m.id}`} className="block rounded-2xl border border-brand-navy-100 bg-white p-5 transition hover:border-brand-primary/40 hover:shadow-md">
                  <p className="font-semibold text-brand-navy-900">{m.businessName}</p>
                  <p className="mt-1 text-xs text-brand-navy-600">{[m.category, m.city, m.province].filter(Boolean).join(' · ')}</p>
                  <p className="mt-3 text-xs font-semibold text-brand-primary-700">Ver catálogo →</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-brand-navy-600">
            Todavía no hay comercios publicados. ¿Tenés un local? <Link href="/comercios" className="font-semibold text-brand-primary-700 underline">Adherilo</Link>.
          </p>
        )}
      </PageSection>
    </PublicPageShell>
  )
}
