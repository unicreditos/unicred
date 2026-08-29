import { FeatureCard, Grid, PageSection, PublicPageShell } from '@/components/unicred/public-page-shell'
import { formatARS } from '@/lib/finance'
import { COMERCIO_QUOTE, CONSUMO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { pageMetadata } from '@/lib/seo'
import { BadgeCheck, Landmark, Scale, Shield, Store, Wallet } from 'lucide-react'

export const metadata = pageMetadata({
  title: 'Productos · Créditos',
  description:
    'Préstamo personal, crédito comercial y consumo en comercios. TNA y CFT de referencia del catálogo operativo. Sujeto a evaluación.',
  path: '/productos',
})

export default function ProductosPage() {
  const productos = [
    {
      icon: <Wallet className="h-6 w-6" />,
      tag: 'Personas',
      id: 'personal',
      title: 'Préstamo Personal',
      subtitle: `Cuota fija · TNA de referencia ${PERSONAL_QUOTE.tnaLabel}`,
      bullets: [
        `Hasta ${formatARS(PERSONAL_QUOTE.maxAmount)}`,
        `${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} cuotas mensuales fijas`,
        'Acreditación cuando tesorería confirma el desembolso, no un plazo fijo de 24 hs',
        'Requisito: DNI + CUIL + CBU/CVU + ingresos + KYC Didit',
      ],
      rate: PERSONAL_QUOTE,
      cta: { href: '/simulador', label: 'Simular préstamo personal' },
      tone: 'from-brand-primary/10 to-brand-cian-500/10 border-brand-primary/20',
    },
    {
      icon: <Store className="h-6 w-6" />,
      tag: 'PyME · Capital de trabajo',
      id: 'comercial',
      title: 'Crédito Comercial',
      subtitle: 'Préstamo puntual. No es una línea revolvente.',
      bullets: [
        `Hasta ${formatARS(COMERCIO_QUOTE.maxAmount)}`,
        `${COMERCIO_QUOTE.minTerm} a ${COMERCIO_QUOTE.maxTerm} cuotas`,
        'Garantía adicional solo si la oferta la exige',
        'Evaluación con KYC y Central de Deudores',
      ],
      rate: COMERCIO_QUOTE,
      cta: { href: '/sign-up', label: 'Solicitar línea comercial' },
      tone: 'from-emerald-500/10 to-brand-cian-500/10 border-emerald-500/20',
    },
    {
      icon: <Store className="h-6 w-6" />,
      tag: 'Punto de venta',
      id: 'consumo',
      title: 'Crédito Consumo',
      subtitle: 'El deudor es el cliente, no el comercio',
      bullets: [
        `${CONSUMO_QUOTE.minTerm} a ${CONSUMO_QUOTE.maxTerm} cuotas`,
        `Hasta ${formatARS(CONSUMO_QUOTE.maxAmount)}`,
        'El cliente debe tener cuenta UNICRÉDITOS y KYC aprobado',
        'El comercio cobra el neto cuando UNICRÉDITOS acredita',
      ],
      rate: CONSUMO_QUOTE,
      cta: { href: '/red-comercios', label: 'Ver red de comercios' },
      tone: 'from-brand-cian-500/10 to-sky-400/10 border-brand-cian-500/20',
    },
  ]

  return (
    <PublicPageShell
      eyebrow="Portafolio"
      title="Nuestros productos de crédito"
      description="Tres líneas de crédito más billetera, pagos de servicios y red de comercios. Las tasas salen del mismo catálogo que usa el simulador y el contrato."
      icon={<Wallet className="h-3.5 w-3.5" />}
      primaryAction={{ href: '/simulador', label: 'Abrir simulador' }}
      secondaryAction={{ href: '/contacto', label: 'Consultar' }}
    >
      <div className="space-y-6">
        <PageSection eyebrow="Líneas disponibles" title="Elegí el producto que mejor se adapta">
          <Grid cols={3}>
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
                    {p.rate.metricHint}. El CFT informado es la TEA más IVA 21% sobre intereses. No incluye seguros ni gastos extra; hoy el motor no los cobra. La tasa del contrato puede diferir según evaluación.
                  </p>
                </div>
                <a href={p.cta.href} className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                  {p.cta.label}
                </a>
              </div>
            ))}
          </Grid>
        </PageSection>

        <PageSection eyebrow="Servicios que sí existen" title="Lo que podés hacer hoy">
          <Grid cols={3}>
            <FeatureCard icon={<Wallet className="h-5 w-5" />} title="Préstamo digital" description="Pedilo online, KYC Didit, BCRA y acreditación en tu CBU/CVU." />
            <FeatureCard icon={<Store className="h-5 w-5" />} title="Cuotas sin tarjeta" description="Comprá en comercios físicos u online. Promo 0% si el local la absorbe." />
            <FeatureCard icon={<Landmark className="h-5 w-5" />} title="Pagos y recargas" description="Servicios, impuestos y celular con saldo de billetera UNICRÉDITOS." />
            <FeatureCard icon={<Scale className="h-5 w-5" />} title="Situación BCRA" description="Consulta a la Central de Deudores con cuenta. El puntaje UNICRÉDITOS no es score oficial del BCRA." />
            <FeatureCard icon={<Shield className="h-5 w-5" />} title="Arrepentimiento y baja" description="Canales formales Ley 24.240: reclamos, 10 días de arrepentimiento y baja de servicio." />
            <FeatureCard icon={<BadgeCheck className="h-5 w-5" />} title="Billetera propia" description="Saldo, P2P interno y egresos ejecutados desde tesorería RM." />
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
