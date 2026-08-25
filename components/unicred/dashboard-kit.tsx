import { cn } from '@/lib/utils'
import { formatARS } from '@/lib/finance'
import { BRAND } from '@/lib/brand'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle2,
  FileText,
  Landmark,
  CreditCard,
  CalendarDays,
  Users,
  Building2,
  BadgeCheck,
  Clock,
  Shield,
  Globe2,
  FileCheck2,
  Handshake,
  Sparkles,
  Banknote,
  CircleDot,
  MonitorSmartphone,
} from 'lucide-react'
import Link from 'next/link'

type DeltaTone = 'up' | 'down' | 'neutral'

export function KpiCard({
  title,
  value,
  deltaLabel,
  delta,
  tone = 'neutral',
  icon,
  iconBg = 'bg-brand-primary/10 text-brand-primary',
  footer,
  className,
}: {
  title: string
  value: React.ReactNode
  deltaLabel?: string
  delta?: string
  tone?: DeltaTone
  icon?: React.ReactNode
  iconBg?: string
  footer?: React.ReactNode
  className?: string
}) {
  const toneMap = {
    up: 'text-emerald-600 bg-emerald-500/10 border-emerald-200/40',
    down: 'text-destructive bg-destructive/10 border-destructive/20',
    neutral: 'text-muted-foreground bg-muted border-border/60',
  } satisfies Record<DeltaTone, string>
  const trendIcon =
    tone === 'up' ? <TrendingUp className="h-3 w-3" /> : tone === 'down' ? <TrendingDown className="h-3 w-3" /> : null

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="mt-1.5 font-sans text-[22px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </div>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5',
            iconBg,
          )}
        >
          {icon ?? <CircleDot className="h-5 w-5" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              toneMap[tone],
            )}
          >
            {trendIcon}
            {delta}
            {deltaLabel ? <span className="opacity-80"> {deltaLabel}</span> : null}
          </span>
        ) : (
          <span />
        )}
        {footer ? <div className="text-[11px] text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  )
}

