import { LiveStatement } from '@/components/landing/live-statement'
import { Button } from '@/components/ui/button'
import { PublicCtaBanner, PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { formatARS } from '@/lib/finance'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { INCOME_DTI_RATIO } from '@/lib/loan-underwriting'
import { pageMetadata } from '@/lib/seo'
import {
  ArrowRight,
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
  title: 'Préstamos personales online',
  description:
    'Préstamo personal online en Argentina. Simulá la cuota con TNA, TEA y CFT a la vista, verificá tu identidad y firmá solo cuando el costo total te cierra.',
  path: '/',
})

const SOURCES = [
  { k: 'BCRA', v: 'Central de Deudores, con tu autorización' },
  { k: 'ARCA', v: 'Validación de tu CUIL y datos fiscales' },
  { k: 'Didit', v: 'DNI y prueba de vida biométrica' },
  { k: 'CBU/CVU', v: 'Titularidad validada antes de transferir' },
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
    d: 'Además de tu contraseña, confirmás con un código de 6 dígitos que te llega por correo o con una app autenticadora. Los códigos vencen y se pueden usar una sola vez.',
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
    a: 'Podés activar la verificación en dos pasos con un código por correo o con una app autenticadora, y ver y cerrar desde tu cuenta las sesiones abiertas en otros dispositivos. Tu identidad se verifica con Didit y la verificación vale 12 meses.',
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-brand-navy-900">
      <PublicHeader />

      <main id="contenido-principal">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_85%_0%,rgba(32,189,90,0.14),transparent_70%)]"
          />
          <div className="relative mx-auto grid w-full max-w-7xl items-start gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-20">
            <div className="min-w-0 lg:col-span-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-navy-200 bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-brand-navy-600">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" /> Préstamos personales · 100% online
              </p>
              <h1 className="mt-6 font-display text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-brand-navy-900 sm:text-6xl lg:text-[4.5rem]">
                Sabé cuánto devolvés. <span className="text-brand-primary-700">Antes de pedir.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-navy-600">
                Elegí monto y plazo, mirá la cuota, la TNA y el CFT reales y recién después creá tu cuenta. Te
                mostramos el costo completo, incluso cuando es alto.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-full px-6 text-base font-semibold">
                  <Link href="/sign-up">
                    Crear mi cuenta <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-brand-navy-200 bg-white px-6 text-base font-semibold"
                >
                  <Link href="/sign-in">Ya tengo cuenta</Link>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-brand-navy-200 pt-6">
                <div>
                  <dt className="text-xs text-brand-navy-500">Hasta</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{formatARS(PERSONAL_QUOTE.maxAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-navy-500">Plazo</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums">
                    {PERSONAL_QUOTE.minTerm} a {PERSONAL_QUOTE.maxTerm}
                    <span className="ml-1 text-sm font-medium text-brand-navy-500">cuotas</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-navy-500">Cuota</dt>
                  <dd className="mt-1 font-display text-2xl font-bold">Fija</dd>
                </div>
              </dl>
            </div>

            <div className="min-w-0 lg:col-span-6 lg:pl-6">
              <LiveStatement />
            </div>
          </div>
        </section>

        {/* Fuentes */}
        <section aria-label="Fuentes de verificación" className="border-y border-brand-navy-200 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-px px-4 sm:px-6 md:grid-cols-4">
            {SOURCES.map((s) => (
              <div key={s.k} className="py-6 md:px-6 md:first:pl-0">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary-700">{s.k}</p>
                <p className="mt-1.5 text-sm leading-snug text-brand-navy-600">{s.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
                  De la simulación a tu cuenta, en cinco pasos.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-brand-navy-600">
                  El orden importa: no firmás nada hasta ver el plan de cuotas completo.
                </p>
              </div>
            </div>
            <ol className="lg:col-span-8">
              {STEPS.map((s, i) => (
                <li key={s.t} className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-brand-navy-200 py-7 first:border-t-0 first:pt-0">
                  <span className="font-mono text-sm tabular-nums text-brand-primary-700">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-2xl font-bold tracking-tight">{s.t}</h3>
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
            <div className="max-w-2xl">
              <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
                Todo lo que firmás queda en tu panel.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-brand-navy-600">
                Contrato, pagaré, cuponera y recibos se generan con tus datos reales y los podés descargar cuando quieras.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DOCUMENTS.map((d) => (
                <article key={d.t} className="rounded-3xl border border-brand-navy-200 bg-paper p-6">
                  <d.icon className="h-6 w-6 text-brand-primary-700" aria-hidden />
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{d.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-navy-600">{d.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Seguridad */}
        <section aria-labelledby="seguridad-titulo" className="border-t border-brand-navy-200 bg-paper">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="max-w-2xl">
              <h2 id="seguridad-titulo" className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
                Tu cuenta y tus datos, protegidos.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-brand-navy-600">
                Controles que ya forman parte de la plataforma, para que solo vos operes con tu identidad.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s) => (
                <article key={s.t} className="rounded-3xl border border-brand-navy-200 bg-white p-6">
                  <s.icon className="h-6 w-6 text-brand-primary-700" aria-hidden />
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-navy-600">{s.d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Reglas */}
        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
                Las reglas, escritas sin letra chica.
              </h2>
              <div className="mt-8 rounded-3xl bg-ink p-6 text-white">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">Costo de referencia</p>
                <p className="mt-3 font-display text-5xl font-bold tabular-nums text-signal-amber">
                  {PERSONAL_QUOTE.cftLabel}
                </p>
                <p className="mt-1 text-sm text-white/65">
                  CFT con IVA sobre intereses (TNA {PERSONAL_QUOTE.tnaLabel}). Es un crédito caro: por eso lo ves completo
                  antes de decidir.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-brand-navy-200 border-y border-brand-navy-200 lg:col-span-7">
              {RULES.map((r) => (
                <li key={r.t} className="flex gap-4 py-6">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-ink">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
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
        <section className="border-t border-brand-navy-200 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:py-24">
            <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] lg:col-span-4">
              Lo que más nos preguntan.
            </h2>
            <div className="lg:col-span-8">
              {FAQ.map((f) => (
                <details key={f.q} className="group border-b border-brand-navy-200 py-5 first:pt-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-2xl font-light text-brand-primary-700 transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-brand-navy-600">{f.a}</p>
                </details>
              ))}
              <Link
                href="/preguntas-frecuentes"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary-700 hover:underline"
              >
                Ver todas las preguntas <ArrowRight className="h-4 w-4" />
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
