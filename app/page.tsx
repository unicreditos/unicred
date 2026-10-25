import { Guilloche } from '@/components/landing/guilloche'
import { LiveStatement } from '@/components/landing/live-statement'
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
    'Plataforma de soluciones financieras en Argentina: préstamo personal online con TNA, TEA y CFT a la vista, y financiación para comercios.',
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
        {/* Hero: la promesa (ver el costo completo antes de pedir) y el comprobante que la cumple */}
        <section className="relative overflow-hidden bg-brand-navy-800 text-white">
          <Guilloche className="absolute -right-56 -top-40 h-[64rem] w-[64rem] lg:-right-24" />
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:gap-12 lg:pb-28 lg:pt-24">
            <div className="uc-stagger min-w-0 lg:col-span-7">
              <p className="inline-flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-brand-primary-300">
                <span className="uc-dot-live h-1.5 w-1.5 rounded-full bg-signal-amber" aria-hidden /> Plataforma de soluciones financieras
              </p>
              <h1 className="mt-6 text-balance font-display text-[3.1rem] font-extrabold leading-[0.95] tracking-[-0.035em] text-white sm:text-7xl lg:text-[4.6rem] xl:text-[5.25rem]">
                Sabé cuánto devolvés. <span className="text-brand-primary-300 sm:whitespace-nowrap">Antes de pedir.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/75 sm:text-xl">{hero.value.text}</p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  href="/sign-up"
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-brand-primary-300 px-7 text-base font-semibold text-brand-navy-900 shadow-lg shadow-black/20 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-800"
                >
                  Crear mi cuenta <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Link href="/sign-in" className="text-base font-semibold text-white/85 underline-offset-[6px] hover:text-white hover:underline">
                  Ya tengo cuenta
                </Link>
              </div>
              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-6">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Hasta</dt>
                  <dd className="mt-1.5 whitespace-nowrap font-display text-xl font-bold tabular-nums sm:text-2xl">{formatARS(PERSONAL_QUOTE.maxAmount)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Plazo</dt>
                  <dd className="mt-1.5 whitespace-nowrap font-display text-xl font-bold tabular-nums sm:text-2xl">
                    {PERSONAL_QUOTE.minTerm}–{PERSONAL_QUOTE.maxTerm}
                    <span className="ml-1 text-sm font-medium text-white/55">cuotas</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">Cuota</dt>
                  <dd className="mt-1.5 font-display text-xl font-bold sm:text-2xl">Fija</dd>
                </div>
              </dl>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/65">
                {['Sin punitorios', 'Sin gastos ni seguros', '10 días para arrepentirte'].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-brand-primary-300" strokeWidth={3} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="uc-enter-card min-w-0 lg:col-span-5">
              <LiveStatement className="mx-auto max-w-[34rem]" />
            </div>
          </div>
        </section>

        {/* Fuentes: con quién se verifica cada dato, como el pie de un comprobante */}
        <section aria-label="Fuentes de verificación" className="border-b border-brand-navy-100 bg-white">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-10">
            <p className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-navy-500">Verificamos con</p>
            <ul className="grid flex-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {SOURCES.map((s, i) => (
                <li
                  key={s.k}
                  style={{ '--uc-delay': `${i * 60}ms` } as React.CSSProperties}
                  className="uc-reveal flex items-start gap-3"
                >
                  <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" aria-hidden />
                  <div>
                    <p className="font-display text-base font-bold tracking-tight text-brand-navy-900">{s.k}</p>
                    <p className="mt-0.5 text-sm leading-snug text-brand-navy-600">{s.v}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cómo funciona: cinco pasos numerados como renglones de un extracto */}
        <section id="como-funciona" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-700">Cómo funciona</p>
                <h2 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
                  De la simulación a tu cuenta, en cinco pasos.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-brand-navy-600">
                  El orden importa: no firmás nada hasta ver el plan de cuotas completo.
                </p>
                <Link
                  href="/simulador"
                  className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand-navy-900 px-6 text-base font-semibold text-white transition hover:bg-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                >
                  Probar el simulador <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>
            <ol className="border-t border-brand-navy-900 lg:col-span-8">
              {STEPS.map((s, i) => (
                <li
                  key={s.t}
                  style={{ '--uc-delay': `${i * 50}ms` } as React.CSSProperties}
                  className="uc-reveal group grid grid-cols-[3.5rem_1fr] gap-4 border-b border-brand-navy-100 py-8 sm:grid-cols-[6rem_1fr] sm:gap-6"
                >
                  <span className="font-mono text-sm font-semibold tabular-nums text-brand-primary-700 sm:pt-1.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-bold tracking-[-0.02em] transition group-hover:text-brand-primary-700 sm:text-[1.7rem]">
                      {s.t}
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-relaxed text-brand-navy-600">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Documentos: cada uno como una hoja con su membrete */}
        <section className="border-y border-brand-navy-100 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="uc-reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-700">Documentos</p>
                <h2 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
                  Todo lo que firmás queda en tu panel.
                </h2>
              </div>
              <p className="max-w-sm text-base leading-relaxed text-brand-navy-600">
                Contrato, pagaré, cuponera y recibos se generan con tus datos reales y los podés descargar cuando quieras.
              </p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {DOCUMENTS.map((d, i) => (
                <article
                  key={d.t}
                  style={{ '--uc-delay': `${i * 70}ms` } as React.CSSProperties}
                  className="uc-reveal uc-lift relative flex flex-col overflow-hidden rounded-2xl border border-brand-navy-100 bg-paper"
                >
                  <div className="flex items-center justify-between border-b border-dashed border-brand-navy-200 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-brand-navy-500">
                    <span>Doc. {String(i + 1).padStart(2, '0')}</span>
                    <d.icon className="h-4 w-4 text-brand-primary" aria-hidden />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-xl font-bold tracking-tight">{d.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-brand-navy-600">{d.d}</p>
                    <div className="mt-auto space-y-1.5 pt-6" aria-hidden>
                      <span className="block h-1 w-full rounded-full bg-brand-navy-100" />
                      <span className="block h-1 w-4/5 rounded-full bg-brand-navy-100" />
                      <span className="block h-1 w-2/5 rounded-full bg-brand-primary/40" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Seguridad */}
        <section aria-labelledby="seguridad-titulo" className="relative overflow-hidden bg-brand-navy-800 text-white">
          <Guilloche className="absolute -bottom-72 -left-72 h-[52rem] w-[52rem]" petals={28} />
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-28">
            <div className="uc-reveal lg:col-span-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-300">Seguridad</p>
              <h2 id="seguridad-titulo" className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
                Tu cuenta y tus datos, protegidos.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/70">
                Controles que ya forman parte de la plataforma, para que solo vos operes con tu identidad.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:col-span-8">
              {SECURITY.map((s, i) => (
                <article
                  key={s.t}
                  style={{ '--uc-delay': `${i * 70}ms` } as React.CSSProperties}
                  className="uc-reveal bg-brand-navy-800 p-7 transition duration-300 hover:bg-brand-navy-700"
                >
                  <IconTile size="lg" tone="onDark">
                    <s.icon />
                  </IconTile>
                  <h3 className="mt-6 font-display text-xl font-bold tracking-tight">{s.t}</h3>
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
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-700">Transparencia</p>
              <h2 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
                Las reglas, escritas sin letra chica.
              </h2>
              <div className="uc-reveal relative mt-10 overflow-hidden rounded-3xl bg-brand-navy-900 p-7 text-white">
                <Guilloche className="absolute -right-24 -top-24 h-72 w-72" petals={24} />
                <p className="relative font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Costo de referencia</p>
                <p className="relative mt-3 font-display text-6xl font-extrabold tracking-[-0.03em] tabular-nums text-signal-amber">
                  {PERSONAL_QUOTE.cftLabel}
                </p>
                <p className="relative mt-2 text-sm leading-relaxed text-white/70">
                  CFT con IVA sobre intereses (TNA {PERSONAL_QUOTE.tnaLabel}). Es un crédito caro: por eso lo ves completo
                  antes de decidir.
                </p>
              </div>
            </div>
            <ul className="border-t border-brand-navy-900 lg:col-span-7">
              {RULES.map((r, i) => (
                <li
                  key={r.t}
                  style={{ '--uc-delay': `${i * 60}ms` } as React.CSSProperties}
                  className="uc-reveal flex gap-5 border-b border-brand-navy-100 py-7"
                >
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy-900 text-white">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">{r.t}</h3>
                    <p className="mt-1.5 text-base leading-relaxed text-brand-navy-600">{r.d}</p>
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
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-700">Preguntas</p>
              <h2 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
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