export function DonutChart({
  segments,
  size = 180,
  stroke = 22,
  centerTitle,
  centerValue,
}: {
  segments: { label: string; value: number; color: string; count?: number }[]
  size?: number
  stroke?: number
  centerTitle?: string
  centerValue?: string
}) {
  const total = Math.max(1, segments.reduce((a, s) => a + (s.value || 0), 0))
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  // Cada arco arranca donde termina el anterior: se precalculan los offsets en
  // vez de acumular una variable mientras React renderiza.
  const arcs = segments.reduce<Array<{ dash: number; offset: number }>>((acc, s) => {
    const previous = acc[acc.length - 1]
    const offset = previous ? previous.offset + previous.dash : 0
    return [...acc, { dash: ((s.value || 0) / total) * circ, offset }]
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={stroke}
          />
          {segments.map((s, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${arcs[i].dash} ${circ - arcs[i].dash}`}
              strokeDashoffset={-arcs[i].offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 400ms ease, stroke-dashoffset 400ms ease' }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerTitle ? <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{centerTitle}</div> : null}
          {centerValue ? <div className="mt-0.5 text-xl font-black tracking-tight text-foreground tabular-nums">{centerValue}</div> : null}
        </div>
      </div>
      <div className="w-full sm:w-auto space-y-1.5">
        {segments.map((s, i) => {
          const frac = ((s.value || 0) / total) * 100
          return (
            <div key={i} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              {s.count !== undefined ? (
                <span className="font-semibold tabular-nums text-foreground">{s.count}</span>
              ) : null}
              <span className="w-12 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {frac.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LineChart({
  points,
  labels,
  height = 200,
  color = '#0052D4',
  fill = true,
  yMax,
  yFormatter = (v) => String(Math.round(v)),
}: {
  points: number[]
  labels?: string[]
  height?: number
  color?: string
  fill?: boolean
  yMax?: number
  yFormatter?: (v: number) => string
}) {
  const max = yMax ?? Math.max(1, ...points)
  const step = 1200 / Math.max(1, points.length - 1)
  const width = 1200
  const paddingTop = 16
  const paddingBottom = 28
  const innerH = height - paddingTop - paddingBottom
  const toY = (v: number) => paddingTop + innerH - (v / max) * innerH

  const dPath = points
    .map((p, i) => {
      const x = i * step
      const y = toY(p)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
  const fillPath = `${dPath} L ${width} ${paddingTop + innerH} L 0 ${paddingTop + innerH} Z`

  const ticks = 4
  const gridYs = Array.from({ length: ticks + 1 }, (_, i) => paddingTop + (innerH * i) / ticks)

  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {yFormatter(max)}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="uc-lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridYs.map((y, i) => (
          <line
            key={i}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            stroke="#E2E8F0"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}
        {fill ? <path d={fillPath} fill="url(#uc-lc-fill)" /> : null}
        <path
          d={dPath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          if (i % labelEvery !== 0 && i !== points.length - 1) return null
          const x = i * step
          const y = toY(p)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
            </g>
          )
        })}
        {points.map((_, i) => {
          if (i % labelEvery !== 0 && i !== points.length - 1) return null
          if (!labels?.[i]) return null
          return (
            <text
              key={`lbl-${i}`}
              x={i * step}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#64748B"
            >
              {labels[i]}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  className,
}: {
  value: number
  max?: number
  tone?: 'primary' | 'emerald' | 'amber' | 'cian'
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const bar =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-brand-amber'
        : tone === 'cian'
          ? 'bg-brand-cian-500'
          : 'bg-gradient-to-r from-brand-primary to-brand-cian-500'
  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function StatusChip({
  status,
}: {
  status:
    | 'aprobado'
    | 'pendiente'
    | 'rechazado'
    | 'en_evaluacion'
    | 'activo'
    | 'pagado'
    | 'vencido'
    | string
}) {
  // Acepta tanto las claves en español de la UI como los estados que llegan de la base.
  const ALIASES: Record<string, string> = {
    approved: 'aprobado',
    active: 'activo',
    paid: 'pagado',
    pending: 'pendiente',
    rejected: 'rechazado',
    overdue: 'vencido',
    expired: 'vencido',
    cancelled: 'rechazado',
    in_review: 'en_evaluacion',
  }
  const raw = String(status).toLowerCase()
  const s = ALIASES[raw] ?? raw

  const map: Record<string, string> = {
    aprobado:
      'bg-emerald-500/10 text-emerald-700 border-emerald-200/60 ring-emerald-500/10',
    activo:
      'bg-emerald-500/10 text-emerald-700 border-emerald-200/60 ring-emerald-500/10',
    pagado:
      'bg-emerald-500/10 text-emerald-700 border-emerald-200/60 ring-emerald-500/10',
    pendiente:
      'bg-brand-amber/10 text-brand-amber-700 border-brand-amber/30 ring-brand-amber/10',
    rechazado: 'bg-destructive/10 text-destructive border-destructive/20 ring-destructive/10',
    vencido: 'bg-destructive/10 text-destructive border-destructive/20 ring-destructive/10',
    en_evaluacion:
      'bg-brand-indigo/10 text-brand-indigo-700 border-brand-indigo/20 ring-brand-indigo/10',
  }
  const cls = map[s] ?? 'bg-muted text-muted-foreground border-border'
  const labelMap: Record<string, string> = {
    aprobado: 'Aprobado',
    activo: 'Activo',
    pagado: 'Pagado',
    pendiente: 'Pendiente',
    rechazado: 'Rechazado',
    vencido: 'Vencido',
    en_evaluacion: 'En evaluación',
  }
  const fallbackLabel = s.replaceAll('_', ' ').replace(/^./, (ch) => ch.toUpperCase())
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        cls,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labelMap[s] ?? fallbackLabel}
    </span>
  )
}

export function LoanCard({
  id,
  name,
  originalAmount,
  outstanding,
  paidCount,
  totalCount,
  nextDue,
  nextAmount,
  status = 'activo',
  product,
  className,
}: {
  id: string
  name: string
  originalAmount: number
  outstanding: number
  paidCount: number
  totalCount: number
  nextDue?: string
  nextAmount?: number
  status?: 'activo' | 'pagado' | 'pendiente' | 'rechazado' | string
  product?: string
  className?: string
}) {
  const pct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0
  const paid = originalAmount - outstanding

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:shadow-md',
        className,
      )}
    >
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-brand-primary/5 blur-2xl" />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold tracking-tight text-foreground">{name}</p>
              <StatusChip status={status} />
            </div>
            {product ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{product} · {id}</p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground font-mono">{id}</p>
            )}
          </div>
          <div className="shrink-0 rounded-xl bg-brand-primary/10 p-2 text-brand-primary ring-1 ring-brand-primary/10">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoField label="Monto Original" value={formatARS(originalAmount)} mono />
          <InfoField label="Saldo Pendiente" value={formatARS(outstanding)} mono emphasize />
          <InfoField
            label="Cuotas"
            value={
              <span className="tabular-nums">
                <span className="font-bold text-foreground">{paidCount}</span>
                <span className="text-muted-foreground"> / {totalCount}</span>
              </span>
            }
          />
          {nextDue ? (
            <InfoField
              label="Próxima Cuota"
              value={
                <div className="text-right sm:text-left">
                  <div className="tabular-nums font-semibold text-foreground">
                    {nextAmount !== undefined ? formatARS(nextAmount) : '—'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{nextDue}</div>
                </div>
              }
            />
          ) : (
            <InfoField
              label="Pagado"
              value={
                <span className="tabular-nums">
                  <span className="text-emerald-600 font-semibold">{pct.toFixed(0)}%</span>
                  <span className="text-muted-foreground"> ({formatARS(paid)})</span>
                </span>
              }
            />
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progreso de pago</span>
            <span className="font-mono tabular-nums font-semibold text-foreground">{pct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={pct} tone={pct >= 100 ? 'emerald' : pct >= 50 ? 'primary' : 'amber'} />
        </div>
      </div>
    </div>
  )
}

function InfoField({
  label,
  value,
  mono,
  emphasize,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  emphasize?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          'mt-0.5 truncate text-sm font-semibold tabular-nums',
          mono && 'font-mono',
          emphasize ? 'text-brand-primary' : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-5 w-5', className)} aria-hidden>
      <circle cx="16" cy="16" r="15.2" fill="#0B1D3A" />
      <rect x="11" y="6.4" width="11.2" height="7.2" rx="1.1" fill="#00C853" />
      <text
        x="16.6"
        y="12.1"
        textAnchor="middle"
        fontSize="5.4"
        fontWeight="700"
        fill="#0B1D3A"
      >
        $
      </text>
      <path d="M8.4 20.2c1.2-2.3 3.5-3.6 7.6-3.6s6.4 1.3 7.6 3.6" fill="none" stroke="#F5F7FA" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.6 21.4c0-.7.6-1.3 1.3-1.3h13.4c.8 0 1.4.7 1.3 1.5l-.6 5.2A1.6 1.6 0 0 1 21.5 28H10.6A1.7 1.7 0 0 1 9 26.4Z" fill="#F5F7FA" />
    </svg>
  )
}

export function BrandLogo({ className, showText = true, light = false }: { className?: string; showText?: boolean; light?: boolean }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full shadow-sm ring-1 ring-white/10">
        <BrandMark className="h-9 w-9" />
      </span>
      {showText ? (
        <span className="flex flex-col leading-none">
          <span className={cn('text-[17px] font-black tracking-[0.04em]', light ? 'text-white' : 'text-brand-navy-800 dark:text-white')}>
            {BRAND.company}
          </span>
          <span className={cn('mt-0.5 max-w-[168px] text-[10px] font-medium leading-snug', light ? 'text-white/70' : 'text-muted-foreground')}>
            {BRAND.slogan}
          </span>
        </span>
      ) : null}
    </Link>
  )
}

export function DigitalCard({
  holder,
  className,
}: {
  holder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1D3A] via-[#102B5B] to-[#1E58E5] p-5 text-white shadow-xl',
        className,
      )}
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/15">
            <BrandMark className="h-9 w-9" />
          </span>
          <span>
            <span className="block text-sm font-black tracking-[0.06em]">{BRAND.company}</span>
            <span className="block max-w-[160px] text-[10px] font-medium leading-snug text-white/70">{BRAND.slogan}</span>
          </span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Credencial</span>
      </div>
      <div className="mt-8 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">Titular</p>
          <p className="mt-1 text-sm font-semibold tracking-wide">{holder || 'Cliente UNICRÉDITOS'}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs tracking-[0.2em] text-white/70">••••  ••••</p>
          <p className="mt-1 text-[10px] text-white/50">Uso interno · no es tarjeta bancaria</p>
        </div>
      </div>
    </div>
  )
}

export type NavItem = {
  key: string
  label: string
  icon: React.ReactNode
  href?: string
  badge?: string | number
  disabled?: boolean
}

export function AppSidebar({
  role = 'user',
  items,
  active,
  onSelect,
  userInfo,
}: {
  role?: 'user' | 'admin' | 'merchant'
  items: NavItem[]
  active?: string
  onSelect?: (key: string) => void
  userInfo?: { name?: string; roleLabel?: string; email?: string; avatar?: React.ReactNode }
}) {
  const roleLabels = {
    user: 'Panel de Usuario',
    admin: 'Dashboard Administrativo',
    merchant: 'Panel de Comercio',
  } as const

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 uc-gradient-navy text-sidebar-foreground shadow-sm lg:flex">
      <div className="flex items-center gap-3 px-5 pt-5 pb-6">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
          <BrandMark className="h-5 w-5 text-brand-cian" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-black tracking-[0.04em] text-white">{BRAND.company}</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-brand-cian-200">
            {roleLabels[role]}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((it) => {
          const isActive = active === it.key
          const inner = (
            <button
              key={it.key}
              type="button"
              disabled={it.disabled}
              onClick={() => onSelect?.(it.key)}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-white text-brand-navy-800 shadow-md'
                  : 'text-slate-200/90 hover:bg-white/10 hover:text-white',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg',
                  isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-cian-200 group-hover:text-white',
                )}
              >
                {it.icon}
              </span>
              <span className="flex-1 truncate text-left">{it.label}</span>
              {it.badge !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    isActive ? 'bg-brand-primary text-white' : 'bg-white/15 text-white',
                  )}
                >
                  {it.badge}
                </span>
              ) : null}
            </button>
          )
          return it.href ? <Link key={it.key} href={it.href}>{inner}</Link> : inner
        })}
      </nav>

      {userInfo ? (
        <div className="mx-3 mb-3 mt-2 rounded-2xl border border-white/10 bg-white/5 p-3 ring-1 ring-white/5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cian-400/15 text-brand-cian ring-1 ring-white/10">
              {userInfo.avatar ?? <Users className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {userInfo.name ?? `Usuario ${BRAND.company}`}
              </div>
              <div className="truncate text-[11px] text-slate-300/80">
                {userInfo.roleLabel ?? 'Cliente'}
              </div>
            </div>
          </div>
          {userInfo.email ? (
            <div className="mt-2 truncate text-[11px] text-slate-300/70">{userInfo.email}</div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

export function AppHeader({
  role = 'user',
  title,
  subtitle,
  actions,
  dateRange,
}: {
  role?: 'user' | 'admin' | 'merchant'
  title: string
  subtitle?: string
  actions?: React.ReactNode
  dateRange?: string
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {role === 'admin' ? 'Operaciones' : role === 'merchant' ? 'Comercio' : 'Cuenta'}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-navy-900 sm:text-[22px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {dateRange ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm">
            <CalendarDays className="h-4 w-4 text-brand-primary" />
            <span className="font-semibold tabular-nums">{dateRange}</span>
          </div>
        ) : null}
        {actions}
      </div>
    </header>
  )
}

export function TrustBar() {
  const items = [
    { icon: <Landmark className="h-4 w-4" />, label: 'Consulta Central de Deudores BCRA' },
    { icon: <FileCheck2 className="h-4 w-4" />, label: 'TNA y CFT informados' },
    { icon: <Clock className="h-4 w-4" />, label: 'Cuota fija · sistema francés' },
    { icon: <Shield className="h-4 w-4" />, label: 'Datos protegidos · Ley 25.326' },
    { icon: <Globe2 className="h-4 w-4" />, label: '100% digital en todo el país' },
  ]
  return (
    <div className="w-full bg-brand-navy-800 text-slate-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 py-3 sm:justify-between">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[12px] font-medium">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-brand-cian-300 ring-1 ring-white/5">
              {i.icon}
            </span>
            <span className="tracking-tight">{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeroLanding() {
  const pillars = [
    { icon: <Globe2 className="h-5 w-5" />, title: 'Argentina', text: 'Operamos en el país, con DNI, CUIL y Central de Deudores.' },
    { icon: <Shield className="h-5 w-5" />, title: 'Confiable', text: 'TNA y CFT a la vista. Datos protegidos por la Ley 25.326.' },
    { icon: <Clock className="h-5 w-5" />, title: 'Digital', text: 'Simulá y pedí online. El tiempo depende de Didit y del BCRA.' },
    { icon: <Handshake className="h-5 w-5" />, title: 'Cercano', text: 'Personas, PyMEs y comercios adheridos. Atención por email.' },
  ]

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 uc-gradient-navy opacity-95" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 40%, rgba(255,255,255,0.18) 0 1px, transparent 1.5px), radial-gradient(circle at 72% 28%, rgba(255,255,255,0.12) 0 1px, transparent 1.5px)',
          backgroundSize: '48px 48px, 72px 72px',
        }}
      />
      <div className="absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-cian-500/10 blur-3xl" />
      <div className="absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-brand-primary-400/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-cian-200 ring-1 ring-white/5">
            <Banknote className="h-3.5 w-3.5" />
            {BRAND.legalName} · Créditos digitales
          </div>
          <h1 className="mt-5 text-[36px] font-black leading-[1.08] tracking-tight text-white sm:text-[50px]">
            {BRAND.valueProp}
          </h1>
          <p className="mt-3 text-sm font-medium text-brand-cian-200">{BRAND.slogan}</p>
          <p className="mt-2 text-base font-medium text-white/85">{BRAND.tagline}</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-200/90">
            Soluciones financieras inteligentes y accesibles para personas, comercios y empresas.
            Simulá, evaluamos tu perfil con la Central de Deudores del BCRA y acreditamos en tu
            cuenta. Costos informados antes de firmar. Sujeto a evaluación crediticia.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl uc-gradient-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-primary/30 ring-1 ring-white/10 transition hover:-translate-y-0.5"
            >
              Solicitar crédito <MonitorSmartphone className="h-4 w-4" />
            </Link>
            <Link
              href="#simulador"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10"
            >
              Simular mi crédito <Sparkles className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {pillars.map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 ring-1 ring-white/5 backdrop-blur">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-brand-cian-200">
                  {s.icon}
                </div>
                <div className="mt-2 text-sm font-bold text-white">{s.title}</div>
                <div className="mt-1 text-[11px] leading-snug text-slate-300/85">{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-brand-cian-400/20 via-transparent to-brand-primary-400/20 blur-2xl" />
            <div className="relative rounded-[26px] border border-white/10 bg-card p-3 shadow-2xl ring-1 ring-white/5">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <BrandLogo showText={true} />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Vista de ejemplo</div>
                  <div className="text-xs font-semibold text-brand-navy">Préstamo personal</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-brand-primary-50/60 p-3 ring-1 ring-brand-primary/10">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-brand-primary-600">Capital</div>
                  <div className="mt-1 text-xl font-black text-brand-navy tabular-nums">$ 500.000</div>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200/60">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Cuota fija</div>
                  <div className="mt-1 text-xl font-black text-brand-navy tabular-nums">{formatARS(PERSONAL_QUOTE.installmentAmount)}</div>
                </div>
                <div className="col-span-2 rounded-2xl border border-border/60 bg-white p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Plan 12 cuotas</span>
                        <StatusChip status="activo" />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Sistema francés · referencia del simulador</div>
                    </div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                      <Landmark className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <Mini label="TNA" value={PERSONAL_QUOTE.tnaLabel} />
                    <Mini label="CFT c/IVA" value={PERSONAL_QUOTE.cftLabel} />
                    <Mini label="Plazo" value="12 meses" />
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                    Ejemplo informativo para $500.000 a 12 meses. La oferta final puede variar según perfil de riesgo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
    </div>
  )
}

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[]
  current: number
  className?: string
}) {
  return (
    <ol
      className={cn(
        'grid w-full gap-2',
        steps.length === 4 ? 'grid-cols-4' : 'grid-cols-3',
        className,
      )}
    >
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={i} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition',
                done
                  ? 'bg-brand-primary text-white ring-brand-primary/20'
                  : active
                    ? 'bg-white text-brand-primary ring-brand-primary'
                    : 'bg-muted text-muted-foreground ring-border',
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                'text-xs font-semibold truncate',
                active ? 'text-brand-navy-700' : done ? 'text-brand-primary' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function SectionCard({
  title,
  icon,
  children,
  action,
  description,
  className,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  description?: string
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white overflow-hidden',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/10">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {description ? <p className="text-[12px] text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

