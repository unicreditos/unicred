import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Check,
  FileSignature,
  Landmark,
  Receipt,
  ScrollText,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicCtaBanner, PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { InteractiveHeroSimulator } from '@/components/landing/interactive-hero-simulator'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { INCOME_DTI_RATIO } from '@/lib/loan-underwriting'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Préstamos personales 100% online · UNICRÉDITOS',
  description:
    'Préstamos personales en Argentina con cuotas fijas en pesos y acreditación inmediata en tu CBU/CVU. Simulá en tiempo real con TNA, TEA y CFT 100% transparentes.',
  path: '/',
})

const TRUST_METRICS = [
  { label: 'Tiempo medio de acreditación', value: '15 min', sub: 'directo a tu cuenta' },
  { label: 'Cuotas fijas en pesos', value: '100%', sub: 'sin sorpresas por inflación' },
  { label: 'Proceso digital', value: '0 papel', sub: 'con firma electrónica' },
  { label: 'Arrepentimiento legal', value: '10 días', sub: 'sin costo (Ley 24.240)' },
]

const SOURCES = [
  { k: 'BCRA', title: 'Central de Deudores', desc: 'Consulta oficial regulada con tu consentimiento previo.' },
  { k: 'ARCA', title: 'Validación Fiscal', desc: 'Confirmación instantánea de CUIL y categoría impositiva.' },
  { k: 'Didit', title: 'Biometría Facial', desc: 'Validación de DNI y prueba de vida con los más altos estándares.' },
  { k: 'COELSA', title: 'CBU / CVU Titular', desc: 'Acreditación bancaria segura únicamente en cuentas a tu nombre.' },
]

const PRODUCTS = [
  {
    icon: Wallet,
    title: 'Préstamo Personal',
    badge: 'Más solicitado',
    description: 'Para libre destino: consolidar deudas, arreglos del hogar, viajes o proyectos personales.',
    amount: 'Hasta $2.500.000',
    term: 'De 3 a 24 cuotas fijas',
    rate: `TNA ${PERSONAL_QUOTE.tnaLabel}`,
    href: '/sign-up',
    cta: 'Pedir préstamo',
  },
  {
    icon: Building2,
    title: 'Crédito para Comercios',
    badge: 'Emprendedores',
    description: 'Capital de trabajo para compra de mercadería, equipamiento o cobro en cuotas a tus clientes.',
    amount: 'Hasta $5.000.000',
    term: 'De 6 a 36 cuotas fijas',
    rate: 'Línea productiva PyME',
    href: '/comercios',
    cta: 'Conocer línea comercio',
  },
  {
    icon: Zap,
    title: 'Adelanto Inmediato',
    badge: 'Respuesta express',
    description: 'Para imprevistos y emergencias del mes con liquidación urgente y pocos requisitos.',
    amount: 'Hasta $300.000',
    term: 'De 1 a 3 cuotas',
    rate: 'Aprobación en el acto',
    href: '/sign-up',
    cta: 'Solicitar adelanto',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Simulás tu crédito a medida',
    desc: 'Elegís el monto exacto y el plazo en cuotas. Ves en vivo el valor de la cuota fija, la tasa nominal, el costo financiero total y el cronograma estimado sin registrarte.',
  },
  {
    step: '02',
    title: 'Cargás tus datos y validás identidad',
    desc: 'Completás tu CUIL y realizás la prueba biométrica con tu celular en 1 minuto. Validación instantánea y segura para proteger tu identidad contra fraudes.',
  },
  {
    step: '03',
    title: 'Evaluación crediticia al instante',
    desc: 'Analizamos tu historial con la Central de Deudores del BCRA y scoring crediticio automatizado. Te presentamos la mejor oferta adaptada a tus ingresos.',
  },
  {
    step: '04',
    title: 'Firmás online y recibís los fondos',
    desc: 'Leés el contrato de mutuo y el pagaré digital. Al aceptar con tu firma electrónica, la tesorería transfiere el dinero directo a tu CBU o CVU.',
  },
]

