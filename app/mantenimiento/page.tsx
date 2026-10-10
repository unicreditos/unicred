import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Rosette, Waves } from '@/components/mantenimiento/guilloche'
import { BRAND } from '@/lib/brand'
import { maintenanceEnabled } from '@/lib/maintenance'

export const metadata: Metadata = {
  title: 'Mantenimiento extraordinario',
  description:
    'UNICRÉDITOS está cerrado por mantenimiento extraordinario mientras se termina de desarrollar la plataforma completa.',
  robots: { index: false, follow: false },
}

type Stage = {
  title: string
  detail: string
  state: 'pruebas' | 'desarrollo' | 'listo'
}

/** Editar acá a medida que avanza el desarrollo. */
const UPDATED = '8 de octubre de 2026'

const STAGES: Stage[] = [
  {
    title: 'Simulá tu cuota',
    detail: 'Elegís monto y plazo y ves TNA, TEA y CFT antes de crear la cuenta.',
    state: 'pruebas',
  },
  {
    title: 'Verificá tu identidad',
    detail: 'DNI y prueba de vida, una sola vez, para que el crédito quede a tu nombre.',
    state: 'pruebas',
  },
  {
    title: 'Firmá a distancia',
    detail: 'Contrato y pagaré digitales. Después los descargás cuando quieras.',
    state: 'pruebas',
  },
  {
    title: 'Recibí el dinero',
    detail: 'El desembolso se acredita en una cuenta bancaria a tu nombre.',
    state: 'pruebas',
  },
  {
    title: 'Seguí y pagá tus cuotas',
    detail: 'Próximo vencimiento, pagos y recibos en un solo panel.',
    state: 'desarrollo',
  },
]

const STATE_LABEL: Record<Stage['state'], string> = {
  listo: 'Listo',
  pruebas: 'En pruebas',
  desarrollo: 'En desarrollo',
}

const NOTIFY_HREF = `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent('Avisame cuando abra UNICRÉDITOS')}&body=${encodeURIComponent(
  'Hola, quiero que me avisen cuando el sitio vuelva a estar disponible.\n\nMi nombre:\n',
)}`

const CSS = `
.mx { --paper: #e9eef4; --card: #f6f8fb; --ink: #0a1d36; --green: #0c7c84; --deep: #0f2a4a; --stamp: #d8400f; }
.mx-focus:focus-visible { outline: 3px solid var(--stamp); outline-offset: 3px; }
@keyframes mx-stamp {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(-2deg) scale(1.7); }
  55% { opacity: 1; transform: translate(-50%, -50%) rotate(-10deg) scale(0.96); }
  100% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
}
@keyframes mx-rise {
  from { opacity: 0; transform: translateY(18px) rotate(1.2deg); }
  to { opacity: 1; transform: translateY(0) rotate(0deg); }
}
@keyframes mx-turn { to { transform: rotate(360deg); } }
.mx-coupon { animation: mx-rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.mx-stamp { animation: mx-stamp 0.5s cubic-bezier(0.3, 1.4, 0.5, 1) 0.9s both; filter: url(#mx-ink); }
.mx-rosette { animation: mx-turn 240s linear infinite; }
`

