'use client'

import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/unicred/dashboard-kit'
import { BRAND, GROUP, groupOperatorLine, groupSiblingUnits } from '@/lib/brand'
import { formatARS } from '@/lib/finance'
import { COMERCIO_QUOTE, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import {
  ArrowRight,
  Building2,
  Calculator,
  ChevronDown,
  FileCheck2,
  Handshake,
  Landmark,
  LayoutDashboard,
  Lock,
  Menu,
  Percent,
  PhoneCall,
  Scale,
  Shield,
  Wallet,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export const MEGA_MENU = {
  personas: {
    label: 'Crédito',
    hint: 'Personas',
    items: [
      { icon: Wallet, title: 'Préstamo personal', desc: `Hasta ${formatARS(PERSONAL_QUOTE.maxAmount)} · cuota fija`, href: '/prestamos' },
      { icon: Calculator, title: 'Simulador', desc: 'Cuota, TNA, CFT y total a devolver', href: '/simulador' },
      { icon: Scale, title: 'Evaluación BCRA', desc: 'Central de Deudores con tu autorización', href: '/scoring' },
      { icon: Percent, title: 'Tasas y CFT', desc: 'Catálogo de referencia a la vista', href: '/legal/tasas' },
      { icon: FileCheck2, title: 'Cómo se pide', desc: 'Identidad, oferta y desembolso', href: '/prestamos' },
      { title: 'Solicitar evaluación', featured: true, href: '/sign-up' },
    ],
  },
  pymes: {
    label: 'Empresas',
    hint: 'Crédito comercial',
    items: [
      { icon: Building2, title: 'Crédito comercial', desc: `Hasta ${formatARS(COMERCIO_QUOTE.maxAmount)} · cuota fija`, href: '/productos#comercial' },
      { icon: Handshake, title: 'Requisitos PyME', desc: 'CUIT, KYC y Central de Deudores', href: '/productos#comercial' },
      { icon: Calculator, title: 'Simular línea', desc: 'Misma calculadora, producto comercial', href: '/simulador' },
      { title: 'Solicitar crédito comercial', featured: true, href: '/sign-up' },
    ],
  },
  ayuda: {
    label: 'Ayuda',
    hint: 'Transparencia y reclamos',
    items: [
      { icon: PhoneCall, title: 'Preguntas frecuentes', desc: 'Crédito, tasas y desembolso', href: '/preguntas-frecuentes' },
      { icon: PhoneCall, title: 'Contacto', desc: 'Formulario y email de soporte', href: '/contacto' },
      { icon: Scale, title: 'Usuario financiero', desc: 'Identificación del operador', href: '/legal/usuario-financiero' },
      { icon: Landmark, title: 'Arrepentimiento', desc: '10 días corridos · Ley 24.240', href: '/legal/arrepentimiento' },
      { icon: Lock, title: 'Privacidad', desc: 'Tratamiento de datos personales', href: '/legal/privacidad' },
      { title: 'Presentar un reclamo', featured: true, href: '/contacto' },
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
  const [desktopOpen, setDesktopOpen] = useState<MenuKey | null>(null)
  const accountLabel =
    accountHref === '/admin' ? 'Administración' : accountHref === '/merchant' ? 'Mi comercio' : 'Mi cuenta'

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandLogo showText />

        <nav className="hidden lg:flex lg:items-center lg:gap-1 text-sm" aria-label="Principal">
          {(Object.keys(MEGA_MENU) as MenuKey[]).map((key) => {
            const menu = MEGA_MENU[key]
            const expanded = desktopOpen === key
            const panelId = `mega-${key}`
            return (
              <div
                key={key}
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDesktopOpen((current) => (current === key ? null : current))
                  }
                }}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-muted-foreground transition hover:bg-brand-primary-50 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  aria-expanded={expanded}
                  aria-haspopup="true"
                  aria-controls={panelId}
                  onClick={() => setDesktopOpen((current) => (current === key ? null : key))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setDesktopOpen(null)
                  }}
                >
                  <span>{menu.label}</span>
                  <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded ? (
                  <div
                    id={panelId}
                    role="region"
                    aria-label={menu.label}
                    className="absolute left-1/2 top-full z-50 mt-2 w-[540px] -translate-x-1/2 rounded-2xl border border-border/70 bg-card p-3 shadow-2xl shadow-brand-navy/15"
                  >
                    <div className="rounded-xl border border-dashed border-brand-primary/15 bg-gradient-to-br from-brand-primary-50/50 to-brand-cian-50/20 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary-700">{menu.hint}</div>
                      <div className="mt-0.5 text-base font-extrabold text-brand-navy-900">{menu.label}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-0.5">
                      {menu.items.map((item) => (
                        <MegaMenuItemLink
                          key={item.title}
                          item={item}
                          onNavigate={() => setDesktopOpen(null)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
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
                <Link href="/sign-up">Solicitar crédito</Link>
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
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
        <div id="mobile-nav" className="border-t border-border/60 bg-white lg:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6" aria-label="Móvil">
            {(Object.keys(MEGA_MENU) as MenuKey[]).map((key) => {
              const menu = MEGA_MENU[key]
              const expanded = mobileSection === key
              return (
                <div key={key} className="rounded-xl border border-border/60">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
                    aria-expanded={expanded}
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
              {groupOperatorLine()} No somos un banco: originamos y administramos créditos sujetos a evaluación
              crediticia, con TNA, CFT e impuestos informados en cada simulación y contrato.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300/80">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-brand-cian-300" /> Ley 25.326</span>
              <span className="inline-flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-brand-cian-300" /> Consulta BCRA</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brand-cian-300" /> TLS 1.3</span>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">Crédito</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200/80">
              <li><Link href="/prestamos" className="hover:text-white">Préstamo personal</Link></li>
              <li><Link href="/productos#comercial" className="hover:text-white">Crédito comercial</Link></li>
              <li><Link href="/simulador" className="hover:text-white">Simulador</Link></li>
              <li><Link href="/scoring" className="hover:text-white">Evaluación BCRA</Link></li>
              <li><Link href="/legal/tasas" className="hover:text-white">Tasas y CFT</Link></li>
              <li><Link href="/sign-up" className="hover:text-white">Solicitar evaluación</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">Quién opera</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200/80">
              <li><Link href="/legal/usuario-financiero" className="hover:text-white">Usuario financiero</Link></li>
              <li><Link href="/legal/arrepentimiento" className="hover:text-white">Arrepentimiento (10 días)</Link></li>
              <li><Link href="/legal/defensa-consumidor" className="hover:text-white">Defensa del consumidor</Link></li>
              <li><Link href="/contacto" className="hover:text-white">Reclamos formales</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">Ayuda y legales</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200/90">
              <li><Link href="/preguntas-frecuentes" className="hover:text-white">Preguntas frecuentes</Link></li>
              <li><Link href="/contacto" className="hover:text-white">Contacto</Link></li>
              <li><Link href="/legal/arrepentimiento" className="hover:text-white">Botón de arrepentimiento</Link></li>
              <li><Link href="/legal/baja" className="hover:text-white">Botón de baja</Link></li>
              <li><Link href="/legal/usuario-financiero" className="hover:text-white">Usuario financiero</Link></li>
              <li><Link href="/legal/tasas" className="hover:text-white">Comisiones y tasas</Link></li>
              <li><Link href="/legal/defensa-consumidor" className="hover:text-white">Defensa del consumidor</Link></li>
              <li><Link href="/legal/terminos" className="hover:text-white">Términos y condiciones</Link></li>
              <li><Link href="/legal/privacidad" className="hover:text-white">Política de privacidad</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-brand-cian-300">{GROUP.name}</div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200/80">
            {groupSiblingUnits().map((unit) => (
              <li key={unit.id}>
                <a href={unit.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {unit.name}
                </a>
                <span className="ml-1 text-slate-400/80">· {unit.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-300/80 md:flex-row md:items-center">
          <p suppressHydrationWarning>© {year} UNICRÉDITOS · {BRAND.domain} · {BRAND.domains.slice(1).join(' · ')}</p>
          <p className="max-w-xl text-slate-300/80 md:text-right">
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
              {BRAND.slogan} Creá tu cuenta, verificá identidad y, si el perfil califica, firmás con TNA,
              CFT y plan de cuotas a la vista.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="bg-white font-bold tracking-tight text-brand-navy hover:bg-slate-100 shadow-lg shadow-brand-navy/30">
                <Link href="/sign-up">
                  Solicitar evaluación <ArrowRight className="ml-1.5 h-4 w-4" />
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
