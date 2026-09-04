'use client'

import type { AdminOpsDesk } from '@/app/actions/admin-ops'
import type { StatsData } from '@/components/admin/summary-cards'
import { Button } from '@/components/ui/button'
import type { AdminTabId } from '@/lib/admin-nav'
import { adminLoanHref } from '@/lib/admin-nav'
import { opnfcBand, opnfcLabel, OPNFC_THRESHOLD_ARS } from '@/lib/compliance/opnfc'
import { formatARS } from '@/lib/finance'
import { kycStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { LineChart } from '@/components/unicred/dashboard-kit'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type LoanRow = {
  id: string
  userId: string
  merchantId?: string | null
  principal: string | number
  term: number
  status: string
  scoreAtApproval: number | null
  createdAt: Date | string
}

type MerchantRow = {
  id: string
  businessName: string
  cuit: string
  category: string | null
  status: string
}

type UserRow = {
  id: string
  name?: string | null
  email?: string | null
  province?: string | null
}

type KycRow = { id: string; status: string; user?: { fullName?: string | null; email?: string | null } | null }
type DisbRow = { id: string; status: string }

function formatDate(v: Date | string | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function loanBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-800',
    approved: 'bg-emerald-500/10 text-emerald-800',
    active: 'bg-emerald-500/10 text-emerald-800',
    rejected: 'bg-rose-500/10 text-rose-800',
    paid: 'bg-teal-500/10 text-teal-800',
    cancelled: 'bg-muted text-slate-600',
  }
  const label: Record<string, string> = {
    pending: 'En evaluación',
    approved: 'Aprobado',
    active: 'Activo',
    rejected: 'Rechazado',
    paid: 'Pagado',
    cancelled: 'Cancelado',
    disbursed: 'Desembolsado',
  }
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', map[status] ?? 'bg-muted text-slate-600')}>
      {label[status] ?? status}
    </span>
  )
}

