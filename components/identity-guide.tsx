import { IconTile } from '@/components/ui/icon-tile'
import { DEFAULT_KYC_MAX_AGE_MONTHS } from '@/lib/kyc-validity'
import { cn } from '@/lib/utils'
import { CreditCard, ScanFace, ScanLine, ShieldCheck, Smartphone } from 'lucide-react'

/**
 * Guía de la verificación de identidad. Cada afirmación sale de lo que hace el sistema hoy:
 * Didit dentro de la web (DNI de la persona, prueba de vida y coincidencia facial), datos del
 * registro enviados como referencia, mayores de 18, vigencia de 12 meses y estados que devuelve Didit.
 * No promete tiempos ni resultados.
 */
const STEPS = [
  {
    icon: Smartphone,
    t: 'Preparate',
    d: 'Usá el celular o una computadora con cámara y habilitá el permiso de cámara cuando el navegador lo pida. Tené a mano tu DNI argentino, el físico y original.',
  },
  {
    icon: CreditCard,
    t: 'DNI, frente y dorso',
    d: 'Didit lee los datos de tu documento. Tienen que coincidir con el nombre, el DNI y la fecha de nacimiento que cargaste al registrarte.',
  },
  {
    icon: ScanFace,
    t: 'Prueba de vida',
    d: 'Con la cámara frontal comprobás que sos una persona real y no una foto o un video.',
  },
  {
    icon: ScanLine,
    t: 'Coincidencia facial',
    d: 'Didit compara tu cara con la foto de tu DNI. El resultado vuelve a UNICRÉDITOS sin que salgas de la web.',
  },
] as const

const TIPS = [
  'Buena luz, sin reflejos sobre el documento.',
  'Documento entero dentro del encuadre, sin dedos tapando datos.',
  'Rostro descubierto: sin gorra, anteojos oscuros ni barbijo.',
  'Una sola persona frente a la cámara.',
] as const

const RESULTS = [
  { t: 'Identidad verificada', d: 'Queda aprobada y podés solicitar crédito.', tone: 'ok' },
  { t: 'En revisión', d: 'Didit dejó el caso en revisión. Seguís el estado desde tu panel.', tone: 'wait' },
  { t: 'Rechazada', d: 'Ves el motivo en tu panel y podés reintentar la verificación.', tone: 'stop' },
  { t: 'Abandonada', d: 'Si cerrás antes de terminar, retomás desde tu panel.', tone: 'wait' },
] as const

const DOT = { ok: 'bg-emerald-600', wait: 'bg-amber-500', stop: 'bg-rose-600' } as const

export function IdentityGuide({ variant = 'full', className }: { variant?: 'full' | 'compact'; className?: string }) {
  if (variant === 'compact') {
    return (
      <div className={cn('rounded-2xl border border-brand-navy-200 bg-brand-navy-50 p-4 sm:p-5', className)}>
        <p className="flex items-center gap-2 text-sm font-bold text-brand-navy-800">
          <ShieldCheck className="h-4 w-4 stroke-[1.75] text-brand-primary-700" aria-hidden /> Cómo es la verificación
        </p>
        <ol className="mt-3 space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex items-start gap-3 text-sm leading-snug text-brand-navy-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                {i + 1}
              </span>
              <span>
                <strong className="font-semibold text-brand-navy-800">{s.t}.</strong> {s.d}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 border-t border-brand-navy-200 pt-3 text-xs leading-relaxed text-brand-navy-600">
          Es solo para mayores de 18 con DNI argentino. UNICRÉDITOS no recibe fotos ni videos cargados a mano. La
          verificación aprobada vale {DEFAULT_KYC_MAX_AGE_MONTHS} meses.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.t}
            style={{ '--uc-delay': `${i * 70}ms` } as React.CSSProperties}
            className="uc-reveal uc-lift relative rounded-2xl border border-brand-navy-100 bg-paper p-5"
          >
            <div className="flex items-center justify-between">
              <IconTile size="lg">
                <s.icon />
              </IconTile>
              <span className="text-sm font-bold tabular-nums text-brand-navy-300" aria-hidden>
                0{i + 1}
              </span>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-brand-navy-800">{s.t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-navy-600">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-navy-100 bg-white p-5 sm:p-6">
          <h3 className="font-display text-lg font-bold tracking-tight text-brand-navy-800">Recomendaciones</h3>
          <ul className="mt-3 space-y-2">
            {TIPS.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm leading-relaxed text-brand-navy-700">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                {t}
              </li>
            ))}
          </ul>
          <h3 className="mt-6 font-display text-lg font-bold tracking-tight text-brand-navy-800">Quién puede verificarse</h3>
          <p className="mt-2 text-sm leading-relaxed text-brand-navy-700">
            Personas mayores de 18 años con DNI argentino. Didit verifica a una persona, no a una sociedad. La
            verificación aprobada vale {DEFAULT_KYC_MAX_AGE_MONTHS} meses y después se renueva.
          </p>
        </section>

        <section className="rounded-2xl border border-brand-navy-100 bg-white p-5 sm:p-6">
          <h3 className="font-display text-lg font-bold tracking-tight text-brand-navy-800">Qué resultado puede dar</h3>
          <ul className="mt-3 divide-y divide-brand-navy-100">
            {RESULTS.map((r) => (
              <li key={r.t} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span aria-hidden className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT[r.tone])} />
                <div>
                  <p className="text-sm font-semibold text-brand-navy-800">{r.t}</p>
                  <p className="text-sm leading-relaxed text-brand-navy-600">{r.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl bg-brand-navy-50 p-3 text-xs leading-relaxed text-brand-navy-600">
            UNICRÉDITOS no recibe fotos ni videos cargados a mano: la verificación se abre dentro de la web. No
            prometemos un plazo de respuesta; depende de Didit. Tus datos se tratan según la Ley 25.326.
          </p>
        </section>
      </div>
    </div>
  )
}
