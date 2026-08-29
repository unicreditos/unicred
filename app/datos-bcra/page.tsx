import { PublicBcraBoard } from '@/components/unicred/public-bcra-board'
import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BadgeCheck, Landmark, Scale, Shield } from 'lucide-react'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Datos oficiales BCRA',
  description:
    'Tipo de cambio de referencia y variables publicadas por el Banco Central. UNICRÉDITOS no opera compraventa de divisas.',
  path: '/datos-bcra',
})

export default function DatosBcraPage() {
  return (
    <PublicPageShell
      eyebrow="Transparencia · fuente BCRA"
      icon={<Landmark className="h-3.5 w-3.5" />}
      title="Datos oficiales del Banco Central"
      description="Mostramos el último tipo de cambio de referencia y variables que publica el BCRA. UNICRÉDITOS no es entidad de cambio: estos valores no son una pizarra propia ni una oferta de compraventa."
      primaryAction={{ href: '/simulador', label: 'Simular un crédito' }}
      secondaryAction={{ href: '/scoring', label: 'Consulta Central de Deudores' }}
    >
      <div className="space-y-8">
        <PublicBcraBoard showEmpty />

        <PageSection
          eyebrow="Qué significa este dato"
          title="Referencia oficial, no mercado paralelo"
          subtitle="La API pública del BCRA informa el tipo de cambio de referencia de cada moneda. Suele actualizarse en días hábiles, no cotización por segundo."
        >
          <Grid cols={3}>
            <FeatureCard
              icon={<Landmark className="h-5 w-5" />}
              title="Fuente oficial"
              description="Los números salen de api.bcra.gob.ar. Si el organismo no publica, no inventamos un valor."
              badge="BCRA"
            />
            <FeatureCard
              icon={<Scale className="h-5 w-5" />}
              title="Sin compraventa"
              description="UNICRÉDITOS otorga créditos en pesos. No compramos ni vendemos dólares, euros ni otras divisas."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Actualización"
              description="Consultamos la API cada 15 minutos y mostramos la fecha de publicación del BCRA, no un ticker de mercado."
            />
          </Grid>
        </PageSection>

        <div className="rounded-2xl border border-brand-primary/15 bg-brand-primary-50/40 p-5 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold text-brand-navy">
            <BadgeCheck className="h-4 w-4 text-brand-primary" />
            Aviso
          </p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Este tablero es informativo. No reemplaza el Boletín Oficial ni las comunicaciones del BCRA, no es
            cotización minorista de un banco y no habilita operaciones de cambio en UNICRÉDITOS.
          </p>
        </div>
      </div>
    </PublicPageShell>
  )
}
