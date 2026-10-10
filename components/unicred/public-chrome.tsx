'use client'

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
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
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

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Button asChild size="lg" className="h-10 rounded-lg px-4 font-semibold">
              <Link href={accountHref}>
                <LayoutDashboard className="h-4 w-4" /> {accountLabel}
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="hidden h-10 rounded-lg border-white/40 bg-transparent px-4 font-semibold text-white hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link href="/sign-in">Iniciar sesión</Link>
              </Button>
              <Button asChild size="lg" className="h-10 rounded-lg px-4 font-semibold">
                <Link href="/sign-up">
                  Pedir crédito <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-lg border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white lg:hidden"
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
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-brand-navy-800 p-8 text-white sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-primary/25 blur-3xl"
        />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Mirá el costo completo antes de decidir.
          </h2>
          <p className="mt-4 max-w-xl text-base text-white/70">
            Creá tu cuenta, verificá tu identidad y, si tu perfil califica, firmás con la cuota, la TNA y el CFT a la
            vista. Tenés 10 días para arrepentirte.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
              <Link href="/sign-up">
                Pedir mi crédito <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-xl border-white/25 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/simulador">Probar el simulador</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
