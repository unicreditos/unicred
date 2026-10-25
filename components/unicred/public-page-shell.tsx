import { Guilloche } from '@/components/landing/guilloche'
import { PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { ReactNode } from 'react'

export function PublicPageShell({
  title,
  eyebrow,
  description,
  icon,
  children,
  primaryAction,
  secondaryAction,
}: {
  title: string
  eyebrow?: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  primaryAction?: { href: string; label: string }
  secondaryAction?: { href: string; label: string }
}) {
  return (
    <div className="relative min-h-screen bg-paper text-brand-navy-900">
      <PublicHeader />

      <main id="contenido-principal">
        {/* Cabecera de página: la misma banda azul con roseta que la portada */}
        <section className="relative overflow-hidden bg-brand-navy-800 text-white">
          <Guilloche className="absolute -right-64 -top-72 h-[48rem] w-[48rem]" petals={30} />
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-10">
            <Link
              href="/"
              className="mb-10 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-white/65 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al inicio
            </Link>
            <div className="max-w-4xl">
              {eyebrow && (
                <p className="inline-flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-brand-primary-300 [&_svg]:h-3.5 [&_svg]:w-3.5">
                  {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" aria-hidden />}
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-5 text-balance font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.035em] text-white sm:text-[3.5rem] lg:text-[4.25rem]">
                {title}
              </h1>
              {description && (
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/72">{description}</p>
              )}
              {(primaryAction || secondaryAction) && (
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  {primaryAction && (
                    <Link
                      href={primaryAction.href}
                      className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand-primary-300 px-6 text-base font-semibold text-brand-navy-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-800"
                    >
                      {primaryAction.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  )}
                  {secondaryAction && (
                    <Link
                      href={secondaryAction.href}
                      className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {secondaryAction.label}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:pb-28">{children}</section>
      </main>

      <PublicFooter />
    </div>
  )
}

export function PageSection({
  title,
  subtitle,
  children,
  id,
  eyebrow,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  id?: string
  eyebrow?: string
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-6 rounded-3xl border border-brand-navy-200 bg-white p-5 sm:p-8"
    >
      <div className="max-w-3xl space-y-2">
        {eyebrow && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary-700">{eyebrow}</p>
        )}
        <h2 className="text-balance font-display text-2xl font-extrabold tracking-[-0.025em] text-brand-navy-900 sm:text-[2rem]">
          {title}
        </h2>
        {subtitle && <p className="leading-relaxed text-brand-navy-600">{subtitle}</p>}
      </div>
      <div className="pt-2">{children}</div>
    </section>
  )
}

export function Grid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const map = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' } as const
  return <div className={`grid gap-4 ${map[cols]}`}>{children}</div>
}

export function FeatureCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: ReactNode
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-brand-navy-200 bg-paper p-5 transition hover:border-brand-primary/40 hover:bg-white">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary-50 text-brand-primary-700">
          {icon}
        </div>
        {badge && (
          <span className="rounded-full bg-brand-primary-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-primary-700">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-bold tracking-tight text-brand-navy-900">{title}</h3>
        <p className="text-sm leading-relaxed text-brand-navy-600">{description}</p>
      </div>
    </div>
  )
}
