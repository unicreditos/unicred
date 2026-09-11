import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { KpiCard, SectionCard } from '@/components/unicred/dashboard-kit'
import { formatARS } from '@/lib/finance'
import { cn } from '@/lib/utils'
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  Users,
  Store,
  AlertTriangle,
  TrendingUp,
  Percent,
  Building2,
  Coins,
  ShieldCheck,
} from 'lucide-react'

export type StatsData = {
  loans: {
    total: number
    active: number
    pending: number
    rejected: number
    paid: number
    volume: number
    outstanding?: number
  }
  users: { total: number; customers: number; merchants: number; admins: number }
  merchants: { total: number; pending: number; active: number; rejected: number }
  kyc?: { pending: number }
}

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function SummaryCards({ stats }: { stats: StatsData }) {
  const loanCards = [
    {
      title: 'Total Créditos',
      value: stats.loans.total.toLocaleString('es-AR'),
      icon: CreditCard,
      iconBg: 'bg-brand-primary/10 text-brand-primary',
      footer: `${pct(stats.loans.active + (stats.loans.paid ?? 0), stats.loans.total)}% cartera viva`,
    },
    {
      title: 'Activos',
      value: stats.loans.active.toLocaleString('es-AR'),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10 text-emerald-600',
      footer: 'Vigentes',
    },
    {
      title: 'Pendientes',
      value: stats.loans.pending.toLocaleString('es-AR'),
      icon: Clock,
      iconBg: 'bg-brand-amber/10 text-brand-amber',
      footer: `${pct(stats.loans.pending, stats.loans.total)}% a resolver`,
    },
    {
      title: 'Rechazados',
      value: stats.loans.rejected.toLocaleString('es-AR'),
      icon: XCircle,
      iconBg: 'bg-destructive/10 text-destructive',
      footer: `${pct(stats.loans.rejected, stats.loans.total)}% tasa rechazo`,
    },
    {
      title: 'Pagados',
      value: (stats.loans.paid ?? 0).toLocaleString('es-AR'),
      icon: ShieldCheck,
      iconBg: 'bg-brand-cian/10 text-brand-cian-700',
      footer: 'Finalizados OK',
    },
    {
      title: 'Volumen Desembolsado',
      value: formatARS(stats.loans.volume),
      icon: Wallet,
      iconBg: 'bg-brand-indigo/10 text-brand-indigo',
      footer: `Ticket prom. ${stats.loans.active ? formatARS(stats.loans.volume / (stats.loans.active + (stats.loans.paid ?? 0))) : '—'}`,
    },
  ]

  const userCards = [
    {
      title: 'Usuarios Totales',
      value: stats.users.total.toLocaleString('es-AR'),
      icon: Users,
      iconBg: 'bg-brand-navy/10 text-brand-navy',
    },
    {
      title: 'Clientes',
      value: stats.users.customers.toLocaleString('es-AR'),
      icon: CreditCard,
      iconBg: 'bg-brand-primary/10 text-brand-primary',
    },
    {
      title: 'Comercios',
      value: stats.users.merchants.toLocaleString('es-AR'),
      icon: Store,
      iconBg: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      title: 'Administradores',
      value: stats.users.admins.toLocaleString('es-AR'),
      icon: ShieldCheck,
      iconBg: 'bg-brand-indigo/10 text-brand-indigo',
    },
  ]

  const merchantCards = [
    {
      title: 'Comercios Totales',
      value: stats.merchants.total.toLocaleString('es-AR'),
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Activos',
      value: stats.merchants.active.toLocaleString('es-AR'),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Pendientes',
      value: stats.merchants.pending.toLocaleString('es-AR'),
      icon: AlertTriangle,
      color: 'text-brand-amber',
      bg: 'bg-brand-amber/10',
    },
    {
      title: 'Rechazados',
      value: stats.merchants.rejected.toLocaleString('es-AR'),
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
  ]

  const approvalPct = stats.loans.total
    ? pct(stats.loans.active + (stats.loans.paid ?? 0), stats.loans.total)
    : 0
  const rejectionPct = stats.loans.total ? pct(stats.loans.rejected, stats.loans.total) : 0
  const pendingPct = stats.loans.total ? pct(stats.loans.pending, stats.loans.total) : 0
  const merchantActivePct = stats.merchants.total ? pct(stats.merchants.active, stats.merchants.total) : 0

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Cartera de Créditos</h3>
          <Badge variant="outline" className="text-xs">
            {loanCards.length} métricas
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {loanCards.map((c) => (
            <KpiCard
              key={c.title}
              title={c.title}
              value={c.value}
              icon={<c.icon className="h-5 w-5" />}
              iconBg={c.iconBg}
              footer={c.footer}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Embudos de Créditos"
          description="Estado actual de la cartera"
          icon={<TrendingUp className="h-4 w-4" />}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Percent className="h-3.5 w-3.5 text-emerald-600" />
                  Tasa de aprobación
                </span>
                <span className="font-semibold tabular-nums text-emerald-600">{approvalPct}%</span>
              </div>
              <Progress value={approvalPct} className="h-2 [&>div]:bg-emerald-500" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Clock className="h-3.5 w-3.5 text-brand-amber" />
                  Pendientes de resolución
                </span>
                <span className="font-semibold tabular-nums text-brand-amber">{pendingPct}%</span>
              </div>
              <Progress value={pendingPct} className="h-2 [&>div]:bg-brand-amber" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  Tasa de rechazo
                </span>
                <span className="font-semibold tabular-nums text-destructive">{rejectionPct}%</span>
              </div>
              <Progress value={rejectionPct} className="h-2 [&>div]:bg-destructive" />
            </div>

            <div className="grid grid-cols-4 gap-2 border-t pt-3">
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <div className="mb-1 text-xs text-muted-foreground">Aprob</div>
                <div className="text-lg font-bold tabular-nums text-emerald-600">{stats.loans.active}</div>
              </div>
              <div className="rounded-lg bg-brand-amber/10 p-3 text-center">
                <div className="mb-1 text-xs text-muted-foreground">Pend</div>
                <div className="text-lg font-bold tabular-nums text-brand-amber">{stats.loans.pending}</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <div className="mb-1 text-xs text-muted-foreground">Rech</div>
                <div className="text-lg font-bold tabular-nums text-destructive">{stats.loans.rejected}</div>
              </div>
              <div className="rounded-lg bg-brand-cian/10 p-3 text-center">
                <div className="mb-1 text-xs text-muted-foreground">Pag</div>
                <div className="text-lg font-bold tabular-nums text-brand-cian-700">{stats.loans.paid ?? 0}</div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Distribución de Comercios"
          icon={<Coins className="h-4 w-4" />}
          action={
            <Badge variant="outline" className="text-xs">
              {merchantActivePct}% habilitados
            </Badge>
          }
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  Comercios activos
                </span>
                <span className="font-semibold tabular-nums text-emerald-600">{merchantActivePct}%</span>
              </div>
              <Progress value={merchantActivePct} className="h-2 [&>div]:bg-emerald-500" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {merchantCards.map((c) => (
                <div key={c.title} className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-xl', c.bg)}>
                      <c.icon className={cn('h-3.5 w-3.5', c.color)} />
                    </div>
                    {c.title}
                  </div>
                  <div className="text-lg font-bold tabular-nums">{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">Base de Usuarios</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {userCards.map((c) => (
            <KpiCard key={c.title} title={c.title} value={c.value} icon={<c.icon className="h-5 w-5" />} iconBg={c.iconBg} />
          ))}
        </div>
      </div>
    </div>
  )
}
