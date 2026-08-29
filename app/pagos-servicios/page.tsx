import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { SERVICE_CATEGORIES } from '@/lib/services/catalog'
import { pageMetadata } from '@/lib/seo'
import { Receipt, Smartphone, Zap } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Pagos de servicios y recargas',
  description:
    'Pagá luz, gas, agua, impuestos y recargá celular con saldo de tu billetera UNICRÉDITOS. Débito inmediato; liquidación operativa vía tesorería RM.',
  path: '/pagos-servicios',
})

export default function PagosServiciosPage() {
  return (
    <PublicPageShell
      eyebrow="Pagos y recargas"
      title="Pagá tus servicios y recargá el celular"
      description="Rubros habilitados con saldo de tu billetera UNICRÉDITOS. Una sola cuenta para créditos, cuotas y servicios cotidianos."
      icon={<Zap className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/dashboard?tab=servicios', label: 'Ir a pagar' }}
      secondaryAction={{ href: '/sign-up', label: 'Crear cuenta' }}
    >
      <PageSection eyebrow="Rubros" title="Qué podés pagar hoy">
        <Grid cols={3}>
          {SERVICE_CATEGORIES.map((c) => (
            <FeatureCard
              key={c.id}
              icon={c.id === 'recargas' ? <Smartphone className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
              title={c.label}
              description={c.blurb}
            />
          ))}
        </Grid>
      </PageSection>

      <PageSection eyebrow="Cómo funciona" title="Débito en tu billetera, liquidación RM">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            'Cargás o transferís saldo a tu billetera UNICRÉDITOS.',
            'Elegís prestador, referencia y monto. Confirmás en un toque.',
            'Debitamos al instante. Tesorería RM liquida al prestador en el circuito operativo.',
          ].map((step, i) => (
            <li key={step} className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-brand-primary">Paso {i + 1}</div>
              <p className="mt-2 text-muted-foreground">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          El débito a tu saldo es inmediato. La acreditación al prestador queda en cola operativa de
          tesorería RM (mismo modelo que los egresos bancarios de la billetera).
        </p>
      </PageSection>
    </PublicPageShell>
  )
}
