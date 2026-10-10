import { Button } from '@/components/ui/button'
import { PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { ArrowRight, Calculator, Home, LifeBuoy, Store } from 'lucide-react'
import Link from 'next/link'

const shortcuts = [
  {
    icon: Calculator,
    title: 'Simulá tu crédito',
    description: 'Elegí monto y plazo, y mirá cuota, TNA y CFT antes de solicitar.',
    href: '/simulador',
  },
  {
    icon: Store,
    title: 'Red de comercios',
    description: 'Financiá compras en comercios adheridos, sin tarjeta.',
    href: '/comercios',
  },
  {
    icon: LifeBuoy,
    title: 'Contacto',
    description: 'Escribinos por formulario o email de soporte.',
    href: '/contacto',
  },
]

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-paper text-brand-navy-900">
      <PublicHeader />

      <main id="contenido-principal" className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-navy-200 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-brand-navy-600">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden /> Error 404
        </p>
        <h1 className="mt-6 text-balance font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
          No encontramos <span className="text-brand-primary-700">esta página.</span>
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-brand-navy-600">
          Puede que el enlace haya cambiado o que la dirección esté mal escrita. Volvé al inicio o seguí con alguno de
          estos accesos.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden /> Volver al inicio
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-xl border-brand-navy-200 bg-white px-6 text-base font-semibold"
          >
            <Link href="/contacto">Hablar con soporte</Link>
          </Button>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-3">
          {shortcuts.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex h-full flex-col gap-2 rounded-3xl border border-brand-navy-200 bg-white p-6 transition hover:border-brand-primary/50"
              >
                <s.icon className="h-6 w-6 text-brand-primary-700" aria-hidden />
                <h2 className="mt-3 font-display text-xl font-bold tracking-tight">{s.title}</h2>
                <p className="text-sm leading-relaxed text-brand-navy-600">{s.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-brand-primary-700">
                  Ir ahora <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <PublicFooter />
    </div>
  )
}
