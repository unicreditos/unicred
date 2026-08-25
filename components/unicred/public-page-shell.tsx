import { PublicBcraTicker } from '@/components/unicred/public-bcra-board'
import { PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { TrustBar } from '@/components/unicred/dashboard-kit'
import { getAccountHref } from '@/lib/session'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export async function PublicPageShell({
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
  const { isLoggedIn, accountHref } = await getAccountHref()

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <PublicBcraTicker />
      <PublicHeader isLoggedIn={isLoggedIn} accountHref={accountHref} />

      <main>
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
          <div className="max-w-3xl space-y-5">
            {eyebrow && (
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-primary">
                {icon}
                {eyebrow}
              </span>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl lg:text-5xl">{title}</h1>
            {description && <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}
            {(primaryAction || secondaryAction) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {primaryAction && (
                  <Button asChild className="font-semibold shadow-sm shadow-brand-primary/20">
                    <Link href={primaryAction.href}>
                      {primaryAction.label} <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {secondaryAction && (
                  <Button asChild variant="outline">
                    <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">{children}</section>
      </main>

      <TrustBar />
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
    <section id={id} className="scroll-mt-24 space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
      <div className="max-w-3xl space-y-2">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">{eyebrow}</p>}
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        {subtitle && <p className="leading-relaxed text-muted-foreground">{subtitle}</p>}
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
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/40 p-5 transition hover:border-brand-primary/30 hover:bg-white hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary/15 to-brand-cian-500/15 text-brand-primary">
          {icon}
        </div>
        {badge && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
