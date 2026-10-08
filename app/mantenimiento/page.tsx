import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'En mantenimiento',
  description: 'UNICRÉDITOS está en mantenimiento. Si ya tenés un crédito, podés ingresar a tu cuenta.',
  robots: { index: false, follow: false },
}

export default function MantenimientoPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#08170F] text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <img src="/logo.svg" alt="UNICRÉDITOS" className="h-12 w-auto self-start" />
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.22em] text-[#20BD5A]">En mantenimiento</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          Estamos revisando el sitio.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/70">
          Por ahora no se pueden iniciar solicitudes nuevas desde acá. Si ya tenés un crédito, tu cuenta sigue
          disponible para ver cuotas, documentos y comprobantes.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#20BD5A] px-6 text-base font-semibold text-[#08170F] transition hover:bg-[#3dce70]"
          >
            Ingresar a mi cuenta
          </Link>
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-base font-semibold text-white transition hover:bg-white/5"
          >
            Escribir a soporte
          </a>
        </div>
      </div>
      <footer className="mx-auto w-full max-w-lg px-6 pb-8 text-sm text-white/45">
        <p>
          {BRAND.legalName} · CUIT {BRAND.cuit}
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/legal/arrepentimiento" className="underline-offset-4 hover:text-white hover:underline">
            Botón de arrepentimiento
          </Link>
          <Link href="/legal/baja" className="underline-offset-4 hover:text-white hover:underline">
            Botón de baja
          </Link>
          <Link href="/legal/privacidad" className="underline-offset-4 hover:text-white hover:underline">
            Privacidad
          </Link>
        </p>
      </footer>
    </main>
  )
}
