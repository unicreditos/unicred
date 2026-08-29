import { PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { BRAND, groupOperatorLine } from '@/lib/brand'
import { PERSONAL_QUOTE, CONSUMO_QUOTE, COMERCIO_QUOTE } from '@/lib/loan-catalog'
import { pageMetadata } from '@/lib/seo'
import { Scale } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Información al usuario financiero',
  description:
    'Datos del operador, productos, tasas de referencia y canales de atención de UNICRÉDITOS.',
  path: '/legal/usuario-financiero',
})

export default function UsuarioFinancieroPage() {
  const lines = [
    { t: 'Denominación comercial', d: BRAND.company },
    { t: 'Operador legal', d: `${BRAND.legalName} · CUIT ${BRAND.cuit}` },
    { t: 'Domicilio', d: BRAND.address },
    { t: 'Sitio', d: BRAND.domain },
    { t: 'Atención', d: BRAND.supportEmail },
  ]

  const products = [
    { name: PERSONAL_QUOTE.name, metric: PERSONAL_QUOTE.metric },
    { name: CONSUMO_QUOTE.name, metric: CONSUMO_QUOTE.metric },
    { name: COMERCIO_QUOTE.name, metric: COMERCIO_QUOTE.metric },
  ]

  return (
    <PublicPageShell
      eyebrow="Transparencia"
      title="Información al usuario financiero"
      description={groupOperatorLine()}
      icon={<Scale className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/legal/tasas', label: 'Ver tasas y CFT' }}
      secondaryAction={{ href: '/contacto', label: 'Contacto' }}
    >
      <PageSection title="Identificación del operador">
        <dl className="grid gap-3 sm:grid-cols-2">
          {lines.map((row) => (
            <div key={row.t} className="rounded-2xl border border-border/70 bg-card p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {row.t}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-brand-navy">{row.d}</dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <PageSection title="Productos de referencia (catálogo vigente)">
        <ul className="space-y-2 text-sm">
          {products.map((p) => (
            <li key={p.name} className="rounded-xl border border-border/60 px-4 py-3">
              <span className="font-semibold text-brand-navy">{p.name}</span>
              <span className="mt-1 block text-muted-foreground">{p.metric}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Las tasas son referenciales del catálogo operativo. La oferta contractual prevalece.
        </p>
      </PageSection>
    </PublicPageShell>
  )
}