export function AdminControlTower({
  stats,
  loans,
  merchants,
  users,
  kycList,
  disbursementList,
  opsDesk,
  onNavigate,
}: {
  stats: StatsData
  loans: LoanRow[]
  merchants: MerchantRow[]
  users: UserRow[]
  kycList: KycRow[]
  disbursementList: DisbRow[]
  opsDesk: AdminOpsDesk
  onNavigate: (tab: AdminTabId) => void
}) {
  const router = useRouter()
  const [days, setDays] = useState<7 | 30 | 90>(30)

  const pendingLoans = loans.filter((l) => l.status === 'pending')
  const pendingMerchants = merchants.filter((m) => m.status === 'pending')
  const pendingKyc = kycList.filter((k) =>
    ['pending_review', 'pending', 'reviewing', 'submitted', 'in_review'].includes(k.status),
  )
  const pendingDisb = disbursementList.filter((d) => d.status === 'pending' || d.status === 'processing')
  const approvedCount = loans.filter((l) => ['approved', 'active', 'paid', 'disbursed'].includes(l.status)).length
  const totalProcessed = (stats.loans.active ?? 0) + (stats.loans.paid ?? 0)
  const approvalPct = stats.loans.total ? Math.round((totalProcessed / stats.loans.total) * 100) : 0
  const outstanding = Number(stats.loans.outstanding ?? 0)
  const overdue = opsDesk.kpis.overdueAmount
  const moraPct = outstanding > 0 ? Math.round((overdue / outstanding) * 1000) / 10 : 0
  const openDecisions = pendingLoans.length + pendingKyc.length + pendingMerchants.length + pendingDisb.length
  const band = opnfcBand(outstanding)

  const now = new Date()
  const thisMonth = loans.filter((l) => {
    const c = new Date(l.createdAt)
    return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear()
  }).length
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = loans.filter((l) => {
    const c = new Date(l.createdAt)
    return c.getMonth() === lastMonthDate.getMonth() && c.getFullYear() === lastMonthDate.getFullYear()
  }).length
  const mom =
    lastMonth > 0 ? `${(((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)}%` : thisMonth > 0 ? 'Mes en curso' : undefined

  const daySeries = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (days - 1 - i))
      const count = loans.filter((l) => {
        const c = new Date(l.createdAt)
        c.setHours(0, 0, 0, 0)
        return c.getTime() === d.getTime()
      }).length
      return {
        label: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        value: count,
      }
    })
  }, [loans, days])

  const avgDay = daySeries.length ? Math.round((daySeries.reduce((a, p) => a + p.value, 0) / daySeries.length) * 10) / 10 : 0
  const byUser = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const alerts = [
    overdue > 0
      ? { tone: 'RIESGO' as const, title: 'Cartera vencida', detail: `${formatARS(overdue)} · ${opsDesk.kpis.overdueCount} cuotas`, tab: 'cobranzas' as AdminTabId }
      : null,
    pendingLoans.length
      ? { tone: 'OPERACIONES' as const, title: 'Solicitudes en evaluación', detail: `${pendingLoans.length} créditos por decidir`, tab: 'creditos' as AdminTabId }
      : null,
    pendingKyc.length
      ? { tone: 'DOCUMENTACIÓN' as const, title: 'Identidad pendiente', detail: `${pendingKyc.length} Didit / KYC`, tab: 'kyc' as AdminTabId }
      : null,
    pendingDisb.length
      ? { tone: 'OPERACIONES' as const, title: 'Desembolsos sin acreditar', detail: `${pendingDisb.length} giros`, tab: 'desembolsos' as AdminTabId }
      : null,
    band !== 'below'
      ? {
          tone: 'RIESGO' as const,
          title: band === 'threshold_crossed' ? 'Umbral PNFC cruzado' : 'Umbral PNFC cercano',
          detail: `${formatARS(outstanding)} vs ${formatARS(OPNFC_THRESHOLD_ARS)}`,
          tab: 'cartera_activa' as AdminTabId,
        }
      : null,
  ].filter(Boolean)

  return (
    <OpsFloor>
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-xs',
          openDecisions > 0
            ? pendingLoans.length
              ? 'border-amber-200 bg-amber-50'
              : 'border-border bg-card'
            : 'border-emerald-200 bg-emerald-50',
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-navy-900">
            {openDecisions > 0
              ? `${openDecisions} ${openDecisions === 1 ? 'decisión' : 'decisiones'} en cola`
              : 'Sin cola operativa'}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {pendingLoans.length} créditos · {pendingKyc.length} KYC · {pendingMerchants.length} comercios · {pendingDisb.length} desembolsos
            {overdue > 0 ? ` · mora ${formatARS(overdue)}` : ''}
          </p>
        </div>
        {openDecisions > 0 ? (
          <Button
            size="sm"
            className="h-9 shrink-0"
            onClick={() => onNavigate(pendingLoans.length ? 'creditos' : pendingKyc.length ? 'kyc' : pendingMerchants.length ? 'comercios' : 'desembolsos')}
          >
            Resolver
          </Button>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: 'Solicitudes', value: (stats.loans.total ?? 0).toLocaleString('es-AR'), hint: mom ?? `${thisMonth} este mes` },
          { label: 'Aprobadas', value: String(approvedCount), hint: `${approvalPct}% del total` },
          { label: 'Desembolsado', value: formatARS(stats.loans.volume), hint: `${stats.loans.active ?? 0} vigentes` },
          { label: 'Clientes', value: (stats.users.customers ?? 0).toLocaleString('es-AR'), hint: `${stats.users.merchants ?? 0} comercios` },
          { label: 'Cartera', value: formatARS(outstanding), hint: opnfcLabel(band) },
          { label: 'Mora', value: formatARS(overdue), hint: `${opsDesk.kpis.overdueCount} cuotas · ${moraPct}%`, warn: overdue > 0 },
          { label: 'Vence 7d', value: formatARS(opsDesk.kpis.due7Amount), hint: `${opsDesk.kpis.due7Count} cuotas` },
          { label: 'Cobrado mes', value: formatARS(opsDesk.kpis.collectedMonth), hint: `${opsDesk.kpis.receiptsMonth} recibos` },
        ].map((cell) => (
          <MetricTile
            key={cell.label}
            label={cell.label}
            value={cell.value}
            hint={cell.hint}
            tone={cell.warn ? 'critical' : 'default'}
          />
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-12">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:col-span-4">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div>
              <h2 className="text-[13px] font-semibold text-brand-navy-900">Originación / día</h2>
              <p className="text-[11px] text-muted-foreground">
                Prom. {avgDay}/día · {daySeries.reduce((a, p) => a + p.value, 0)} en el período
              </p>
            </div>
            <div className="flex gap-0.5">
              {([7, 30, 90] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDays(n)}
                  className={cn(
                    'h-6 rounded px-1.5 text-[10px] font-medium',
                    days === n ? 'bg-brand-navy-900 text-white' : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {n}d
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 px-3 py-3">
            <LineChart points={daySeries.map((d) => d.value)} labels={daySeries.map((d) => d.label)} color="#20BD5A" height={220} />
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:col-span-3">
          <header className="shrink-0 border-b border-border px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-brand-navy-900">Cola y red</h2>
            <p className="text-[11px] text-muted-foreground">Lo que bloquea originación hoy</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">Sin alertas abiertas.</p>
            ) : (
              alerts.map((a) =>
                a ? (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => onNavigate(a.tab)}
                    className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-left hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{a.tone}</p>
                      <p className="text-[12px] font-medium">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-brand-primary">Abrir</span>
                  </button>
                ) : null,
              )
            )}
            {pendingKyc.slice(0, 3).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => onNavigate('kyc')}
                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2.5 text-left hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{k.user?.fullName || k.user?.email || 'Cliente'}</p>
                  <p className="text-[10px] text-muted-foreground">KYC · {kycStatusLabel(k.status)}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-amber-700">Revisar</span>
              </button>
            ))}
            {pendingMerchants.slice(0, 3).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate('comercios')}
                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2.5 text-left hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{m.businessName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{m.cuit}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-amber-700">Validar</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:col-span-5">
          <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <h2 className="text-[13px] font-semibold text-brand-navy-900">Blotter · solicitudes</h2>
              <p className="text-[11px] text-muted-foreground">Últimas altas · click para el expediente</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onNavigate('solicitudes')}>
              Todas
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2 text-right">Monto</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loans.slice(0, 12).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No hay solicitudes.
                    </td>
                  </tr>
                ) : (
                  loans.slice(0, 12).map((l) => {
                    const u = byUser.get(l.userId)
                    return (
                      <tr
                        key={l.id}
                        className="cursor-pointer border-t border-slate-100 hover:bg-muted/60"
                        onClick={() => router.push(adminLoanHref(l.id, l.status))}
                      >
                        <td className="truncate px-4 py-2 font-medium">{u?.name || u?.email || '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatARS(l.principal)}</td>
                        <td className="px-4 py-2">{loanBadge(l.status)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(l.createdAt)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </OpsFloor>
  )
}
