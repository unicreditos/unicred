import { LoanSimulator } from '@/components/loan-simulator'
import { Button } from '@/components/ui/button'
import { getAccountHref } from '@/lib/session'
import {
  HeroLanding,
  SectionCard,
  Stepper,
  TrustBar,
} from '@/components/unicred/dashboard-kit'
import { PublicBcraBoard, PublicBcraTicker } from '@/components/unicred/public-bcra-board'
import {
  LegalStrip,
  PublicCtaBanner,
  PublicFooter,
  PublicHeader,
} from '@/components/unicred/public-chrome'
import { formatARS } from '@/lib/finance'
import { COMERCIO_QUOTE, CONSUMO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import {
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  FileCheck2,
  Handshake,
  Landmark,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'

export default async function HomePage() {
  const { isLoggedIn, accountHref } = await getAccountHref()

  const products = [
    {
      icon: Wallet,
      tag: 'Personas',
      name: 'Préstamo personal',
      desc: `Hasta ${formatARS(PERSONAL_QUOTE.maxAmount)} en ${PERSONAL_QUOTE.minTerm} a ${PERSONAL_QUOTE.maxTerm} cuotas fijas. Destino libre, sujeto a evaluación.`,
      metric: PERSONAL_QUOTE.metric,
      metricHint: PERSONAL_QUOTE.metricHint,
      cta: 'Simular personal',
      href: '/productos#personal',
    },
    {
      icon: Store,
      tag: 'PyME',
      name: 'Crédito comercial',
      desc: `Capital de trabajo. Hasta ${formatARS(COMERCIO_QUOTE.maxAmount)}. Evaluación con KYC y Central de Deudores.`,
      metric: COMERCIO_QUOTE.metric,
      metricHint: COMERCIO_QUOTE.metricHint,
      cta: 'Ver línea comercial',
      href: '/productos#comercial',
    },
    {
      icon: TrendingUp,
      tag: 'Punto de venta',
      name: 'Crédito de consumo',
      desc: `Financiación en comercios adheridos. Hasta ${formatARS(CONSUMO_QUOTE.maxAmount)}. El cliente debe tener cuenta y KYC aprobado.`,
      metric: CONSUMO_QUOTE.metric,
      metricHint: CONSUMO_QUOTE.metricHint,
      cta: 'Ver red de comercios',
      href: '/comercios',
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
      t: '2 · Validación BCRA y KYC',
      d: 'Cargás DNI y CUIL. Consultamos la Central de Deudores del BCRA y verificamos identidad. Sin sucursal.',
    },
    {
      icon: FileCheck2,
      t: '3 · Oferta para firmar',
      d: 'Si el perfil califica, ves monto, plan de cuotas y CFT contractual. Aceptás solo cuando los números cierran.',
    },
    {
      icon: Banknote,
      t: '4 · Dinero en tu cuenta',
      d: 'Acreditamos en el CBU o CVU a tu nombre. Desde ahí administrás cuotas, recibos y contrato en el panel.',
    },
  ]

  const merchantHighlights = [
    'El cliente debe tener cuenta UNICRÉDITOS y KYC aprobado. No hay crédito anónimo en el local.',
    'UNICRÉDITOS evalúa a esa persona con Central de Deudores. Si no califica, la venta no se financia.',
    'Comisión por operación aprobada, informada al adherir. Sin costo de alta.',
    'El comercio cobra el neto cuando UNICRÉDITOS acredita, no hay plazo de 48 horas garantizado.',
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicBcraTicker />
      <PublicHeader isLoggedIn={isLoggedIn} accountHref={accountHref} />
      <HeroLanding />

      <section id="datos-bcra" className="relative scroll-mt-24 border-b border-border/60 bg-slate-50/40">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <PublicBcraBoard compact />
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
                      <Link href="/sign-up">Solicitar con esta simulación</Link>
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
              icon={<Handshake className="h-4.5 w-4.5" />}
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
            <p className="mt-2 text-base text-muted-foreground">Tres productos. Misma regla: cuota fija y CFT informado.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-brand-primary" /> Sujeto a evaluación crediticia
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
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

      <section id="comercios" className="scroll-mt-24 border-y border-border/60 bg-slate-50/60">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionCard
              title="Financiá tus ventas sin asumir el riesgo"
              description="Red de comercios UNICRÉDITOS. Sin costo de adhesión. El cliente paga en cuotas; vos cobrás el neto."
              icon={<Store className="h-4.5 w-4.5" />}
              className="h-full"
              action={
                <Button asChild className="font-bold shadow-sm shadow-brand-primary/20">
                  <Link href="/comercios">
                    <Building2 className="mr-1.5 h-4 w-4" /> Adherir mi comercio
                  </Link>
                </Button>
              }
            >
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2.5 text-sm">
                  {merchantHighlights.map((h) => (
                    <div key={h} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/10">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-relaxed text-foreground">{h}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl uc-gradient-navy p-5 text-white shadow-lg shadow-brand-navy/20">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brand-cian-200">Ejemplo de liquidación</div>
                  <div className="mt-1 font-mono text-3xl font-black text-white tabular-nums">{formatARS(250000)}</div>
                  <div className="mt-0.5 text-xs text-slate-200/80">Venta financiada en 6 cuotas</div>
                  <div className="mt-6 space-y-2 border-t border-white/10 pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200/80">Bruto de la venta</span>
                      <span className="font-mono font-bold text-white">{formatARS(250000)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200/80">Comisión UNICRÉDITOS (8%)</span>
                      <span className="font-mono font-bold text-rose-300">-{formatARS(20000)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                      <span className="text-sm font-bold text-brand-cian-200">Neto al comercio</span>
                      <span className="font-mono text-lg font-black text-white">{formatARS(230000)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-300/80">Ejemplo ilustrativo. La comisión vigente se informa al adherir el comercio.</p>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <SectionCard
              title="Qué no prometemos"
              description="No publicamos ticket medio, mix de ventas ni plazos de acreditación que no podamos cumplir."
              icon={<TrendingUp className="h-4.5 w-4.5" />}
            >
              <ul className="space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> El cliente firma su propio contrato. El comercio no es el deudor.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> Comisión del ejemplo: 8% sobre $250.000. La vigente se informa al adherir.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" /> Acreditación al comercio cuando UNICRÉDITOS desembolsa, no un SLA de 48 horas.</li>
              </ul>
            </SectionCard>
          </div>
        </div>
      </section>

      <TrustBar />
      <PublicCtaBanner />
      <PublicFooter />
    </div>
  )
}
