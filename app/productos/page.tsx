import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { formatARS } from '@/lib/finance'
import { LEGAL_COPY } from '@/lib/legal/copy'
import { COMERCIO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import { pageMetadata } from '@/lib/seo'
import { BadgeCheck, Building2, Landmark, Scale, Shield, Wallet } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Productos · Créditos en línea',
  description:
    'Préstamo personal y crédito comercial PyME. TNA y CFT de referencia del catálogo operativo. Sujeto a evaluación.',
  path: '/productos',
})

export default function ProductosPage() {
  const productos = [
    {
      icon: <Wallet className="h-6 w-6" />,
      tag: 'Personas · producto principal',
      id: 'personal',
      title: 'Préstamo personal',
      subtitle: `Cuota fija · TNA de referencia ${PERSONAL_QUOTE.tnaLabel}`,
      bullets: [
        `Hasta ${formatARS(PERSONAL_QUOTE.maxAmount)}`,
        `${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} cuotas mensuales fijas`,
        `Primer crédito acotado a ${formatARS(FIRST_CREDIT_HARD_CAP)}`,
        'Acreditación cuando tesorería confirma el desembolso',
        'Requisito: DNI + CUIL + CBU/CVU + ingresos + KYC Didit',
      ],
      rate: PERSONAL_QUOTE,
      cta: { href: '/simulador', label: 'Simular préstamo personal' },
      tone: 'from-brand-primary/10 to-brand-cian-500/10 border-brand-primary/20',
    },
    {
      icon: <Building2 className="h-6 w-6" />,
      tag: 'PyME · capital de trabajo',
      id: 'comercial',
      title: 'Crédito comercial',
      subtitle: 'Préstamo puntual. No es una línea revolvente.',
      bullets: [
        `Hasta ${formatARS(COMERCIO_QUOTE.maxAmount)}`,
        `${COMERCIO_QUOTE.minTerm} a ${COMERCIO_QUOTE.maxTerm} cuotas`,
        'Garantía adicional solo si la oferta la exige',
        'Evaluación con KYC y Central de Deudores',
      ],
      rate: COMERCIO_QUOTE,
      cta: { href: '/sign-up', label: 'Solicitar crédito comercial' },
      tone: 'from-emerald-500/10 to-brand-cian-500/10 border-emerald-500/20',
    },
  ]

  return (
    <PublicPageShell
      eyebrow="Catálogo"
      title="Crédito personal y crédito comercial"
      description="Dos líneas de originación online. Las tasas salen del mismo catálogo que usa el simulador y el contrato."
      icon={<Wallet className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/simulador', label: 'Abrir simulador' }}
      secondaryAction={{ href: '/contacto', label: 'Consultar' }}
    >
      <div className="space-y-6">
        <PageSection eyebrow="Líneas disponibles" title="Elegí el producto">
          <Grid cols={2}>
            {productos.map((p) => (
              <div id={p.id} key={p.title} className={`flex h-full scroll-mt-28 flex-col gap-4 rounded-3xl border bg-gradient-to-br p-6 ${p.tone}`}>
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-primary ring-1 ring-slate-200/80">{p.icon}</div>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200/80">{p.tag}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.subtitle}</p>
                </div>
                <ul className="space-y-2">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tasas de referencia</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{p.rate.tnaLabel}</p>
                      <p className="text-[10px] text-muted-foreground">TNA</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{p.rate.cftLabel}</p>
                      <p className="text-[10px] text-muted-foreground">CFT c/IVA intereses</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                    {p.rate.metricHint}. {LEGAL_COPY.cftShort} La tasa del contrato puede diferir según evaluación.
                  </p>
                </div>
                <a href={p.cta.href} className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                  {p.cta.label}
                </a>
              </div>
            ))}
          </Grid>
        </PageSection>

        <PageSection eyebrow="Cómo operamos" title="Lo que ves antes de firmar">
          <Grid cols={3}>
            <FeatureCard icon={<Wallet className="h-5 w-5" />} title="Crédito digital" description="Pedilo online, KYC Didit, BCRA y acreditación en tu CBU/CVU." />
            <FeatureCard icon={<Scale className="h-5 w-5" />} title="Situación BCRA" description="Consulta a la Central de Deudores con cuenta. El puntaje UNICRÉDITOS no es score oficial del BCRA." />
            <FeatureCard icon={<Shield className="h-5 w-5" />} title="Arrepentimiento y baja" description="Canales formales Ley 24.240: reclamos, 10 días de arrepentimiento y baja de servicio." />
            <FeatureCard icon={<Landmark className="h-5 w-5" />} title="TNA y CFT" description="Costo completo en simulador, oferta y contrato. Sin letra chica de último momento." />
            <FeatureCard icon={<BadgeCheck className="h-5 w-5" />} title="Tope de cuota" description="La cuota no supera el 35% de los ingresos declarados." />
            <FeatureCard icon={<Building2 className="h-5 w-5" />} title="Operador SAS" description="RM International Group S.A.S., CUIT y domicilio publicados. No somos un banco." />
          </Grid>
        </PageSection>

        <PageSection eyebrow="Requisitos generales" title="Qué necesitás para aplicar" subtitle="Documentación digital. Atención presencial solo en CABA con cita.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'DNI argentino o residencia permanente',
              'CUIL o CUIT propio',
              'CBU o CVU a nombre del titular',
              'Ingresos netos comprobables (se declaran y se usan para el tope de cuota)',
              'Mayor de 18 años',
              'Situación 4 o 5 en BCRA: rechazo automático salvo revisión admin',
            ].map((r) => (
              <li key={r} className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white p-4 text-sm leading-relaxed text-slate-700">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {r}
              </li>
            ))}
          </ul>
        </PageSection>
      </div>
    </PublicPageShell>
  )
}
