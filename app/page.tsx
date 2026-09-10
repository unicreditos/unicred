import { LoanSimulator } from '@/components/loan-simulator'
import { Button } from '@/components/ui/button'
import { getAccountHref } from '@/lib/session'
import { cn } from '@/lib/utils'
import { TrustBar } from '@/components/unicred/dashboard-kit'
import { PublicFooter, PublicHeader, LegalStrip, PublicCtaBanner } from '@/components/unicred/public-chrome'
import { BRAND } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { LEGAL_COPY } from '@/lib/legal/copy'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { pageMetadata } from '@/lib/seo'
import {
  Banknote,
  CalendarClock,
  CreditCard,
  FileCheck2,
  IdCard,
  Landmark,
  Scale,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Créditos personales online',
  description:
    'Préstamo personal online en Argentina. Simulá la cuota, verificá tu identidad y consultamos la Central de Deudores del BCRA antes de firmar. TNA y CFT a la vista.',
  path: '/',
})

export default async function HomePage() {
  const { isLoggedIn, accountHref } = await getAccountHref()

  const steps = [
    {
      icon: Sparkles,
      t: 'Simulá tu cuota',
      d: 'Elegí monto y plazo acá mismo. Ves la cuota, TNA y CFT antes de crear la cuenta, sin compromiso.',
    },
    {
      icon: IdCard,
      t: 'Creá tu cuenta y verificá identidad',
      d: 'DNI, CUIL y prueba de vida con Didit, dentro de UNICRÉDITOS. Consultamos el BCRA con tu autorización.',
    },
    {
      icon: FileCheck2,
      t: 'Firmá con los números a la vista',
      d: 'Si tu perfil califica, ves el plan de cuotas y el contrato. Firmás solo cuando el costo total te cierra.',
    },
    {
      icon: Banknote,
      t: 'Recibís el dinero',
      d: 'Acreditamos en tu CBU o CVU. Contrato, pagaré, cuponera y recibos quedan siempre en tu panel.',
    },
  ]

  const benefits = [
    {
      icon: Sparkles,
      t: 'Solicitud simple y 100% online',
      d: 'Sin sucursales ni turnos. Todo el trámite se hace desde tu celular o computadora.',
    },
    {
      icon: Scale,
      t: 'Costo completo antes de firmar',
      d: 'TNA, CFT con IVA sobre intereses y cuota fija. Sin letra chica de último momento.',
    },
    {
      icon: ShieldCheck,
      t: 'Identidad verificada de verdad',
      d: 'Didit valida DNI y prueba de vida. No aceptamos fotos cargadas a mano ni crédito anónimo.',
    },
    {
      icon: Landmark,
      t: 'Evaluación seria con el BCRA',
      d: 'Consultamos la Central de Deudores con tu autorización. La cuota no supera el 35% de tus ingresos.',
    },
  ]

  const requirements = [
    { icon: IdCard, t: 'DNI y CUIL a tu nombre', d: 'Mayor de edad, residente en Argentina.' },
    { icon: Wallet, t: 'CBU o CVU del titular', d: 'Para acreditar el préstamo y descontar las cuotas.' },
    { icon: Banknote, t: 'Ingresos netos comprobables', d: 'La cuota ofrecida nunca supera el 35% de tus ingresos.' },
    { icon: CreditCard, t: 'Sin crédito anónimo', d: 'Identidad verificada con Didit: DNI, selfie y prueba de vida.' },
  ]

  const faqs = [
    {
      q: '¿Cómo solicito el préstamo personal?',
      a: 'Simulá el monto y plazo acá arriba, creá tu cuenta, verificá tu identidad con Didit y consultamos la Central de Deudores del BCRA. Si tu perfil califica, ves el plan de cuotas y firmás el contrato antes de que acreditemos el dinero.',
    },
    {
      q: '¿UNICRÉDITOS es un banco?',
      a: LEGAL_COPY.nonBank,
    },
    {
      q: '¿Cuánto tarda la evaluación?',
      a: 'No prometemos aprobación en minutos: el tiempo depende de la verificación de identidad y de la respuesta de la API del BCRA. Si el perfil no califica, no hay desembolso.',
    },
    {
      q: '¿Cómo recibo el dinero y pago las cuotas?',
      a: 'Acreditamos en el CBU o CVU a tu nombre cargado en el panel. Pagás cada cuota desde tu cuenta con tarjeta, Pago Fácil, Rapipago, billetera o transferencia.',
    },
    {
      q: '¿Puedo arrepentirme después de firmar?',
      a: LEGAL_COPY.arrepentimiento,
    },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PublicHeader isLoggedIn={isLoggedIn} accountHref={accountHref} />
      <main id="contenido-principal">
        {/* Hero: calculadora al frente, no una promesa vacía */}
        <section className="relative overflow-hidden border-b border-white/10 bg-brand-navy text-white">
          <div className="absolute inset-0 bg-[#07140f]" />
          <div
            className="pointer-events-none absolute -left-28 top-0 h-[420px] w-[480px] rounded-full bg-brand-primary/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 bottom-0 h-[360px] w-[420px] rounded-full bg-brand-cian/10 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
            <div className="lg:col-span-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-cian-200">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                Préstamos personales online
              </p>
              <h1 className="mt-6 max-w-xl text-[38px] font-bold leading-[1.08] tracking-tight text-white sm:text-[46px] lg:text-[52px]">
                Un crédito que se entiende antes de pedirlo.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-snug text-brand-cian-100">
                {BRAND.valueProp}
              </p>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/75">
                Simulá la cuota acá al lado, verificá tu identidad y consultamos la Central de Deudores del BCRA.
                Firmás recién cuando ves TNA, CFT y plan de pagos completos.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, t: 'Identidad Didit' },
                  { icon: Landmark, t: 'BCRA antes de firmar' },
                  { icon: Scale, t: 'CFT sin sorpresas' },
                ].map((p) => {
                  const Icon = p.icon
                  return (
                    <span
                      key={p.t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85"
                    >
                      <Icon className="h-3.5 w-3.5 text-brand-primary-300" />
                      {p.t}
                    </span>
                  )
                })}
              </div>
              <dl className="mt-6 grid max-w-md grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-cian-200">Hasta</dt>
                  <dd className="mt-1 text-base font-bold tabular-nums text-white">{formatARS(PERSONAL_QUOTE.maxAmount)}</dd>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-cian-200">Cuotas</dt>
                  <dd className="mt-1 text-base font-bold text-white">3 a 48 fijas</dd>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-cian-200">Primer crédito</dt>
                  <dd className="mt-1 text-base font-bold tabular-nums text-white">{formatARS(FIRST_CREDIT_HARD_CAP)}</dd>
                </div>
              </dl>
              <div className="mt-8 hidden flex-wrap items-center gap-3 sm:flex">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-gradient-to-r from-brand-primary to-brand-amber px-7 font-bold text-white shadow-lg shadow-brand-primary/25 transition hover:brightness-[1.06]"
                >
                  <Link href="/sign-up">Solicitar mi crédito</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-white/25 bg-white/5 font-semibold text-white hover:bg-white/10">
                  <Link href="/preguntas-frecuentes">Ver preguntas frecuentes</Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <LoanSimulator className="shadow-2xl shadow-black/30" />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:hidden">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-gradient-to-r from-brand-primary to-brand-amber px-7 font-bold text-white shadow-lg shadow-brand-primary/25 transition hover:brightness-[1.06]"
                >
                  <Link href="/sign-up">Solicitar mi crédito</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <TrustBar />

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-24 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary ring-1 ring-brand-primary/10">
                <FileCheck2 className="h-3.5 w-3.5" /> Proceso 100% digital
              </span>
              <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-brand-navy sm:text-4xl">
                Pedilo en 4 pasos, sin sucursal.
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                La oferta se firma recién cuando ves TNA, CFT y plan de cuotas completos.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, idx) => {
                const Icon = s.icon
                return (
                  <div key={s.t} className="relative">
                    {idx < steps.length - 1 ? (
                      <div
                        aria-hidden
                        className="absolute left-full top-7 hidden h-px w-6 bg-gradient-to-r from-brand-primary/40 to-transparent lg:block"
                      />
                    ) : null}
                    <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-card p-6 text-center shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-primary-700 text-white shadow-md shadow-brand-primary/25">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-amber">
                        Paso 0{idx + 1}/04
                      </span>
                      <h3 className="mt-2 text-sm font-bold text-brand-navy">{s.t}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Por qué elegirnos */}
        <section className="scroll-mt-24 border-y border-border/60 bg-slate-50/60">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">¿Por qué elegirnos?</h2>
              <p className="mt-3 text-base text-muted-foreground">
                Sin letra chica ni promesas vacías: te mostramos cómo evaluamos y qué vas a firmar.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((b, idx) => {
                const Icon = b.icon
                const amber = idx % 2 === 1
                return (
                  <div
                    key={b.t}
                    className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span
                      className={cn(
                        'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ring-1',
                        amber
                          ? 'bg-brand-amber/10 text-brand-amber ring-brand-amber/15'
                          : 'bg-brand-primary-50 text-brand-primary ring-brand-primary/10',
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-4 text-sm font-bold text-brand-navy">{b.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.d}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Requisitos mínimos */}
        <section className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary">Requisitos</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">
                Sacá tu crédito con mínimos requisitos.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                No hace falta que ya seas cliente de ningún banco. Con tu DNI y una cuenta a tu nombre alcanza para
                empezar la solicitud.
              </p>
              <Button
                asChild
                className="mt-6 rounded-full bg-gradient-to-r from-brand-primary to-brand-amber font-bold text-white shadow-md shadow-brand-primary/20 transition hover:brightness-[1.06]"
              >
                <Link href="/sign-up">Empezar solicitud</Link>
              </Button>
            </div>
            <div className="lg:col-span-7">
              <div className="grid gap-4 sm:grid-cols-2">
                {requirements.map((r, idx) => {
                  const Icon = r.icon
                  const amber = idx % 2 === 1
                  return (
                    <div
                      key={r.t}
                      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                          amber
                            ? 'bg-brand-amber/10 text-brand-amber ring-brand-amber/15'
                            : 'bg-brand-primary-50 text-brand-primary ring-brand-primary/10',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-brand-navy">{r.t}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.d}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Quién te presta */}
        <section id="quien-opera" className="scroll-mt-24 border-t border-border/60 bg-slate-50/60">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-primary">Quién te presta</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">
                Sociedad nominada, domicilio y reglas a la vista.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{LEGAL_COPY.nonBank}</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Landmark, t: 'Operador identificado', d: `${BRAND.legalName} · CUIT ${BRAND.cuit} · ${BRAND.address}.` },
                { icon: Scale, t: 'Costo antes de firmar', d: 'TNA, CFT con IVA sobre intereses y cuponera. La oferta rige por contrato.' },
                { icon: ShieldCheck, t: 'Tope de cuota 35%', d: 'La cuota no puede superar el 35% de los ingresos declarados.' },
                { icon: CalendarClock, t: 'Derechos del consumidor', d: 'Arrepentimiento 10 días (Ley 24.240), baja y reclamos por formulario o email.' },
              ].map((g) => {
                const Icon = g.icon
                return (
                  <div key={g.t} className="rounded-2xl border border-border/70 bg-white p-5 shadow-xs">
                    <Icon className="h-5 w-5 text-brand-primary" />
                    <h3 className="mt-3 text-sm font-bold text-brand-navy">{g.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{g.d}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="preguntas" className="mx-auto w-full max-w-4xl scroll-mt-24 px-4 py-16 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">¿Querés saber más?</h2>
            <p className="mt-3 text-base text-muted-foreground">Despejá tus dudas antes de solicitar el crédito.</p>
          </div>
          <div className="mt-8 space-y-3">
            {faqs.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border/70 bg-card px-5 py-4 open:border-brand-primary/30"
              >
                <summary className="cursor-pointer list-none text-sm font-bold text-brand-navy marker:content-none">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/preguntas-frecuentes" className="text-sm font-semibold text-brand-primary hover:underline">
              Ver todas las preguntas frecuentes →
            </Link>
          </div>
          <div className="mt-6">
            <LegalStrip />
          </div>
        </section>

        <PublicCtaBanner />
      </main>
      <PublicFooter />
    </div>
  )
}
