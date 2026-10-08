import type { Metadata } from 'next'
import { FeatureBanner } from '@/components/mantenimiento/feature-banner'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'En mantenimiento',
  description:
    'UNICRÉDITOS está en mantenimiento. Muy pronto vas a poder solicitar tu crédito y usar los beneficios de la plataforma.',
  robots: { index: false, follow: false },
}

export default function MantenimientoPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#06140c] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(32,189,90,0.18),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <img src="/logo.svg" alt="UNICRÉDITOS" className="h-12 w-auto sm:h-14" />
          <p className="rounded-full border border-[#20BD5A]/30 bg-[#20BD5A]/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#8eefb0]">
            En mantenimiento
          </p>
        </header>

        <div className="mt-10 max-w-3xl sm:mt-14">
          <h1 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
            Muy pronto vas a poder solicitar tu crédito.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Y usar todos los beneficios de la plataforma. Estamos en mantenimiento para dejarla lista: no está
            cerrada. En breve vas a poder simular, verificarte y pedir el crédito desde acá.
          </p>
        </div>

        <div className="mt-8 sm:mt-10">
          <FeatureBanner />
        </div>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-10 text-sm text-white/45">
          <p>
            {BRAND.legalName} · CUIT {BRAND.cuit}
          </p>
          <a href={`mailto:${BRAND.supportEmail}`} className="text-white/70 underline-offset-4 hover:text-white hover:underline">
            {BRAND.supportEmail}
          </a>
        </footer>
      </div>
    </main>
  )
}
