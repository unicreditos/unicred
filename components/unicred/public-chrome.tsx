'use client'

import { Guilloche } from '@/components/landing/guilloche'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { BRAND, GROUP, groupOperatorLine, groupSiblingUnits } from '@/lib/brand'
import { useSession } from '@/lib/auth-client'
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export const PUBLIC_NAV = [
  { label: 'Inicio', href: '/' },
  { label: 'Créditos', href: '/prestamos' },
  { label: 'Simulador', href: '/simulador' },
  { label: 'Preguntas', href: '/preguntas-frecuentes' },
  { label: 'Contacto', href: '/contacto' },
] as const

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function PublicHeader() {
  const { data: session, isPending } = useSession()
  const pathname = usePathname()
  const [accountHref, setAccountHref] = useState('/dashboard')
  const [open, setOpen] = useState(false)
  const isLoggedIn = !isPending && Boolean(session?.user)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    let cancel = false
    fetch('/api/me/dashboard-url', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { dashboardUrl?: string }) => {
        if (cancel || !data.dashboardUrl || data.dashboardUrl === '/sign-in') return
        setAccountHref(data.dashboardUrl)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [session?.user?.id])

  const accountLabel = accountHref === '/admin' ? 'Administración' : 'Mi cuenta'

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy-800 text-white">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        <BrandLogo showText light />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {PUBLIC_NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-3.5 py-5 text-sm font-medium transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-300',
                  active ? 'text-white' : 'text-white/75',
                )}
              >
                {item.label}
                {active ? <span aria-hidden className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-brand-primary-300" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {isLoggedIn ? (
            <Button asChild size="lg" className="h-10 rounded-full px-3 font-semibold sm:px-4">
              <Link href={accountHref}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="sm:hidden">{accountHref === '/admin' ? 'Admin' : 'Mi cuenta'}</span>
                <span className="hidden sm:inline">{accountLabel}</span>
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="hidden h-10 rounded-full border-white/40 bg-transparent px-4 font-semibold text-white hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link href="/sign-in">Iniciar sesión</Link>
              </Button>
              <Button asChild size="lg" className="h-10 rounded-full px-3 font-semibold sm:px-4">
                <Link href="/sign-up">
                  Pedir crédito <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                </Link>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-white/10 bg-brand-navy-800 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3 sm:px-6" aria-label="Móvil">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-3 text-base font-medium hover:bg-white/10',
                  isActive(pathname, item.href) ? 'text-white' : 'text-white/80',
                )}
              >
                {item.label}
              </Link>
            ))}
            {!isLoggedIn ? (
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-semibold text-brand-primary-300 hover:bg-white/10"
              >
                Iniciar sesión
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  )
}

const FOOTER_COLUMNS = [
  {
    title: 'Crédito',
    links: [
      { label: 'Préstamo personal', href: '/prestamos' },
      { label: 'Simulador', href: '/simulador' },
      { label: 'Evaluación BCRA', href: '/scoring' },
      { label: 'Verificación de identidad', href: '/verificacion-de-identidad' },
      { label: 'Costos y CFT', href: '/legal/tasas' },
      { label: 'Pedir crédito', href: '/sign-up' },
    ],
  },
  {
    title: 'Tus derechos',
    links: [
      { label: 'Botón de arrepentimiento', href: '/legal/arrepentimiento' },
      { label: 'Botón de baja', href: '/legal/baja' },
      { label: 'Usuario financiero', href: '/legal/usuario-financiero' },
      { label: 'Defensa del consumidor', href: '/legal/defensa-consumidor' },
    ],
  },
  {
    title: 'Ayuda y legales',
    links: [
      { label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
      { label: 'Contacto y reclamos', href: '/contacto' },
      { label: 'Términos y condiciones', href: '/legal/terminos' },
      { label: 'Política de privacidad', href: '/legal/privacidad' },
    ],
  },
] as const

export function PublicFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-ink text-white/80">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="space-y-5 md:col-span-5">
            <BrandLogo showText light />
            <p className="max-w-md text-sm leading-relaxed text-white/65">
              {groupOperatorLine()} No somos un banco: originamos y administramos créditos personales sujetos a
              evaluación crediticia, con TNA, CFT e impuestos informados en cada simulación y contrato.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col, i) => (
            <div key={col.title} className={i === 0 ? 'md:col-span-2 md:col-start-7' : 'md:col-span-2'}>
              <div className="text-xs uppercase tracking-[0.1em] text-brand-primary-300">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="inline-block py-1 text-white/75 transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-6 text-sm text-white/65">
          <span className="text-xs uppercase tracking-[0.1em] text-white/60">
            Marcas de {GROUP.name}
          </span>
          {groupSiblingUnits().map((unit) => (
            <a
              key={unit.id}
              href={unit.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-1 transition hover:text-white"
            >
              {unit.name} <span className="text-white/40">· {unit.role}</span>
            </a>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p suppressHydrationWarning>
            © {year} {BRAND.company} · {BRAND.domain}
          </p>
          <p className="max-w-xl md:text-right">
            La cuota, TNA y CFT de la simulación son informativos. La oferta final se confirma en el contrato, que se firma de forma electrónica.
          </p>
        </div>
      </div>
    </footer>
  )
}

export function PublicCtaBanner() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-brand-navy-800 px-7 py-12 text-white sm:px-12 sm:py-16">
        <Guilloche className="absolute -right-40 -top-56 h-[40rem] w-[40rem]" petals={30} />
        <div className="relative grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-300">Empezá hoy</p>
            <h2 className="mt-4 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              Mirá el costo completo antes de decidir.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70">
              Creá tu cuenta, verificá tu identidad y, si tu perfil califica, firmás con la cuota, la TNA y el CFT a la
              vista. Tenés 10 días para arrepentirte.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-4 lg:flex-col lg:items-stretch">
            <Link
              href="/sign-up"
              className="group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-brand-primary-300 px-7 text-base font-semibold text-brand-navy-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-800"
            >
              Pedir mi crédito <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/simulador"
              className="inline-flex h-13 items-center justify-center rounded-full border border-white/25 px-7 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Probar el simulador
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
