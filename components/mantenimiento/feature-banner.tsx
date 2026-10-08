'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const SLIDES = [
  {
    kicker: 'Solicitar',
    title: 'Tu crédito, desde el celular',
    text: 'Muy pronto vas a poder pedir el préstamo online, sin sucursal y con el costo a la vista.',
    kind: 'photo' as const,
  },
  {
    kicker: 'Simular',
    title: 'La cuota, antes de decidir',
    text: 'Vas a elegir monto y plazo y ver TNA, TEA y CFT antes de crear la cuenta.',
    kind: 'sim' as const,
  },
  {
    kicker: 'Identidad',
    title: 'Te reconocemos una sola vez',
    text: 'DNI y prueba de vida para que el crédito quede a tu nombre.',
    kind: 'id' as const,
  },
  {
    kicker: 'Firmar',
    title: 'Contrato y pagaré en tu panel',
    text: 'Firmás cuando el plan te cierra. Después quedan los documentos para descargar.',
    kind: 'docs' as const,
  },
  {
    kicker: 'Seguir',
    title: 'Cuotas, pagos y comprobantes',
    text: 'Vas a ver el próximo vencimiento, informar el pago y guardar el recibo.',
    kind: 'pay' as const,
  },
]

const INTERVAL = 5200

export function FeatureBanner() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = SLIDES.length

  const go = useCallback((next: number) => {
    setIndex((next + count) % count)
  }, [count])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || paused) return
    const timer = window.setInterval(() => go(index + 1), INTERVAL)
    return () => window.clearInterval(timer)
  }, [go, index, paused])

  const slide = SLIDES[index]

  return (
    <section aria-roledescription="carrusel" aria-label="Beneficios de la plataforma" className="relative">
      <style>{`@keyframes uc-banner-grow { from { width: 0% } to { width: 100% } }`}</style>
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c2418] shadow-[0_30px_80px_-40px_rgba(32,189,90,0.45)]">
        <div className="relative aspect-[4/5] sm:aspect-[16/9]">
          {SLIDES.map((item, i) => (
            <div
              key={item.kicker}
              className={cn(
                'absolute inset-0 transition-opacity duration-700',
                i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              aria-hidden={i !== index}
            >
              <SlideVisual kind={item.kind} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06140c] via-[#06140c]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#20BD5A]">{item.kicker}</p>
                <h2 className="mt-2 max-w-xl font-display text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">
                  {item.title}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2" role="tablist" aria-label="Elegir beneficio">
          {SLIDES.map((item, i) => (
            <button
              key={item.kicker}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.title}
              onClick={() => go(i)}
              className="group relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15"
            >
              <span
                key={i === index ? `on-${index}-${paused}` : `off-${i}`}
                className="absolute inset-y-0 left-0 rounded-full bg-[#20BD5A]"
                style={
                  i === index && !paused
                    ? { animation: `uc-banner-grow ${INTERVAL}ms linear` }
                    : { width: i === index ? '100%' : '0%' }
                }
              />
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
            aria-label={paused ? 'Reanudar el banner' : 'Pausar el banner'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {slide.kicker}. {slide.title}. {slide.text}
      </p>
    </section>
  )
}

function SlideVisual({ kind }: { kind: (typeof SLIDES)[number]['kind'] }) {
  if (kind === 'photo') {
    return (
      <img
        src="/hero-alt.png"
        alt=""
        className="h-full w-full object-cover object-[70%_center]"
      />
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#071910]">
      <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-[#20BD5A]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#145c38]/40 blur-3xl" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative flex h-full items-center justify-center p-8 pb-36 sm:pb-40">
        {kind === 'sim' ? <SimCard /> : null}
        {kind === 'id' ? <IdCard /> : null}
        {kind === 'docs' ? <DocsCard /> : null}
        {kind === 'pay' ? <PayCard /> : null}
      </div>
    </div>
  )
}

function SimCard() {
  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/8 p-6 backdrop-blur-md">
      <p className="text-sm text-white/60">Pagarías por mes</p>
      <p className="mt-1 font-display text-5xl font-extrabold tracking-[-0.04em] text-white">$ 51.711</p>
      <p className="mt-2 text-sm text-white/55">12 cuotas · $ 400.000</p>
      <div className="mt-6 flex h-16 items-end gap-1.5">
        {[40, 48, 55, 62, 70, 78, 86, 94, 100].map((h) => (
          <span key={h} className="flex-1 rounded-sm bg-[#20BD5A]" style={{ height: `${h}%`, opacity: 0.35 + h / 180 }} />
        ))}
      </div>
    </div>
  )
}

function IdCard() {
  return (
    <div className="grid w-full max-w-lg grid-cols-3 gap-3">
      {['DNI', 'Prueba de vida', 'Cuenta a tu nombre'].map((label, i) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-md">
          <span className="font-mono text-xs text-[#20BD5A]">0{i + 1}</span>
          <p className="mt-6 font-display text-lg font-bold leading-tight text-white">{label}</p>
        </div>
      ))}
    </div>
  )
}

function DocsCard() {
  return (
    <div className="relative h-48 w-full max-w-md">
      {['Pagaré', 'Cuponera', 'Contrato'].map((label, i) => (
        <div
          key={label}
          className="absolute left-1/2 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#10281c]/90 p-5 shadow-2xl backdrop-blur-md"
          style={{ top: i * 28, transform: `translateX(-50%) rotate(${(i - 1) * 3}deg)` }}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#20BD5A]">Documento</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{label}</p>
        </div>
      ))}
    </div>
  )
}

function PayCard() {
  const rows = [
    ['Cuota 4', 'Acreditada'],
    ['Cuota 5', 'Próxima'],
    ['Recibo', 'Listo'],
  ]
  return (
    <div className="w-full max-w-md divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/8 backdrop-blur-md">
      {rows.map(([name, state]) => (
        <div key={name} className="flex items-center justify-between px-5 py-4">
          <span className="font-display text-lg font-bold text-white">{name}</span>
          <span className="rounded-full bg-[#20BD5A]/15 px-3 py-1 text-xs font-semibold text-[#8eefb0]">{state}</span>
        </div>
      ))}
    </div>
  )
}
