import { BrandMark, BrandWordmark } from '@/components/brand-mark'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Clock,
  Shield,
  Globe2,
  FileCheck2,
  CircleDot,
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
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs',
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
  color = '#1F6FB5',
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
  const fillId = `uc-lc-${color.replace(/[^a-zA-Z0-9]/g, '')}-${height}-${points.length}-${Math.round(points[0] ?? 0)}-${Math.round(points[points.length - 1] ?? 0)}`
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
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
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
        {fill ? <path d={fillPath} fill={`url(#${fillId})`} /> : null}
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
        : 'bg-brand-primary'
  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10',
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
      'bg-muted text-amber-800 border-border ring-amber-500/10',
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

export function BrandLogo({
  className,
  showText = true,
  light = false,
  href = '/',
}: {
  className?: string
  showText?: boolean
  light?: boolean
  href?: string
}) {
  return (
    <Link href={href} className={cn('inline-flex items-center', className)} aria-label="Unicréditos, ir al inicio">
      {showText ? <BrandWordmark light={light} /> : <BrandMark className="h-9 w-9" tone={light ? 'white' : 'brand'} />}
    </Link>
  )
}

export function TrustBar({ tone = 'navy' }: { tone?: 'navy' | 'light' }) {
  const items = [
    { icon: <Landmark className="h-4 w-4" />, label: 'Consulta Central de Deudores BCRA' },
    { icon: <FileCheck2 className="h-4 w-4" />, label: 'TNA y CFT antes de firmar' },
    { icon: <Clock className="h-4 w-4" />, label: 'Cuota fija · sistema francés' },
    { icon: <Shield className="h-4 w-4" />, label: 'Identidad Didit · Ley 25.326' },
    { icon: <Globe2 className="h-4 w-4" />, label: 'Contrato y pagaré en tu panel' },
  ]
  const light = tone === 'light'
  return (
    <div
      className={
        light
          ? 'w-full border-y border-border/50 bg-white/80 text-brand-navy-600 backdrop-blur-md'
          : 'w-full bg-brand-navy-800 text-slate-200'
      }
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 py-3 sm:justify-between">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[12px] font-medium">
            <span
              className={
                light
                  ? 'flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/15'
                  : 'flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-brand-cian-300 ring-1 ring-white/5'
              }
            >
              {i.icon}
            </span>
            <span className="tracking-tight">{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SectionCard({
  title,
  icon,
  children,
  action,
  description,
  className,
  bodyClassName = 'p-4 sm:p-5',
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  description?: string
  className?: string
  /** Override si los hijos ya traen su propio padding (ej. tablas o listas con filas px-4 py-3 a todo el ancho). */
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-xs',
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
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
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

