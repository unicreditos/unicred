'use client'

import type { getMerchantCommerce } from '@/app/actions/merchant-commerce'
import { ORDER_STAGE_LABEL, type OrderStage } from '@/lib/merchant-orders/rules'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type Commerce = NonNullable<Awaited<ReturnType<typeof getMerchantCommerce>>>
export type CommerceOrder = Commerce['orders'][number]
export type CommerceProduct = Commerce['products'][number]
export type CommerceSettlement = Commerce['settlements'][number]

const STAGE_TONE: Record<OrderStage, string> = {
  en_revision: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  esperando_cliente: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  lista_para_entregar: 'bg-emerald-600 text-white ring-emerald-600',
  entregada: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  liquidada: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30',
  rechazada: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  anulada: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30',
}

export function StagePill({ stage }: { stage: OrderStage }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', STAGE_TONE[stage])}>
      {ORDER_STAGE_LABEL[stage]}
    </span>
  )
}

export function Panel({ title, eyebrow, action, children, className }: { title?: ReactNode; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6', className)}>
      {title || eyebrow || action ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow ? <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary-700 dark:text-brand-primary-300">{eyebrow}</p> : null}
            {title ? <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Figure({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'accent' | 'good' | 'warn' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 font-display text-xl font-extrabold tracking-tight tabular-nums sm:text-[1.7rem]',
          tone === 'accent' && 'text-brand-primary-700 dark:text-brand-primary-300',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-400',
          tone === 'warn' && 'text-amber-700 dark:text-amber-400',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div> : null}
    </div>
  )
}

export const fieldClass =
  'h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40'

export const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-navy-900 px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:pointer-events-none disabled:opacity-50 dark:bg-brand-primary dark:hover:bg-brand-primary-700'

export const btnGhost =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50'

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
}