const DOCUMENTS = [
  {
    icon: FileSignature,
    title: 'Contrato de mutuo',
    desc: 'Detalla el capital, TNA, TEA, CFT y el cuadro de amortización completo. Firmado con validez legal digital.',
  },
  {
    icon: ScrollText,
    title: 'Pagaré electrónico',
    desc: 'Emitido a la par del contrato con el importe en letras y números según la ley cambiaria argentina.',
  },
  {
    icon: Landmark,
    title: 'Liquidación y cuponera',
    desc: 'Comprobante formal del desembolso y el listado de cada vencimiento listo para descargar o imprimir.',
  },
  {
    icon: Receipt,
    title: 'Recibos de pago oficiales',
    desc: 'Cada vez que abonás una cuota por transferencia o Mercado Pago, se genera tu recibo oficial con imputación.',
  },
]

const TRANSPARENCY_RULES = [
  {
    title: 'Cuotas fijas en pesos (Sistema Francés)',
    desc: 'Sabés con total certeza cuánto vas a pagar cada mes desde el primer día hasta la cancelación.',
  },
  {
    title: 'Sin cobros sorpresa ni comisiones ocultas',
    desc: 'No te cobramos gastos de otorgamiento, gastos de mantenimiento de cuenta ni seguros no solicitados.',
  },
  {
    title: `Capacidad de pago responsable (Tope ${Math.round(INCOME_DTI_RATIO * 100)}% de ingresos)`,
    desc: 'Cuidamos tu salud financiera: la cuota mensual nunca superará tu capacidad de endeudamiento declarada.',
  },
  {
    title: 'Cancelación anticipada y pagos parciales',
    desc: 'Podés adelantar cuotas o cancelar el total en cualquier momento descontando intereses futuros según el Código Civil y Comercial.',
  },
  {
    title: 'Derecho de arrepentimiento a 10 días',
    desc: 'Conforme a la Ley 24.240, contás con 10 días corridos para revocar la operación sin costo alguno.',
  },
]

