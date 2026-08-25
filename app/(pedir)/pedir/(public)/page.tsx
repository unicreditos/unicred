import { PedirFooter, PedirHeader, PedirStickyCta } from '@/components/pedir/chrome'
import { PedirSimulator } from '@/components/pedir/simulator'
import { BRAND } from '@/lib/brand'
import { formatARS, formatPercent } from '@/lib/finance'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: `${BRAND.company} · Crédito personal online`,
  description:
    'Pedí tu préstamo personal online. Simulá cuota, TNA y CFT, firmá tu contrato y gestioná las cuotas en un solo lugar.',
  alternates: { canonical: '/pedir' },
  icons: {
    icon: [{ url: '/pedir/mark.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/pedir/logo-mark.png' }],
  },
}

const STEPS = [
  { n: '1', t: 'Simulá', d: 'Elegí monto y plazo. Ves cuota, TNA y CFT antes de enviar.' },
  { n: '2', t: 'Verificá', d: 'Confirmamos tu identidad y evaluamos tu solicitud de forma segura.' },
  { n: '3', t: 'Operá', d: 'Firmá el contrato, recibí el desembolso y pagá tus cuotas desde la app.' },
]

export default function PedirLandingPage() {
  const ref = PERSONAL_QUOTE

  return (
    <>
      <PedirHeader />
      <main>
        <section className="lp-hero">
          <div className="lp-container lp-hero-inner">
            <h1 className="lp-display lp-rise max-w-[11ch] text-[clamp(3rem,9vw,5.75rem)] text-white">
              Crédito claro.
              <span className="block text-[var(--lp-signal)]">En tu cuenta.</span>
            </h1>

            <p className="lp-rise lp-rise-delay mt-6 max-w-md text-base leading-relaxed text-white/60 sm:text-lg">
              Hasta {formatARS(ref.maxAmount)}. Cuotas fijas. CFT a la vista. Pedí online y seguí todo desde tu cuenta.
            </p>

            <div className="lp-rise lp-rise-delay-2 mt-9 flex flex-wrap gap-3">
              <Link href="/pedir/solicitud" className="lp-btn lp-btn-primary">
                Empezar solicitud
              </Link>
              <a href="#simular" className="lp-btn lp-btn-ghost">
                Simular primero
              </a>
            </div>
          </div>
        </section>

        <section className="lp-trust-bar">
          <div className="lp-container lp-trust-grid">
            <div className="lp-trust-item">
              <strong>Empresa</strong>
              <span>{BRAND.legalName}</span>
            </div>
            <div className="lp-trust-item">
              <strong>Producto</strong>
              <span>
                Personal · {formatARS(ref.minAmount)}–{formatARS(ref.maxAmount)} · {ref.minTerm}–{ref.maxTerm} cuotas
              </span>
            </div>
            <div className="lp-trust-item">
              <strong>Referencia</strong>
              <span>
                TNA {formatPercent(ref.tna)} · CFT {formatPercent(ref.cft)}
              </span>
            </div>
          </div>
        </section>

        <section id="producto" className="lp-section">
          <div className="lp-container">
            <p className="lp-kicker">Cómo funciona</p>
            <h2 className="lp-display mt-3 max-w-xl text-4xl text-[var(--lp-ink)] sm:text-5xl">
              Del simulador a la cuota, en un solo producto
            </h2>
            <div className="lp-step-grid mt-10">
              {STEPS.map((s) => (
                <article key={s.n} className="lp-step">
                  <p className="lp-step-num">{s.n}</p>
                  <h3 className="text-lg font-bold text-[var(--lp-ink)]">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">{s.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section bg-[var(--lp-paper-2)] pt-0">
          <div className="lp-container">
            <PedirSimulator />
          </div>
        </section>

        <section className="lp-section-tight border-y border-[var(--lp-line)] bg-white">
          <div className="lp-container max-w-2xl">
            <h2 className="lp-display text-3xl text-[var(--lp-ink)] sm:text-4xl">Pensado para vos</h2>
            <ul className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--lp-muted)]">
              <li>
                <strong className="text-[var(--lp-ink)]">Condiciones a la vista.</strong> Cuota, TNA y CFT antes de
                pedir.
              </li>
              <li>
                <strong className="text-[var(--lp-ink)]">Todo en un solo lugar.</strong> Solicitud, contrato y pagos
                desde tu cuenta.
              </li>
              <li>
                <strong className="text-[var(--lp-ink)]">Acompañamiento real.</strong> Soporte por formulario y{' '}
                {BRAND.supportEmail}.
              </li>
            </ul>
            <Link href="/pedir/faq" className="mt-8 inline-flex text-sm font-bold text-[var(--lp-signal-deep)] hover:underline">
              Preguntas frecuentes →
            </Link>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container overflow-hidden rounded-[var(--lp-radius-lg)] bg-[var(--lp-ink)] px-6 py-12 text-white sm:px-12">
            <p className="lp-kicker">Listo</p>
            <h2 className="lp-display mt-3 max-w-lg text-4xl sm:text-5xl">Abrí tu cuenta y pedí con tus números</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pedir/solicitud" className="lp-btn lp-btn-primary">
                Empezar solicitud
              </Link>
              <Link href="/pedir/ingresar" className="lp-btn lp-btn-ghost">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PedirFooter />
      <PedirStickyCta />
    </>
  )
}
