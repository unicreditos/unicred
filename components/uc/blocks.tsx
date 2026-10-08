import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/uc/icons'

/* Bloques de página reutilizables (server components). Mismo lenguaje que los prototipos. */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

export function PageHead({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="uc-page-head">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="uc-actions">{actions}</div> : null}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`uc-badge uc-${tone}`}>{children}</span>
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cx('uc-card', className)} {...props} />
}

export function Pad({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cx('uc-card uc-pad', className)} {...props} />
}

export function CardHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="uc-card-h">
      <h2>{title}</h2>
      {aside}
    </div>
  )
}

export function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="uc-section-title">
      <h2>{title}</h2>
      {aside ? <span>{aside}</span> : null}
    </div>
  )
}

export function Grid({
  cols,
  className,
  ...props
}: ComponentProps<'div'> & { cols: '2' | '3' | '21' | '12' }) {
  return <div className={cx('uc-grid', `uc-cols-${cols}`, className)} {...props} />
}

export function Callout({
  icon,
  title,
  children,
  tone,
}: {
  icon: IconName
  title: string
  children: ReactNode
  tone?: 'warning'
}) {
  return (
    <div className="uc-callout" style={tone === 'warning' ? { borderLeftColor: 'var(--uc-warning)' } : undefined}>
      <Icon name={icon} />
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </div>
  )
}

export type KpiProps = {
  href: string
  label: string
  value: ReactNode
  money?: boolean
  amount?: ReactNode
  amountLabel?: string
  foot?: ReactNode
  extra?: ReactNode
}

export function KpiGrid({ items }: { items: KpiProps[] }) {
  return (
    <section className="uc-kpis" aria-label="Indicadores principales">
      {items.map((k) => (
        <Link key={k.label} className="uc-kpi" href={k.href}>
          <div className="uc-kpi-head">
            <span className="uc-kpi-label">{k.label}</span>
          </div>
          <div className={cx('uc-kpi-value uc-num', k.money && 'uc-money')}>{k.value}</div>
          {k.amount != null ? (
            <div className="uc-kpi-amount uc-num">
              {k.amount} <span>{k.amountLabel}</span>
            </div>
          ) : null}
          {k.extra ?? (k.foot ? <div className="uc-kpi-foot">{k.foot}</div> : null)}
        </Link>
      ))}
    </section>
  )
}

export type TodoItem = { href: string; sev: string; count: number; txt: string; small: string }

export function TodoList({ items }: { items: TodoItem[] }) {
  return (
    <ul className="uc-todo uc-card">
      {items.map((t) => (
        <li key={t.txt}>
          <Link href={t.href}>
            <span className="uc-sev" style={{ background: t.sev }} />
            <span className="uc-count uc-num">{t.count}</span>
            <span className="uc-txt">
              {t.txt}
              <small>{t.small}</small>
            </span>
            <Icon name="right" size="sm" className="uc-go" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Kv({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="uc-kv">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="uc-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="uc-back" href={href}>
      <Icon name="right" size="xs" />
      {children}
    </Link>
  )
}

export function ButtonLink({
  primary,
  large,
  className,
  ...props
}: ComponentProps<typeof Link> & { primary?: boolean; large?: boolean }) {
  return <Link className={cx('uc-btn', primary && 'uc-primary', large && 'uc-lg', className)} {...props} />
}

export function NoAccess({ what }: { what: string }) {
  return (
    <Card className="uc-soon">
      <div className="uc-ic">
        <Icon name="lock" />
      </div>
      <h2>No tenés acceso a esta sección</h2>
      <p>Tu rol no incluye permiso para ver {what}. Pedile a un administrador que lo habilite.</p>
    </Card>
  )
}

export function Bars({
  data,
  tone,
  ariaLabel,
  digits = 0,
}: {
  data: Array<{ label: string; value: number }>
  tone?: 'warning'
  ariaLabel: string
  digits?: number
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <>
      <div className="uc-bars" role="img" aria-label={ariaLabel}>
        {data.map((d) => (
          <div key={d.label} className="uc-b">
            <span className="uc-num">{d.value.toFixed(digits).replace('.', ',')}</span>
            <i style={{ height: `${(d.value / max) * 100}%`, ...(tone === 'warning' ? { background: 'var(--uc-warning)' } : {}) }} />
          </div>
        ))}
      </div>
      <div className="uc-bars-x">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </>
  )
}