const FAQ_ITEMS = [
  {
    q: '¿Cuáles son los requisitos básicos para pedir un préstamo?',
    a: 'Tener más de 18 años, contar con DNI argentino vigente, CUIL/CUIT, una cuenta bancaria con CBU o billetera virtual homologada con CVU a tu nombre, e ingresos demostrables o actividad comercial.',
  },
  {
    q: '¿Cómo y cuándo recibo el dinero en mi cuenta?',
    a: 'Una vez completada la verificación biométrica y firmado electrónicamente el contrato de mutuo, tesorería emite la transferencia inmediata a tu CBU o CVU declarado. Generalmente se acredita en pocos minutos.',
  },
  {
    q: '¿Cómo se pagan las cuotas mes a mes?',
    a: 'Podés abonar de forma muy sencilla desde tu panel de cliente con Mercado Pago (débito, dinero en cuenta) o mediante transferencia bancaria con CBU/alias oficial de UNICRÉDITOS, subiendo el comprobante para su acreditación inmediata.',
  },
  {
    q: '¿Puedo adelantar cuotas o pagar de forma parcial?',
    a: 'Sí. Contás con una Calculadora de Pago Parcial y Cancelación Anticipada en tu panel. Podés pagar una parte de la cuota o amortizar capital puro, reduciendo el saldo pendiente e intereses futuros.',
  },
  {
    q: '¿Qué información consultan en el BCRA?',
    a: 'Únicamente consultamos tu situación crediticia en la Central de Deudores del Banco Central luego de que nos brindás tu autorización explícita durante el registro, protegiendo tus datos personales conforme a la Ley 25.326.',
  },
  {
    q: '¿Qué pasa si necesito ayuda o tengo una consulta?',
    a: 'Nuestro equipo de soporte atiende a través del centro de ayuda en tu panel, por correo a soporte@unicreditos.com.ar y mediante el formulario de contacto oficial.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FBFDFB] text-slate-900 selection:bg-emerald-500 selection:text-white">
      <PublicHeader />

      <main id="contenido-principal">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
          {/* Subtle Ambient Background Gradients */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.12),transparent_75%)]"
          />

          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Left Column: Headline and Call to Actions */}
              <div className="lg:col-span-6 xl:col-span-7">
                {/* Clean Unboxed Metadata Kicker (Anti-pill) */}
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-emerald-800">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Préstamos personales 100% online</span>
                  <span aria-hidden className="text-slate-300">·</span>
                  <span>Acreditación en CBU/CVU</span>
                </div>

                <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
                  Tu dinero hoy. <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-emerald-700 to-teal-800 bg-clip-text text-transparent">
                    Cuotas fijas en pesos
                  </span>{' '}
                  y total claridad.
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                  Simulá tu cuota en segundos con tasas reales a la vista. Sin letra chica, sin comisiones ocultas y con
                  desembolso directo en tu cuenta bancaria o billetera virtual.
                </p>

                {/* Primary CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="h-13 rounded-2xl bg-emerald-600 px-7 text-base font-bold text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-700 transition"
                  >
                    <Link href="/sign-up">
                      Pedir mi préstamo <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-13 rounded-2xl border-slate-300 bg-white px-7 text-base font-semibold text-slate-800 hover:bg-slate-50 transition"
                  >
                    <Link href="/sign-in">Iniciar sesión</Link>
                  </Button>
                </div>

                {/* Live Metrics Grid */}
                <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-200 pt-8 sm:grid-cols-4">
                  {TRUST_METRICS.map((m) => (
                    <div key={m.label} className="space-y-1">
                      <p className="font-mono text-2xl font-extrabold text-slate-900">{m.value}</p>
                      <p className="text-xs font-semibold text-slate-800">{m.label}</p>
                      <p className="text-[11px] text-slate-500">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Live Interactive Simulator */}
              <div className="lg:col-span-6 xl:col-span-5">
                <InteractiveHeroSimulator />
              </div>
            </div>
          </div>
        </section>

        {/* TRUST AND VERIFICATION SOURCES STRIP */}
        <section aria-label="Validaciones y fuentes oficiales" className="border-y border-slate-200 bg-white py-8">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 mb-6">
              Infraestructura segura conectada con fuentes oficiales
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SOURCES.map((s) => (
                <div key={s.k} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-mono text-xs font-bold text-emerald-800">
                    {s.k}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{s.title}</h4>
                    <p className="mt-1 text-xs text-slate-600 leading-snug">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRODUCT FINANCING LINES */}
        <section id="lineas" className="py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Soluciones a tu medida
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
                Nuestras líneas de financiación
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Opciones diseñadas para personas, comerciantes y proyectos con requisitos claros y desembolso ágil.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {PRODUCTS.map((prod) => (
                <div
                  key={prod.title}
                  className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md hover:border-emerald-300"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <prod.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-medium text-slate-500 tracking-wide">{prod.badge}</span>
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-slate-900">{prod.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{prod.description}</p>

                    <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Monto disponible</span>
                        <span className="font-bold font-mono text-slate-900">{prod.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Plazo en cuotas</span>
                        <span className="font-bold text-slate-900">{prod.term}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tasa de interés</span>
                        <span className="font-semibold text-emerald-700">{prod.rate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <Button asChild className="w-full rounded-xl bg-slate-900 text-white hover:bg-emerald-700 transition">
                      <Link href={prod.href}>{prod.cta}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS: 4 STEPS */}
        <section id="como-funciona" className="border-t border-slate-200 bg-slate-50/70 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Paso a paso transparente
                </span>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
                  De la simulación al dinero en tu cuenta en 4 pasos.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-slate-600">
                  Diseñamos un flujo 100% digital donde siempre tenés el control. Sabés exactamente cuánto devolvés antes
                  de aceptar cualquier condición.
                </p>

                <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">Sin costo de apertura ni anticipos</h4>
                      <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                        Nunca te pediremos que transfieras dinero antes de recibir tu crédito. Toda gestión es gratuita.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button asChild size="lg" className="rounded-2xl bg-emerald-600 px-6 font-bold hover:bg-emerald-700">
                    <Link href="/sign-up">Comenzar ahora</Link>
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-7">
                <ol className="space-y-6">
                  {STEPS.map((s) => (
                    <li
                      key={s.step}
                      className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-mono text-sm font-bold text-emerald-800">
                        {s.step}
                      </span>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* TRANSPARENCY RULES & LEGAL CLARITY */}
        <section className="py-20 sm:py-28 bg-white border-t border-slate-200">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 items-center">
              <div className="lg:col-span-5">
                <div className="rounded-3xl bg-[#081810] p-8 text-white shadow-xl">
                  <span className="font-mono text-xs uppercase tracking-widest text-emerald-400">
                    Compromiso de Transparencia
                  </span>
                  <h3 className="mt-4 text-2xl font-bold">Sin letra chica ni costos ocultos</h3>
                  <p className="mt-3 text-sm text-white/70 leading-relaxed">
                    Operamos bajo el Régimen de Transparencia y la Ley de Defensa del Consumidor (Ley 24.240). Todos los
                    costos se muestran desglosados en pantalla.
                  </p>

                  <div className="mt-8 rounded-2xl bg-white/5 p-5 border border-white/10 space-y-3">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="text-white/60">TNA (Tasa Nominal Anual):</span>
                      <span className="font-mono font-bold text-white">{PERSONAL_QUOTE.tnaLabel}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="text-white/60">TEA (Tasa Efectiva Anual):</span>
                      <span className="font-mono font-bold text-white">{PERSONAL_QUOTE.teaLabel}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-sm border-t border-white/10 pt-2 font-bold">
                      <span className="text-amber-400">CFT (Costo Financiero Total):</span>
                      <span className="font-mono text-amber-400 text-base">{PERSONAL_QUOTE.cftLabel}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <h2 className="text-3xl font-extrabold text-slate-950 sm:text-4xl">
                  Nuestras reglas claras y éticas
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  Créditos responsables orientados al bienestar financiero del usuario.
                </p>

                <ul className="mt-8 space-y-4">
                  {TRANSPARENCY_RULES.map((rule) => (
                    <li key={rule.title} className="flex items-start gap-3.5">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{rule.title}</h4>
                        <p className="mt-0.5 text-sm text-slate-600">{rule.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* DIGITAL DOCUMENTS SECTION */}
        <section className="border-t border-slate-200 bg-slate-50/60 py-20 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Tu documentación a un clic
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
                Todo lo que firmás queda registrado en tu panel.
              </h2>
              <p className="mt-4 text-base text-slate-600">
                Disponibilidad inmediata para descargar o imprimir cuando lo requieras: contratos, pagarés, liquidaciones
                y comprobantes oficiales de cada cuota.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {DOCUMENTS.map((doc) => (
                <div key={doc.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <doc.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-900">{doc.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{doc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INTERACTIVE FAQ ACCORDION */}
        <section id="faq" className="border-t border-slate-200 bg-white py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Preguntas Frecuentes</span>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
                  Respuestas claras a tus dudas.
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  Si tenés una consulta puntual sobre tu crédito vigente o el proceso de solicitud, revisá nuestras
                  respuestas más habituales.
                </p>

                <div className="mt-8">
                  <Button asChild variant="outline" className="rounded-xl border-slate-300">
                    <Link href="/preguntas-frecuentes">
                      Ver todas las preguntas <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-8 divide-y divide-slate-200">
                {FAQ_ITEMS.map((item) => (
                  <details key={item.q} className="group py-5 first:pt-0">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base sm:text-lg font-bold text-slate-900 hover:text-emerald-700 transition [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-open:rotate-45 group-open:bg-emerald-100 group-open:text-emerald-800 transition">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PUBLIC CTA BANNER */}
        <PublicCtaBanner />
      </main>

      <PublicFooter />
    </div>
  )
}
