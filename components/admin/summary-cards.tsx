import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatARS } from '@/lib/finance'
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
  }
  users: { total: number; customers: number; merchants: number; admins: number }
  merchants: { total: number; pending: number; active: number; rejected: number }
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
      color: 'text-primary',
      bg: 'bg-primary/10',
      footer: `${pct(stats.loans.active + (stats.loans.paid ?? 0), stats.loans.total)}% cartera viva`,
    },
    {
      title: 'Activos',
      value: stats.loans.active.toLocaleString('es-AR'),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      footer: `Vigentes`,
    },
    {
      title: 'Pendientes',
      value: stats.loans.pending.toLocaleString('es-AR'),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      footer: `${pct(stats.loans.pending, stats.loans.total)}% a resolver`,
    },
    {
      title: 'Rechazados',
      value: stats.loans.rejected.toLocaleString('es-AR'),
      icon: XCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      footer: `${pct(stats.loans.rejected, stats.loans.total)}% tasa rechazo`,
    },
    {
      title: 'Pagados',
      value: (stats.loans.paid ?? 0).toLocaleString('es-AR'),
      icon: ShieldCheck,
      color: 'text-teal-600',
      bg: 'bg-teal-500/10',
      footer: 'Finalizados OK',
    },
    {
      title: 'Volumen Desembolsado',
      value: formatARS(stats.loans.volume),
      icon: Wallet,
      color: 'text-indigo-600',
      bg: 'bg-indigo-500/10',
      footer: `Ticket prom. ${stats.loans.active ? formatARS(stats.loans.volume / (stats.loans.active + (stats.loans.paid ?? 0))) : '—'}`,
    },
  ]

  const userCards = [
    {
      title: 'Usuarios Totales',
      value: stats.users.total.toLocaleString('es-AR'),
      icon: Users,
      color: 'text-sky-600',
      bg: 'bg-sky-500/10',
    },
    {
      title: 'Clientes',
      value: stats.users.customers.toLocaleString('es-AR'),
      icon: CreditCard,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Comercios',
      value: stats.users.merchants.toLocaleString('es-AR'),
      icon: Store,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Administradores',
      value: stats.users.admins.toLocaleString('es-AR'),
      icon: ShieldCheck,
      color: 'text-purple-600',
      bg: 'bg-purple-500/10',
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
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
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
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {c.title}
                </CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg}`}>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-xl font-bold tracking-tight">{c.value}</div>
                {c.footer ? (
                  <div className="text-[11px] text-muted-foreground">{c.footer}</div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Embudos de Créditos
              </CardTitle>
              <span className="text-xs text-muted-foreground">Estado actual de la cartera</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
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
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Pendientes de resolución
                </span>
                <span className="font-semibold tabular-nums text-amber-600">{pendingPct}%</span>
              </div>
              <Progress value={pendingPct} className="h-2 [&>div]:bg-amber-500" />
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

            <div className="grid grid-cols-4 gap-2 pt-3 border-t">
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Aprob</div>
                <div className="text-lg font-bold text-emerald-600 tabular-nums">{stats.loans.active}</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Pend</div>
                <div className="text-lg font-bold text-amber-600 tabular-nums">{stats.loans.pending}</div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Rech</div>
                <div className="text-lg font-bold text-destructive tabular-nums">{stats.loans.rejected}</div>
              </div>
              <div className="rounded-lg bg-teal-500/10 p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Pag</div>
                <div className="text-lg font-bold text-teal-600 tabular-nums">{stats.loans.paid ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Distribución de Comercios
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {merchantActivePct}% habilitados
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
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
            <div className="grid gap-3 grid-cols-2 pt-2">
              {merchantCards.map((c) => (
                <div key={c.title} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md ${c.bg}`}>
                      <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                    </div>
                    {c.title}
                  </div>
                  <div className="text-lg font-bold tabular-nums">{c.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">Base de Usuarios</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {userCards.map((c) => (
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {c.title}
                </CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg}`}>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
