'use client'

import { PedirLogo } from '@/components/pedir/logo'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { UserRound } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export function PedirHeader({ solid = false }: { solid?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const ink = solid || scrolled || menuOpen

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        ink
          ? 'border-b border-[var(--lp-line)] bg-[var(--lp-chalk)]/95 text-[var(--lp-ink)] backdrop-blur-xl'
          : 'text-[#f4f6f8]',
      )}
    >
      <div className="lp-container flex h-[4.15rem] items-center justify-between gap-3">
        <PedirLogo href="/pedir" tone={ink ? 'dark' : 'light'} className="min-w-0" />

        <nav className="hidden items-center gap-7 text-[0.88rem] font-semibold md:flex">
          <a href="/pedir#producto" className="opacity-70 hover:opacity-100">
            Producto
          </a>
          <a href="/pedir#simular" className="opacity-70 hover:opacity-100">
            Simular
          </a>
          <Link href="/pedir/faq" className="opacity-70 hover:opacity-100">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/pedir/ingresar"
            className={cn(
              'lp-btn inline-flex items-center gap-2 px-3.5 py-2 text-sm',
              ink ? 'lp-btn-ghost text-[var(--lp-ink)]' : 'lp-btn-ghost',
            )}
          >
            <UserRound className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Login / Registro</span>
            <span className="sm:hidden">Ingresar</span>
          </Link>
          <button
            type="button"
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border md:hidden',
              ink ? 'border-[var(--lp-line)]' : 'border-white/25',
            )}
            aria-label="Menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="flex flex-col gap-1.5">
              <span className={cn('block h-0.5 w-4 bg-current transition', menuOpen && 'translate-y-[4px] rotate-45')} />
              <span className={cn('block h-0.5 w-4 bg-current transition', menuOpen && 'opacity-0')} />
              <span className={cn('block h-0.5 w-4 bg-current transition', menuOpen && '-translate-y-[4px] -rotate-45')} />
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-[var(--lp-line)] bg-[var(--lp-chalk)] text-[var(--lp-ink)] md:hidden">
          <nav className="lp-container flex flex-col py-3 text-sm font-semibold">
            <a href="/pedir#producto" className="rounded-xl px-3 py-3" onClick={() => setMenuOpen(false)}>
              Producto
            </a>
            <a href="/pedir#simular" className="rounded-xl px-3 py-3" onClick={() => setMenuOpen(false)}>
              Simular
            </a>
            <Link href="/pedir/faq" className="rounded-xl px-3 py-3" onClick={() => setMenuOpen(false)}>
              FAQ
            </Link>
            <Link
              href="/pedir/ingresar"
              className="lp-btn lp-btn-primary mt-2 inline-flex items-center justify-center gap-2"
              onClick={() => setMenuOpen(false)}
            >
              <UserRound className="h-4 w-4" aria-hidden />
              Login / Registro
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

export function PedirFooter() {
  return (
    <footer className="bg-[var(--lp-ink)] text-[#f4f6f8]">
      <div className="lp-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <PedirLogo href="/pedir" tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
            Plataforma de crédito personal de {BRAND.legalName}. Operamos online en Argentina.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lp-signal)]">Producto</p>
          <ul className="mt-3 space-y-2.5 text-sm text-white/70">
            <li>
              <Link href="/pedir#simular" className="hover:text-white">
                Simular
              </Link>
            </li>
            <li>
              <Link href="/pedir/solicitud" className="hover:text-white">
                Solicitar
              </Link>
            </li>
            <li>
              <Link href="/pedir/ingresar" className="hover:text-white">
                Login / Registro
              </Link>
            </li>
            <li>
              <Link href="/pedir/faq" className="hover:text-white">
                FAQ
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lp-signal)]">Empresa</p>
          <ul className="mt-3 space-y-2.5 text-sm text-white/70">
            <li>
              <Link href="/pedir/legal/terminos" className="hover:text-white">
                Términos
              </Link>
            </li>
            <li>
              <Link href="/pedir/legal/privacidad" className="hover:text-white">
                Privacidad
              </Link>
            </li>
            <li>
              <Link href="/pedir/contacto" className="hover:text-white">
                Contacto
              </Link>
            </li>
            <li>
              <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-white">
                {BRAND.supportEmail}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="lp-container flex flex-col gap-2 py-5 text-[11px] text-white/40 sm:flex-row sm:justify-between">
          <p>
            {BRAND.legalName} · CUIT {BRAND.cuit}
            <br />
            {BRAND.address}
          </p>
          <p>{BRAND.domain}</p>
        </div>
      </div>
    </footer>
  )
}

export function PedirStickyCta() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.65)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="lp-sticky-cta md:hidden" data-show={show}>
      <div className="lp-container">
        <Link href="/pedir/solicitud" className="lp-btn lp-btn-primary w-full">
          Empezar solicitud
        </Link>
      </div>
    </div>
  )
}
