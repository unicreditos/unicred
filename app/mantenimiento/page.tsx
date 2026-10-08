import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'En mantenimiento',
  description: 'UNICRÉDITOS está cerrado hasta el próximo despliegue del sitio.',
  robots: { index: false, follow: false },
}

export default function MantenimientoPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#08170F] text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <img src="/logo.svg" alt="UNICRÉDITOS" className="h-12 w-auto self-start" />
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-[#20BD5A]">En mantenimiento</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          El sitio está cerrado.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/70">
          UNICRÉDITOS no está disponible hasta que publiquemos el sitio completo. No se puede ingresar, pedir un
          crédito ni ver la cuenta desde acá.
        </p>
        <a
          href={`mailto:${BRAND.supportEmail}`}
          className="mt-8 inline-flex h-12 w-fit items-center justify-center rounded-full bg-[#20BD5A] px-6 text-base font-semibold text-[#08170F] transition hover:bg-[#3dce70]"
        >
          Escribir a soporte
        </a>
      </div>
      <footer className="mx-auto w-full max-w-lg px-6 pb-8 text-sm text-white/45">
        <p>
          {BRAND.legalName} · CUIT {BRAND.cuit}
        </p>
      </footer>
    </main>
  )
}
