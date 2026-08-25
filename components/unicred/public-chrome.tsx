'use client'

import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { BRAND } from '@/lib/brand'
import {
  ArrowRight,
  Building2,
  Calculator,
  ChevronDown,
  Handshake,
  Landmark,
  LayoutDashboard,
  Lock,
  Menu,
  PhoneCall,
  Scale,
  Shield,
  Store,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export const MEGA_MENU = {
  personas: {
    label: 'Personas',
    hint: 'Créditos para vos',
    items: [
      { icon: Wallet, title: 'Préstamo Personal', desc: 'Hasta $3.000.000 · cuota fija', href: '/productos#personal' },
      { icon: Scale, title: 'Situación crediticia', desc: 'Consulta a Central de Deudores BCRA', href: '/scoring' },
      { icon: Calculator, title: 'Simulador de cuotas', desc: 'TNA, CFT y total a devolver', href: '/simulador' },
      { icon: Handshake, title: 'Reestructurar deudas', desc: 'Unificá cuotas con asesoría', href: '/contacto' },
      { title: 'Ver todos los productos', featured: true, href: '/productos' },
    ],
  },
  pymes: {
    label: 'PyMEs y comercios',
    hint: 'Capital de trabajo y ventas',
    items: [
      { icon: Store, title: 'Adherir mi comercio', desc: 'Financiá a clientes con cuenta UNICRÉDITOS', href: '/comercios' },
      { icon: Building2, title: 'Crédito comercial', desc: 'Hasta $5.000.000 para tu PyME', href: '/productos#comercial' },
      { icon: TrendingUp, title: 'Crédito de consumo', desc: 'Cuotas en el punto de venta', href: '/productos#consumo' },
      { icon: Users, title: 'Alta de comercio', desc: 'Adhesión sujeta a validación de UNICRÉDITOS', href: '/comercios' },
      { title: 'Conocer la red de comercios', featured: true, href: '/comercios' },
    ],
  },
  ayuda: {
    label: 'Ayuda',
    hint: 'Atención y transparencia',
    items: [
      { icon: PhoneCall, title: 'Contacto', desc: 'Formulario y email de soporte', href: '/contacto' },
      { icon: Calculator, title: 'Calculadora de cuotas', desc: 'Simulador con TNA y CFT', href: '/simulador' },
      { icon: Landmark, title: 'Datos oficiales BCRA', desc: 'Tipo de cambio de referencia', href: '/datos-bcra' },
      { icon: Scale, title: 'Términos y condiciones', desc: 'Contrato y reglas del servicio', href: '/legal/terminos' },
      { icon: Lock, title: 'Privacidad', desc: 'Tratamiento de datos personales', href: '/legal/privacidad' },
      { title: 'Escribinos ahora', featured: true, href: '/contacto' },
    ],
  },
} as const

type MenuKey = keyof typeof MEGA_MENU

function MegaMenuItemLink({
  item,
  onNavigate,
}: {
  item: { icon?: React.ComponentType<{ className?: string }>; title: string; desc?: string; href: string; featured?: boolean }
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition ' +
        (item.featured
          ? 'col-span-2 mt-1 border border-dashed border-brand-primary/20 bg-brand-primary-50/50 font-semibold text-brand-primary hover:bg-brand-primary-50'
          : 'hover:bg-slate-50 hover:text-brand-primary')
      }
    >
      {Icon ? (
        <span
          className={
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' +
            (item.featured
              ? 'bg-brand-primary text-white'
              : 'bg-brand-primary-50 text-brand-primary group-hover:bg-brand-primary group-hover:text-white')
          }
        >
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="flex flex-col">
        <span className="text-sm font-semibold leading-tight">{item.title}</span>
        {item.desc ? <span className="mt-0.5 text-xs font-normal text-muted-foreground">{item.desc}</span> : null}
      </span>
    </Link>
  )
}

export function PublicHeader({
  isLoggedIn = false,
  accountHref = '/dashboard',
}: {
  isLoggedIn?: boolean
  accountHref?: string
}) {
  const [open, setOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<MenuKey | null>(null)
  const accountLabel =
    accountHref === '/admin' ? 'Administración' : accountHref === '/merchant' ? 'Mi comercio' : 'Mi cuenta'

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandLogo showText />

        <nav className="hidden lg:flex lg:items-center lg:gap-1 text-sm" aria-label="Principal">
          {(Object.keys(MEGA_MENU) as MenuKey[]).map((key) => {
            const menu = MEGA_MENU[key]
            return (
              <div key={key} className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-muted-foreground transition hover:bg-brand-primary-50 hover:text-brand-primary"
                >
                  <span>{menu.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 transition group-hover:rotate-180" />
                </button>
                <div className="invisible absolute left-1/2 top-full z-50 mt-2 w-[540px] -translate-x-1/2 translate-y-2 rounded-2xl border border-border/70 bg-card p-3 opacity-0 shadow-2xl shadow-brand-navy/15 transition duration-200 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <div className="rounded-xl border border-dashed border-brand-primary/15 bg-gradient-to-br from-brand-primary-50/50 to-brand-cian-50/20 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary-700">{menu.hint}</div>
                    <div className="mt-0.5 text-base font-extrabold text-brand-navy-900">{menu.label}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-0.5">
                    {menu.items.map((item) => (
                      <MegaMenuItemLink key={item.title} item={item} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Button asChild className="font-bold tracking-tight shadow-sm shadow-brand-primary/20">
              <Link href={accountHref}>
                <LayoutDashboard className="mr-1.5 h-4 w-4" /> {accountLabel}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden font-semibold sm:inline-flex">
                <Link href="/sign-in">Ingresar</Link>
              </Button>
              <Button asChild className="font-bold tracking-tight shadow-sm shadow-brand-primary/20">
                <Link href="/sign-up">Crear cuenta</Link>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-white lg:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6" aria-label="Móvil">
            {(Object.keys(MEGA_MENU) as MenuKey[]).map((key) => {
              const menu = MEGA_MENU[key]
              const expanded = mobileSection === key
              return (
                <div key={key} className="rounded-xl border border-border/60">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-3 text-sm font-semibold"
                    onClick={() => setMobileSection(expanded ? null : key)}
                  >
                    {menu.label}
                    <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded ? (
                    <div className="grid gap-0.5 border-t border-border/60 p-2">
                      {menu.items.map((item) => (
                        <MegaMenuItemLink key={item.title} item={item} onNavigate={() => setOpen(false)} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {isLoggedIn ? (
              <Link
                href={accountHref}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-semibold text-brand-primary"
              >
                Ir a {accountLabel.toLowerCase()}
              </Link>
            ) : (
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground"
              >
                Ingresar a mi cuenta
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}

export function PublicFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-white/10 bg-brand-navy text-slate-200">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="space-y-4 md:col-span-4">
            <BrandLogo showText light />
            <p className="max-w-md text-sm leading-relaxed text-slate-300/85">
              UNICRÉDITOS es la plataforma de créditos digitales de RM International Group S.A.S. No somos un banco:
              originamos y administramos créditos sujetos a evaluación crediticia, con TNA, CFT e impuestos
              informados en cada simulación y contrato.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300/80">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-brand-cian-300" /> Ley 25.326</span>
              <span className="inline-flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-brand-cian-300" /> Consulta BCRA</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brand-cian-300" /> TLS 1.3</span>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">Personas</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200/80">
              <li><Link href="/productos" className="hover:text-white">Productos</Link></li>
              <li><Link href="/simulador" className="hover:text-white">Simulador</Link></li>
              <li><Link href="/scoring" className="hover:text-white">Situación BCRA</Link></li>
              <li><Link href="/datos-bcra" className="hover:text-white">Datos oficiales BCRA</Link></li>
              <li><Link href="/sign-up" className="hover:text-white">Solicitar crédito</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">Empresa</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200/80">
              <li><Link href="/comercios" className="hover:text-white">Red de comercios</Link></li>
              <li><Link href="/contacto" className="hover:text-white">Contacto comercial</Link></li>
              <li><Link href="/sign-up" className="hover:text-white">Crear cuenta</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">Ayuda y legales</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200/80">
              <li><Link href="/contacto" className="hover:text-white">Contacto</Link></li>
              <li><Link href="/legal/terminos" className="hover:text-white">Términos y condiciones</Link></li>
              <li><Link href="/legal/privacidad" className="hover:text-white">Política de privacidad</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-300/65 md:flex-row md:items-center">
          <p suppressHydrationWarning>© {year} UNICRÉDITOS · {BRAND.domain} · {BRAND.domains.slice(1).join(' · ')}</p>
          <p className="max-w-xl md:text-right">
            La cuota, TNA y CFT de la simulación son informativos. La oferta final se confirma en contrato.
          </p>
        </div>
      </div>
    </footer>
  )
}

export function LegalStrip() {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      Simulación informativa a tasa de referencia. La cuota, TNA y CFT finales se confirman en la oferta y el
      contrato, sujetos a evaluación crediticia, verificación de identidad y capacidad de pago. Sistema de
      amortización francés (cuota fija).
    </p>
  )
}

export function PublicCtaBanner() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-brand-primary/15 bg-gradient-to-br from-brand-primary via-brand-royal to-brand-navy p-8 text-white shadow-xl shadow-brand-navy/20 sm:p-10 lg:p-12">
        <div className="grid items-center gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-cian-200 ring-1 ring-white/10">
              <Shield className="h-3.5 w-3.5" /> Evaluación con KYC y BCRA · Cuota fija
            </div>
            <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
              {BRAND.valueProp}
            </h2>
            <p className="mt-3 max-w-xl text-base text-slate-200/90">
              {BRAND.slogan} Creá tu cuenta, cargá DNI y CUIL, y recibí una oferta con TNA, CFT y plan de cuotas
              antes de firmar.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="bg-white font-bold tracking-tight text-brand-navy hover:bg-slate-100 shadow-lg shadow-brand-navy/30">
                <Link href="/sign-up">
                  Solicitar crédito <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/5 font-semibold text-white hover:bg-white/10">
                <Link href="/simulador">Ir al simulador</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            {[
              { n: 'KYC', l: 'Didit obligatorio' },
              { n: 'BCRA', l: 'Central de Deudores' },
              { n: 'CFT', l: 'Antes de firmar' },
              { n: '10 días', l: 'Arrepentimiento' },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/5">
                <div className="text-2xl font-black tracking-tight text-white tabular-nums">{s.n}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-cian-200">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
