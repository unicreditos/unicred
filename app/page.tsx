import { LiveStatement } from '@/components/landing/live-statement'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/ui/icon-tile'
import { PublicCtaBanner, PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { formatARS } from '@/lib/finance'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { INCOME_DTI_RATIO } from '@/lib/loan-underwriting'
import { pageMetadata } from '@/lib/seo'
import { getSetting } from '@/lib/site-config/read'
import {
  ArrowRight,
  Banknote,
  Check,
  FileSignature,
  Fingerprint,
  KeyRound,
  Landmark,
  MonitorSmartphone,
  ScanFace,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = pageMetadata({
  title: 'Plataforma de soluciones financieras',
  description:
    'Plataforma de soluciones financieras en Argentina: préstamo personal online con TNA, TEA y CFT a la vista, pagos de servicios, billetera virtual y red de comercios.',
  path: '/',
})

const SOURCES = [
  { icon: Landmark, k: 'BCRA', v: 'Central de Deudores, con tu autorización' },
  { icon: FileSignature, k: 'ARCA', v: 'Validación de tu CUIL y datos fiscales' },
  { icon: ScanFace, k: 'Didit', v: 'DNI y prueba de vida biométrica' },
  { icon: Banknote, k: 'CBU/CVU', v: 'Titularidad validada antes de transferir' },
] as const

const STEPS = [
  {
    t: 'Simulás sin cuenta',
    d: 'Elegís monto y plazo y ves cuota, TNA, TEA, CFT y total a devolver. Nada de esto te compromete.',
  },
  {
    t: 'Te registrás y verificás identidad',
    d: 'Ingresás tu DNI o CUIL, confirmamos tus datos con ARCA y validás tu cara y tu documento con Didit.',
  },
  {
    t: 'Evaluamos tu perfil',
    d: 'Con tu consentimiento consultamos la Central de Deudores del BCRA y calculamos tu score. El score es solo una recomendación: un analista de la mesa de créditos revisa tu solicitud y decide.',
  },
  {
    t: 'Firmás con todo a la vista',
    d: 'Si calificás, ves el plan de cuotas, el contrato y el pagaré. Firmás desde tu panel, solo si el costo te cierra.',
  },
  {
    t: 'Recibís la plata',
    d: 'Tesorería transfiere a tu CBU o CVU y se generan tus cuotas. Pagás con transferencia y subís el comprobante desde tu panel.',
  },
] as const

const DOCUMENTS = [
  {
    icon: FileSignature,
    t: 'Contrato de mutuo',
    d: 'Con TNA, TEA, CFT y plan de cuotas. Se firma con firma electrónica y queda registrado con fecha, IP, CUIL y la huella digital (SHA-256) de su contenido.',
  },
  {
    icon: ScrollText,
    t: 'Pagaré',
    d: 'Se emite junto al contrato, con el importe en números y letras y el desglose de capital e interés.',
  },
  {
    icon: Landmark,
    t: 'Liquidación y cuponera',
    d: 'La liquidación del desembolso y el talonario de cuotas con sus vencimientos, listos para imprimir.',
  },
  {
    icon: Fingerprint,
    t: 'Recibos y certificados',
    d: 'Un recibo por cada cuota y, al cancelar, libre deuda y constancia de cancelación.',
  },
] as const

const SECURITY = [
  {
    icon: KeyRound,
    t: 'Verificación en dos pasos',
    d: 'Activás una app autenticadora y, además de tu contraseña, confirmás el ingreso con un código de 6 dígitos. El código por correo queda como alternativa. Los códigos vencen y se usan una sola vez.',
  },
  {
    icon: MonitorSmartphone,
    t: 'Sesiones bajo tu control',
    d: 'Ves desde qué dispositivos hay sesiones abiertas y las cerrás a distancia, una por una o todas las demás.',
  },
  {
    icon: ScanFace,
    t: 'Identidad verificada',
    d: 'Validamos tu DNI y tu cara con Didit antes de operar. La verificación vale 12 meses y después se renueva.',
  },
  {
    icon: ShieldCheck,
    t: 'Evidencia con huella de integridad',
    d: 'Cada documento de identidad se guarda con una huella digital SHA-256 y un registro de quién lo consultó, sin sobrescribir versiones anteriores.',
  },
] as const

const RULES = [
  { t: 'Sin punitorios', d: 'Si te atrasás en una cuota no aplicamos intereses punitorios.' },
  { t: 'Sin gastos ni seguros', d: 'No cobramos gastos de otorgamiento ni seguros: el CFT es solo interés más IVA.' },
  {
    t: `Cuota hasta el ${Math.round(INCOME_DTI_RATIO * 100)}% de tu ingreso`,
    d: 'No te ofrecemos una cuota que supere ese tope sobre lo que declarás.',
  },
  { t: '10 días para arrepentirte', d: 'Desde la firma podés revocar el crédito con el botón de arrepentimiento, sin costo.' },
] as const

const FAQ = [
  {
    q: '¿Qué pasa con mis datos del BCRA?',
    a: 'Consultamos la Central de Deudores solo después de que lo autorizás en el registro, y guardamos la fecha y la IP de ese consentimiento. Lo usamos para calcular tu score y la oferta máxima.',
  },
  {
    q: '¿Cuánto tarda la respuesta?',
    a: 'Cada solicitud la revisa y decide una persona de la mesa de créditos; no hay aprobación automática. No prometemos un plazo fijo: depende de la verificación de identidad y de la consulta al BCRA. Te avisamos por correo y ves el estado en tu panel.',
  },
  {
    q: '¿Cómo protegen mi cuenta?',
    a: 'Podés activar la verificación en dos pasos con una app autenticadora (con el código por correo como alternativa), y ver y cerrar desde tu cuenta las sesiones abiertas en otros dispositivos. Tu identidad se verifica con Didit y la verificación vale 12 meses.',
  },
  {
    q: '¿Puedo tener más de un crédito a la vez?',
    a: 'No. Mientras tengas un crédito en evaluación, aprobado o vigente no podés pedir otro. Al cancelarlo, tu historial de pagos puede mejorar tu próxima oferta.',
  },
  {
    q: '¿Cómo pago las cuotas?',
    a: 'Por transferencia a la cuenta de UNICRÉDITOS. Informás el pago y adjuntás el comprobante desde tu panel; lo revisamos y se acredita en tu cuota.',
  },
] as const

export default async function HomePage() {
  // Texto editable desde el backoffice (Configuración y contenido). Sin versión publicada, rige el del código.
  const hero = await getSetting<{ text: string }>('home.hero_subtitle')
  return (
    <div className="min-h-screen bg-paper text-brand-navy-900">
      <PublicHeader />

      <main id="contenido-principal">
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-navy-800 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_88%_0%,rgba(116,172,223,0.30),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(29,95,174,0.22),transparent_70%)]"
          />
          <div aria-hidden className="uc-grid-bg pointer-events-none absolute inset-0" />
          <div className="relative mx-auto grid w-full max-w-7xl items-start gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-20">
            <div className="uc-stagger min-w-0 lg:sticky lg:top-28 lg:col-span-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-white">
                <span className="uc-dot-live h-1.5 w-1.5 rounded-full bg-brand-primary-300" aria-hidden /> Plataforma de soluciones financieras · 100% online
              </p>
              <h1 className="mt-6 text-balance font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.75rem]">
                Sabé cuánto devolvés. <span className="text-brand-primary-300">Antes de pedir.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{hero.value.text}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="uc-shine h-12 rounded-xl px-6 text-base font-semibold shadow-lg shadow-brand-primary/30">
                  <Link href="/sign-up">
                    Crear mi cuenta <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl border-white/40 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/sign-in">Ya tengo cuenta</Link>
                </Button>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
                {['Sin punitorios', 'Sin gastos ni seguros', '10 días para arrepentirte'].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 stroke-[1.75] text-brand-primary-300" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <dl className="mt-9 flex max-w-lg flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
                <div>
                  <dt className="text-xs text-white/65">Hasta</dt>
                  <dd className="mt-1 whitespace-nowrap font-display text-xl font-bold tabular-nums sm:text-2xl">{formatARS(PERSONAL_QUOTE.maxAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/65">Plazo</dt>
                  <dd className="mt-1 whitespace-nowrap font-display text-xl font-bold tabular-nums sm:text-2xl">
                    {PERSONAL_QUOTE.minTerm} a {PERSONAL_QUOTE.maxTerm}
                    <span className="ml-1 text-sm font-medium text-white/65">cuotas</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-white/65">Cuota</dt>
                  <dd className="mt-1 font-display text-xl font-bold sm:text-2xl">Fija</dd>
                </div>
              </dl>
            </div>

            <div className="uc-enter-card min-w-0 lg:col-span-6 lg:pl-6">
              <LiveStatement />
            </div>
          </div>
        </section>

        {/* Fuentes */}
        <section aria-label="Fuentes de verificación" className="border-b border-brand-navy-100 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-x-6 px-4 sm:px-6 md:grid-cols-4">
            {SOURCES.map((s, i) => (
              <div
                key={s.k}
                style={{ '--uc-delay': `${i * 60}ms` } as React.CSSProperties}
                className="uc-reveal flex items-start gap-3.5 py-6 md:border-l md:border-brand-navy-100 md:px-6 md:first:border-l-0 md:first:pl-0"
              >
                <IconTile size="sm">
                  <s.icon />
                </IconTile>
                <div>
                  <p className="text-sm font-bold tracking-wide text-brand-navy-800">{s.k}</p>
                  <p className="mt-0.5 text-sm leading-snug text-brand-navy-600">{s.v}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary-700">Cómo funciona</p>
                <h2 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
                  De la simulación a tu cuenta, en cinco pasos.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-brand-navy-600">
                  El orden importa: no firmás nada hasta ver el plan de cuotas completo.
                </p>
                <Button asChild size="lg" className="uc-shine mt-7 h-12 rounded-xl px-6 text-base font-semibold">
                  <Link href="/simulador">
                    Probar el simulador <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
            <ol className="relative lg:col-span-8">
              <span aria-hidden className="absolute bottom-6 left-[1.4rem] top-6 w-px bg-gradient-to-b from-brand-primary/50 via-brand-navy-200 to-transparent" />
              {STEPS.map((s, i) => (
                <li key={s.t} className="uc-reveal relative grid grid-cols-[2.85rem_1fr] gap-5 pb-10 last:pb-0">
                  <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-sm font-bold tabular-nums text-white shadow-md shadow-brand-primary/30 ring-4 ring-paper">
                    {i + 1}
                  </span>
                  <div className="rounded-2xl border border-brand-navy-100 bg-white p-5 shadow-xs sm:p-6">
                    <h3 className="font-display text-xl font-bold tracking-tight">{s.t}</h3>
                    <p className="mt-2 max-w-xl text-base leading-relaxed text-brand-navy-600">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Documentos */}
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="uc-reveal max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary-700">Documentos</p>
              <h2 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
                Todo lo que firmás queda en tu panel.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-brand-navy-600">
                Contrato, pagaré, cuponera y recibos se generan con tus datos reales y los podés descargar cuando quieras.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DOCUMENTS.map((d, i) => (
                <article
                  key={d.t}
                  style={{ '--uc-delay': `${i * 70}ms` } as React.CSSProperties}
                  className="uc-reveal uc-lift rounded-3xl border border-brand-navy-100 bg-paper p-6"
                >
                  <IconTile size="lg">
                    <d.icon />
                  </IconTile>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{d.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-navy-600">{d.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Seguridad */}
        <section aria-labelledby="seguridad-titulo" className="relative overflow-hidden bg-brand-navy-800 text-white">
          <div aria-hidden className="uc-grid-bg pointer-events-none absolute inset-0 opacity-70" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_100%_0%,rgba(116,172,223,0.25),transparent_70%)]"
          />
          <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="uc-reveal max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary-300">Seguridad</p>
              <h2 id="seguridad-titulo" className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
                Tu cuenta y tus datos, protegidos.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/75">
                Controles que ya forman parte de la plataforma, para que solo vos operes con tu identidad.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s, i) => (
                <article
                  key={s.t}
                  style={{ '--uc-delay': `${i * 70}ms` } as React.CSSProperties}
                  className="uc-reveal rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-brand-primary-300/50 hover:bg-white/[0.09]"
                >
                  <IconTile size="lg" tone="onDark">
                    <s.icon />
                  </IconTile>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{s.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Reglas */}
        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary-700">Transparencia</p>
              <h2 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
                Las reglas, escritas sin letra chica.
              </h2>
              <div className="uc-reveal relative mt-8 overflow-hidden rounded-3xl bg-brand-navy-800 p-6 text-white shadow-xl shadow-brand-navy-800/20">
                <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-primary/30 blur-3xl" />
                <p className="relative text-xs font-semibold uppercase tracking-[0.1em] text-white/65">Costo de referencia</p>
                <p className="relative mt-3 font-display text-5xl font-extrabold tabular-nums text-signal-amber">
                  {PERSONAL_QUOTE.cftLabel}
                </p>
                <p className="relative mt-1 text-sm text-white/70">
                  CFT con IVA sobre intereses (TNA {PERSONAL_QUOTE.tnaLabel}). Es un crédito caro: por eso lo ves completo
                  antes de decidir.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-brand-navy-100 border-y border-brand-navy-100 lg:col-span-7">
              {RULES.map((r, i) => (
                <li
                  key={r.t}
                  style={{ '--uc-delay': `${i * 60}ms` } as React.CSSProperties}
                  className="uc-reveal flex gap-4 py-6"
                >
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm shadow-brand-primary/30">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight">{r.t}</h3>
                    <p className="mt-1 text-base leading-relaxed text-brand-navy-600">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-brand-navy-100 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary-700">Preguntas</p>
              <h2 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.025em]">
                Lo que más nos preguntan.
              </h2>
            </div>
            <div className="lg:col-span-8">
              {FAQ.map((f) => (
                <details key={f.q} className="group border-b border-brand-navy-100 py-5 first:pt-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg font-display text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary-50 text-xl font-light leading-none text-brand-primary-700 transition duration-300 group-open:rotate-45 group-open:bg-brand-primary group-open:text-white"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-brand-navy-600">{f.a}</p>
                </details>
              ))}
              <Link
                href="/preguntas-frecuentes"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary-700 hover:text-brand-primary-800"
              >
                <span className="uc-link">Ver todas las preguntas</span> <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <PublicCtaBanner />
      </main>

      <PublicFooter />
    </div>
  )
}