export default function MantenimientoPage() {
  if (!maintenanceEnabled()) redirect('/')
  return (
    <main
      id="contenido-principal"
      className="mx relative min-h-dvh overflow-x-clip bg-[var(--paper)] text-[var(--ink)]"
    >
      <style>{CSS}</style>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <filter id="mx-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
        </filter>
      </svg>

      {/* Hero */}
      <section className="relative isolate">
        <Rosette className="mx-rosette pointer-events-none absolute -left-52 top-24 -z-10 h-[680px] w-[680px] text-[var(--green)] opacity-[0.1] sm:-left-40 sm:opacity-[0.16]" />

        <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-8">
          <header className="flex items-center justify-between gap-4">
            <img src="/logo.svg" alt="UNICRÉDITOS" className="h-11 w-auto rounded-md sm:h-12" />
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="mx-focus hidden rounded-full px-1 font-mono text-xs text-[var(--ink)]/70 sm:inline underline decoration-[var(--ink)]/25 underline-offset-4 transition hover:text-[var(--ink)] sm:text-sm"
            >
              {BRAND.supportEmail}
            </a>
          </header>

          <div className="grid items-center gap-14 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-12 lg:pb-28 lg:pt-20">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.2em] sm:text-xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--stamp)] opacity-60 motion-reduce:animate-none" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--stamp)]" />
                </span>
                Mantenimiento extraordinario
              </p>
              <h1 className="mt-6 font-display text-[clamp(2.6rem,7.4vw,4.9rem)] font-extrabold leading-[0.94] tracking-[-0.05em]">
                Estamos terminando{' '}
                <span className="relative whitespace-nowrap">
                  UNICRÉDITOS
                  <svg
                    viewBox="0 0 300 14"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 h-[0.14em] w-full text-[var(--stamp)]"
                  >
                    <path d="M2 9 C 60 2, 120 13, 180 6 S 270 4, 298 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
                .
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-[var(--ink)]/75">
                El sitio está cerrado mientras desarrollamos la plataforma completa. Cuando abra vas a poder pedir tu
                crédito, verificarte y firmar desde un mismo lugar, con el costo total a la vista antes de aceptar.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a
                  href={NOTIFY_HREF}
                  className="mx-focus inline-flex h-13 items-center justify-center rounded-full bg-[var(--ink)] px-7 py-3.5 text-base font-semibold text-[var(--paper)] transition hover:bg-[var(--deep)]"
                >
                  Avisame cuando abra
                </a>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="mx-focus rounded-full px-1 text-base font-semibold underline decoration-[var(--stamp)] decoration-2 underline-offset-[6px] transition hover:text-[var(--deep)]"
                >
                  Escribir a soporte
                </a>
              </div>
            </div>

            <Coupon />
          </div>
        </div>
      </section>

      {/* Plan de obra */}
      <section aria-labelledby="plan-titulo" className="relative border-t border-[var(--ink)]/15 bg-[var(--card)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] sm:text-xs">Plan de obra</p>
              <h2 id="plan-titulo" className="mt-4 font-display text-4xl font-extrabold leading-[1] tracking-[-0.04em] sm:text-5xl">
                Cinco etapas para abrir.
              </h2>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-[var(--ink)]/70">
                El sitio abre cuando todas estén terminadas, no antes. Así vamos hoy.
              </p>
              <p className="mt-6 font-mono text-xs text-[var(--ink)]/55">Estado al {UPDATED}</p>
            </div>

            <ol className="border-t-2 border-[var(--ink)]">
              {STAGES.map((stage, i) => (
                <li
                  key={stage.title}
                  className="grid grid-cols-[2.75rem_1fr] items-baseline gap-x-3 gap-y-3 border-b border-[var(--ink)]/20 py-6 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-x-5"
                >
                  <span className="font-mono text-sm tabular-nums text-[var(--ink)]/55">
                    {i + 1}/{STAGES.length}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-[-0.02em] sm:text-2xl">{stage.title}</h3>
                    <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-[var(--ink)]/70">{stage.detail}</p>
                  </div>
                  <StateChip state={stage.state} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Contactos */}
      <section aria-label="Contacto" className="border-t border-[var(--ink)]/15">
        <div className="mx-auto grid w-full max-w-6xl gap-px bg-[var(--ink)]/15 sm:grid-cols-2 sm:px-8">
          <ContactBlock
            title="¿Ya tenés un crédito con nosotros?"
            text="Escribinos y te ayudamos con tus cuotas y tus documentos mientras el sitio está cerrado."
            email={BRAND.supportEmail}
          />
          <ContactBlock
            title="¿Tenés un comercio?"
            text="Si querés sumarte a la red cuando abramos, dejanos tu consulta."
            email={BRAND.merchantsEmail}
          />
        </div>
      </section>

      <footer className="bg-[var(--ink)] text-[var(--paper)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8">
          <p className="font-display text-lg font-extrabold tracking-[-0.03em]">UNICRÉDITOS</p>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--paper)]/55">
            Volvemos con la plataforma completa
          </p>
        </div>
      </footer>
    </main>
  )
}

