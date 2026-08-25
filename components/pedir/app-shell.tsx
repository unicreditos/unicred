'use client'

import { PedirLogo } from '@/components/pedir/logo'
import { signOut, useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

const NAV = [
  { href: '/pedir/cuenta', label: 'Inicio', match: (p: string) => p === '/pedir/cuenta' || p.startsWith('/pedir/pagar') || p.startsWith('/pedir/docs') },
  { href: '/pedir/solicitud', label: 'Solicitar', match: (p: string) => p.startsWith('/pedir/solicitud') },
  { href: '/pedir/ayuda', label: 'Ayuda', match: (p: string) => p.startsWith('/pedir/ayuda') },
] as const

export function PedirAppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const name = session?.user?.name?.split(' ')[0] ?? null
  const email = session?.user?.email ?? null

  return (
    <div className="lp-app">
      <aside className="lp-app-sidebar">
        <div className="px-4 pt-5">
          <PedirLogo href="/pedir/cuenta" variant="full" tone="light" />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link key={item.href} href={item.href} className={cn('lp-app-nav-item', active && 'is-active')}>
                <span className="lp-app-nav-dot" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold text-white">{name ?? 'Tu cuenta'}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">{email}</p>
          <button
            type="button"
            className="mt-3 text-xs font-bold text-[var(--lp-signal)] hover:underline"
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.replace('/pedir')
                    router.refresh()
                  },
                },
              })
            }
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="lp-app-main">
        <header className="lp-app-topbar">
          <div className="min-w-0">
            {title ? <h1 className="truncate text-base font-semibold text-[var(--lp-ink)] sm:text-lg">{title}</h1> : null}
            {subtitle ? <p className="truncate text-xs text-[var(--lp-muted)]">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pedir/solicitud" className="lp-btn lp-btn-primary hidden py-2 text-sm sm:inline-flex">
              Nueva solicitud
            </Link>
          </div>
        </header>

        <div className="lp-app-content">{children}</div>

        <nav className="lp-app-tabbar" aria-label="Navegación app">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link key={item.href} href={item.href} className={cn('lp-app-tab', active && 'is-active')}>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

/** Shell mínimo para docs imprimibles / login sin tabbar. */
export function PedirAppFrame({ children, backHref = '/pedir/cuenta' }: { children: ReactNode; backHref?: string }) {
  return (
    <div className="lp-app lp-app-frame">
      <header className="lp-app-frame-bar">
        <PedirLogo href="/pedir/cuenta" variant="full" />
        <Link href={backHref} className="lp-btn lp-btn-ghost py-2 text-sm text-[var(--lp-ink)]">
          Volver
        </Link>
      </header>
      <div className="lp-app-frame-body">{children}</div>
    </div>
  )
}
