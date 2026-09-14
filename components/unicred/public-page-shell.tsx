import { PublicFooter, PublicHeader } from '@/components/unicred/public-chrome'
import { TrustBar } from '@/components/unicred/dashboard-kit'
import { getAccountHref } from '@/lib/session'
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react'
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
      <PublicHeader isLoggedIn={isLoggedIn} accountHref={accountHref} />

      <main id="contenido-principal">
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
    <section id={id} className="scroll-mt-24 space-y-6 rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
      <div className="max-w-3xl space-y-2">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">{eyebrow}</p>}
        <h2 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">{title}</h2>
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
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
          {icon}
        </div>
        {badge && (
          <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-primary-800">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-brand-navy">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function PublicFaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.q}
          className="group rounded-2xl border border-border/60 bg-card px-5 py-4 open:border-brand-primary/25"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-brand-navy marker:content-none">
            {item.q}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180 group-open:text-brand-primary" />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  )
}