function Coupon() {
  const rows: [string, string][] = [
    ['Emisor', BRAND.company],
    ['Concepto', 'Plataforma de créditos 100% digital'],
    ['Estado', 'En desarrollo'],
    ['Vencimiento', 'Al terminar el desarrollo'],
  ]
  return (
    <aside aria-label="Estado de la reapertura" className="mx-coupon relative mx-auto mb-16 w-full max-w-[32rem] lg:ml-auto">
      <div className="relative grid grid-cols-[3.25rem_1fr] rounded-2xl border border-[var(--ink)]/80 bg-[var(--card)] shadow-[0_28px_60px_-28px_rgba(12,22,18,0.55)]">
        {/* Talón */}
        <div className="relative flex items-center justify-center border-r-2 border-dashed border-[var(--ink)]/40">
          <p className="rotate-180 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink)]/55 [writing-mode:vertical-rl]">
            Conservá este talón
          </p>
          <span className="absolute -top-px left-full h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--ink)]/80 bg-[var(--paper)] [clip-path:inset(50%_0_0_0)]" />
          <span className="absolute -bottom-px left-full h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border border-[var(--ink)]/80 bg-[var(--paper)] [clip-path:inset(0_0_50%_0)]" />
        </div>

        <div className="min-w-0 overflow-hidden rounded-r-2xl">
          <div className="relative h-20 bg-[var(--deep)] text-[#5ab6bc]">
            <Waves className="absolute inset-0 h-full w-full opacity-70" />
            <div className="relative flex h-full flex-wrap items-end justify-between gap-x-4 px-5 pb-3 text-[var(--paper)]">
              <p className="font-display text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">Cupón de reapertura</p>
              <p className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--paper)]/70">Serie M · N.º 0001</p>
            </div>
          </div>

          <dl className="space-y-3.5 px-5 py-6">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-3">
                <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink)]/55">{label}</dt>
                <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--ink)]/35" />
                <dd className="text-right text-[15px] font-semibold leading-snug">{value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t-2 border-[var(--ink)] pt-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink)]/55">Importe a pagar</dt>
              <dd className="font-display text-4xl font-extrabold tabular-nums tracking-[-0.04em]">$ 0,00</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Sello */}
      <div
        aria-label="Sello: mantenimiento extraordinario"
        role="img"
        className="mx-stamp pointer-events-none absolute left-[64%] top-[108%] z-10 select-none mix-blend-multiply"
      >
        <div className="rounded-lg border-[3px] border-[var(--stamp)] p-1 text-[var(--stamp)]">
          <div className="rounded-[0.35rem] border border-[var(--stamp)] px-4 py-2 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]">Sitio cerrado</p>
            <p className="font-display text-2xl font-extrabold uppercase leading-none tracking-[-0.01em] sm:text-3xl">
              Mantenimiento
            </p>
            <p className="font-display text-lg font-extrabold uppercase leading-tight tracking-[0.12em] sm:text-xl">
              Extraordinario
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function StateChip({ state }: { state: Stage['state'] }) {
  const tone =
    state === 'listo'
      ? 'bg-[var(--deep)] text-[var(--paper)]'
      : state === 'pruebas'
        ? 'border border-[var(--deep)] text-[var(--deep)]'
        : 'border border-[var(--stamp)] text-[#a52e08]'
  const dot = state === 'listo' ? 'bg-[#5ab6bc]' : state === 'pruebas' ? 'bg-[var(--green)]' : 'bg-[var(--stamp)]'
  return (
    <span
      className={`col-start-2 inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:col-start-3 ${tone}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {STATE_LABEL[state]}
    </span>
  )
}

function ContactBlock({ title, text, email }: { title: string; text: string; email: string }) {
  return (
    <div className="bg-[var(--paper)] px-5 py-10 sm:py-12">
      <h3 className="font-display text-2xl font-bold tracking-[-0.03em]">{title}</h3>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--ink)]/70">{text}</p>
      <a
        href={`mailto:${email}`}
        className="mx-focus mt-4 inline-block rounded font-mono text-sm font-medium underline decoration-[var(--stamp)] decoration-2 underline-offset-4 transition hover:text-[var(--deep)]"
      >
        {email}
      </a>
    </div>
  )
}
