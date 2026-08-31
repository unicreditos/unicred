import { LoanSimulator } from '@/components/loan-simulator'
import { Button } from '@/components/ui/button'
import { getAccountHref } from '@/lib/session'
import {
  HeroLanding,
  SectionCard,
  Stepper,
  TrustBar,
} from '@/components/unicred/dashboard-kit'
import { PublicFooter, PublicHeader, LegalStrip, PublicCtaBanner } from '@/components/unicred/public-chrome'
import { BRAND } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { LEGAL_COPY } from '@/lib/legal/copy'
import { COMERCIO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import { pageMetadata } from '@/lib/seo'
import {
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  FileCheck2,
  Landmark,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Créditos personales online',
  description:
    'Crédito en línea en Argentina. Simulá cuota, TNA y CFT, verificá identidad y consultamos la Central de Deudores del BCRA antes de firmar.',
  path: '/',
})

export default async function HomePage() {
  const { isLoggedIn, accountHref } = await getAccountHref()

  const products = [
    {
      icon: Banknote,
      tag: 'Personas',
      name: 'Préstamo personal',
      desc: `Hasta ${formatARS(PERSONAL_QUOTE.maxAmount)} en ${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} cuotas fijas. Primer crédito acotado a ${formatARS(FIRST_CREDIT_HARD_CAP)}.`,
      metric: PERSONAL_QUOTE.metric,
      metricHint: PERSONAL_QUOTE.metricHint,
      cta: 'Ver préstamo personal',
      href: '/prestamos',
      featured: true,
    },
    {
      icon: Building2,
      tag: 'PyME',
      name: 'Crédito comercial',
      desc: `Hasta ${formatARS(COMERCIO_QUOTE.maxAmount)} en ${COMERCIO_QUOTE.minTerm} a ${COMERCIO_QUOTE.maxTerm} cuotas. Préstamo puntual, no línea revolvente.`,
      metric: COMERCIO_QUOTE.metric,
      metricHint: COMERCIO_QUOTE.metricHint,
      cta: 'Ver crédito comercial',
      href: '/productos#comercial',
      featured: false,
    },
  ]

  const flowSteps = ['Simulá', 'Validación', 'Oferta', 'Acreditación']
  const flowCards = [
    {
      icon: Sparkles,
      t: '1 · Simulá la cuota',
      d: 'Elegí monto y plazo. Ves cuota, TNA, CFT y total a devolver con sistema francés, antes de crear la cuenta.',
    },
    {
      icon: ShieldCheck,
      t: '2 · Identidad y BCRA',
      d: 'Cargás DNI y CUIL. Didit verifica prueba de vida. Consultamos la Central de Deudores del BCRA con tu autorización.',
    },
    {
      icon: FileCheck2,
      t: '3 · Oferta para firmar',
      d: 'Si el perfil califica, ves monto, plan de cuotas y CFT contractual. Aceptás solo cuando los números cierran.',
    },
    {
      icon: Banknote,
      t: '4 · Dinero en tu cuenta',
      d: 'Acreditamos en el CBU o CVU a tu nombre. Contrato, pagaré, cuponera y recibos quedan en tu panel.',
    },
  ]

  const guarantees = [
    {
      icon: Landmark,
      t: 'Operador identificado',
      d: `${BRAND.legalName} · CUIT ${BRAND.cuit} · ${BRAND.address}.`,
    },
    {
      icon: Scale,
      t: 'Costo antes de firmar',
      d: 'TNA, CFT con IVA sobre intereses y cuponera. La simulación es informativa; rige el contrato.',
    },
    {
      icon: ShieldCheck,
      t: 'Tope de cuota 35%',
      d: 'La cuota no puede superar el 35% de los ingresos declarados. Sin crédito anónimo.',
    },
    {
      icon: FileCheck2,
      t: 'Derechos del consumidor',
      d: 'Arrepentimiento 10 días (Ley 24.240), baja, reclamos por formulario o email. Sin WhatsApp ni 0800.',
    },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader isLoggedIn={isLoggedIn} accountHref={accountHref} />
      <main id="contenido-principal">
      <HeroLanding />
      <TrustBar />

      <section id="quien-opera" className="scroll-mt-24 border-b border-border/60 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary">Quién te presta</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">
              Sociedad nominada, domicilio y reglas a la vista.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {LEGAL_COPY.nonBank}
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {guarantees.map((g) => {
              const Icon = g.icon
              return (
                <div key={g.t} className="rounded-2xl border border-border/70 bg-slate-50/70 p-5">
                  <Icon className="h-5 w-5 text-brand-primary" />
                  <h3 className="mt-3 text-sm font-bold text-brand-navy">{g.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{g.d}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="simulador" className="relative scroll-mt-24">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionCard
              title="Simulá tu crédito"
              description="Ajustá monto y cuotas. Los valores son informativos y no constituyen oferta ni aprobación."
              icon={<Sparkles className="h-4.5 w-4.5" />}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                  <BadgeCheck className="h-3.5 w-3.5" /> Sin compromiso
                </span>
              }
            >
              <div className="grid gap-6 md:grid-cols-5">
                <div className="md:col-span-3">
                  <LoanSimulator className="max-w-none" />
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-slate-50/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-navy-700">
                      <BadgeCheck className="h-4 w-4 text-brand-primary" /> Documentación para aplicar
                    </div>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> DNI y CUIL a tu nombre</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> CBU o CVU del titular</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> Ingresos netos comprobables</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-brand-primary/15 bg-brand-primary-50/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Transparencia de costos</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Informamos TNA y CFT con IVA en la misma pantalla. La tasa final depende del perfil de riesgo
                      y se confirma en el contrato.
                    </p>
                    <Button asChild className="mt-4 w-full font-bold">
                      <Link href="/sign-up">Solicitar evaluación</Link>
                    </Button>
                  </div>
                  <LegalStrip />
                </div>
              </div>

              <div className="mt-6 border-t border-border/60 pt-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold tracking-tight text-foreground">Camino de solicitud</h4>
                  <span className="text-[11px] font-semibold text-muted-foreground">El tiempo depende de KYC y de la API del BCRA</span>
                </div>
                <Stepper steps={flowSteps} current={0} />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6 lg:col-span-4">
            <SectionCard
              title="Cómo evaluamos"
              description="No publicamos tasas de aprobación ni volúmenes. Cada caso se decide con KYC, BCRA e ingresos."
              icon={<Scale className="h-4.5 w-4.5" />}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-brand-primary/15 bg-brand-primary-50/50 p-3.5 ring-1 ring-brand-primary/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">Identidad</div>
                  <div className="mt-1 text-sm font-black text-brand-navy">Didit</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">DNI y prueba de vida</div>
                </div>
                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3.5 ring-1 ring-emerald-200/40">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Crediticio</div>
                  <div className="mt-1 text-sm font-black text-brand-navy">BCRA</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Central de Deudores</div>
                </div>
                <div className="rounded-xl border border-brand-cian-200/60 bg-brand-cian-50/60 p-3.5 ring-1 ring-brand-cian-200/40">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-cian-700">Costos</div>
                  <div className="mt-1 text-sm font-black text-brand-navy">TNA y CFT</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Antes de firmar</div>
                </div>
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3.5 ring-1 ring-amber-200/40">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Cuota</div>
                  <div className="mt-1 text-sm font-black text-brand-navy">Tope 35%</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">de ingresos declarados</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-brand-primary" /> Datos personales: Ley 25.326</div>
                <div className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-brand-primary" /> No somos entidad financiera del BCRA</div>
              </div>
            </SectionCard>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 border-y border-border/60 bg-slate-50/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary ring-1 ring-brand-primary/10">
              <FileCheck2 className="h-3.5 w-3.5" /> Proceso 100% digital
            </span>
            <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-brand-navy sm:text-4xl">
              De la simulación al desembolso, con costos claros.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Cuatro pasos. Sin sucursal. La oferta se firma recién cuando ves TNA, CFT y plan de cuotas.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {flowCards.map((f, idx) => {
              const Icon = f.icon
              return (
                <SectionCard
                  key={idx}
                  title={f.t}
                  description={f.d}
                  icon={<Icon className="h-4.5 w-4.5" />}
                  className="h-full transition-transform group hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-[11px] font-semibold">
                    <span className="text-muted-foreground">Etapa</span>
                    <span className="flex items-center gap-1 text-brand-primary">0{idx + 1} / 04</span>
                  </div>
                </SectionCard>
              )
            })}
          </div>
        </div>
      </section>

      <section id="productos" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">Líneas de crédito</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Crédito personal y crédito comercial. Misma regla: cuota fija, TNA y CFT informados.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-brand-primary" /> Sujeto a evaluación crediticia
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {products.map((p) => {
            const Icon = p.icon
            return (
              <SectionCard
                key={p.name}
                title={p.name}
                description={p.desc}
                icon={<Icon className="h-4.5 w-4.5" />}
                className="h-full transition-transform group hover:-translate-y-0.5"
                action={
                  <span className="rounded-full border border-brand-primary/15 bg-brand-primary-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-primary ring-1 ring-brand-primary/10">
                    {p.tag}
                  </span>
                }
              >
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Costos de referencia</div>
                  <div className="mt-0.5 font-bold text-brand-navy">{p.metric}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{p.metricHint}</div>
                </div>
                <Button asChild className="mt-5 w-full rounded-xl font-bold">
                  <Link href={p.href}>{p.cta}</Link>
                </Button>
              </SectionCard>
            )
          })}
        </div>
      </section>

      <PublicCtaBanner />
      </main>
      <PublicFooter />
    </div>
  )
}
