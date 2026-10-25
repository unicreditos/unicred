import { PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

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
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(60%_60%_at_85%_0%,rgba(31,111,181,0.12),transparent_70%)]"
          />
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12">
            <Link
              href="/"
              className="mb-6 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-brand-navy-600 transition hover:text-brand-primary-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al inicio
            </Link>
            <div className="max-w-3xl space-y-5">
              {eyebrow && (
                <p className="inline-flex items-center gap-2 rounded-full border border-brand-navy-200 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-brand-navy-600">
                  {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden />}
                  {eyebrow}
                </p>
              )}
              <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.025em] text-brand-navy-900 sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              {description && (
                <p className="max-w-2xl text-lg leading-relaxed text-brand-navy-600">{description}</p>
              )}
              {(primaryAction || secondaryAction) && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {primaryAction && (
                    <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
                      <Link href={primaryAction.href}>
                        {primaryAction.label} <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  )}
                  {secondaryAction && (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="h-12 rounded-xl border-brand-navy-200 bg-white px-6 text-base font-semibold"
                    >
                      <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-20 sm:px-6 lg:pb-28">{children}</section>
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
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-primary-700">{eyebrow}</p>
        )}
        <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-brand-navy-900 sm:text-3xl">
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
