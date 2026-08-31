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
import { DonutChart, LineChart } from '@/components/unicred/dashboard-kit'
import { OpsFloor } from '@/components/unicred/workspace-shell'
import { Building2, MapPin } from 'lucide-react'
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
    cancelled: 'bg-slate-100 text-slate-600',
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
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', map[status] ?? 'bg-slate-100 text-slate-600')}>
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
  const cancelledCount = loans.filter((l) => l.status === 'cancelled').length
  const rejectedCount = stats.loans.rejected ?? 0
  const evaluatingCount = pendingLoans.length
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

  const provinces = useMemo(() => {
    const map = new Map<string, { people: number; loans: number }>()
    for (const u of users) {
      const key = (u.province || 'Sin provincia').trim() || 'Sin provincia'
      const cur = map.get(key) ?? { people: 0, loans: 0 }
      cur.people += 1
      map.set(key, cur)
    }
    for (const l of loans) {
      const p = byUser.get(l.userId)?.province?.trim() || 'Sin provincia'
      const cur = map.get(p) ?? { people: 0, loans: 0 }
      cur.loans += 1
      map.set(p, cur)
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.loans - a.loans || b.people - a.people)
      .slice(0, 8)
  }, [users, loans, byUser])

  const topMerchants = useMemo(() => {
    const ops = new Map<string, { count: number; volume: number }>()
    for (const l of loans) {
      if (!l.merchantId) continue
      const cur = ops.get(l.merchantId) ?? { count: 0, volume: 0 }
      cur.count += 1
      cur.volume += Number(l.principal) || 0
      ops.set(l.merchantId, cur)
    }
    return merchants
      .map((m) => {
        const o = ops.get(m.id) ?? { count: 0, volume: 0 }
        return { ...m, operations: o.count, volume: o.volume, ticket: o.count ? o.volume / o.count : 0 }
      })
      .sort((a, b) => b.operations - a.operations || b.volume - a.volume)
      .slice(0, 6)
  }, [merchants, loans])

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
          'flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2',
          openDecisions > 0
            ? pendingLoans.length
              ? 'border-amber-200 bg-amber-50'
              : 'border-slate-200 bg-white'
            : 'border-emerald-200 bg-emerald-50',
        )}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-brand-navy-900">
            {openDecisions > 0
              ? `${openDecisions} ${openDecisions === 1 ? 'decisión' : 'decisiones'} en cola`
              : 'Sin cola operativa'}
          </p>
          <p className="text-[11px] text-slate-600">
            {pendingLoans.length} créditos · {pendingKyc.length} KYC · {pendingMerchants.length} comercios · {pendingDisb.length} desembolsos
            {overdue > 0 ? ` · mora ${formatARS(overdue)}` : ''}
          </p>
        </div>
        {openDecisions > 0 ? (
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={() => onNavigate(pendingLoans.length ? 'creditos' : pendingKyc.length ? 'kyc' : pendingMerchants.length ? 'comercios' : 'desembolsos')}
          >
            Resolver
          </Button>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
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
          <div
            key={cell.label}
            className={cn(
              'rounded-lg border bg-white px-2.5 py-1.5',
              cell.warn ? 'border-rose-200' : 'border-slate-200',
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{cell.label}</p>
            <p className="truncate text-[15px] font-semibold tabular-nums leading-tight text-brand-navy-900">{cell.value}</p>
            <p className="truncate text-[10px] text-slate-500">{cell.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-5">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <div>
              <h2 className="text-[12px] font-semibold text-brand-navy-900">Originación / día</h2>
              <p className="text-[10px] text-slate-500">
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
                    days === n ? 'bg-brand-navy-900 text-white' : 'text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {n}d
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 px-2 pt-1">
            <LineChart points={daySeries.map((d) => d.value)} labels={daySeries.map((d) => d.label)} color="#20BD5A" height={132} />
          </div>
          <div className="shrink-0 border-t border-slate-100 px-3 py-2">
            <DonutChart
              size={112}
              stroke={14}
              centerTitle="Total"
              centerValue={String(stats.loans.total ?? 0)}
              segments={[
                { label: 'Aprob.', value: approvedCount, color: '#00C853', count: approvedCount },
                { label: 'Eval.', value: evaluatingCount, color: '#20BD5A', count: evaluatingCount },
                { label: 'Rech.', value: rejectedCount, color: '#DC2626', count: rejectedCount },
                { label: 'Canc.', value: cancelledCount, color: '#94A3B8', count: cancelledCount },
              ]}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-3">
          <header className="shrink-0 border-b border-slate-100 px-3 py-1.5">
            <h2 className="text-[12px] font-semibold">Cola y red</h2>
            <p className="text-[10px] text-slate-500">Lo que bloquea originación hoy</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">Sin alertas abiertas.</p>
            ) : (
              alerts.map((a) =>
                a ? (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => onNavigate(a.tab)}
                    className="flex w-full items-start justify-between gap-2 border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{a.tone}</p>
                      <p className="text-[12px] font-medium">{a.title}</p>
                      <p className="text-[11px] text-slate-500">{a.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-brand-primary">Abrir</span>
                  </button>
                ) : null,
              )
            )}
            {pendingKyc.slice(0, 3).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => onNavigate('kyc')}
                className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{k.user?.fullName || k.user?.email || 'Cliente'}</p>
                  <p className="text-[10px] text-slate-500">KYC · {kycStatusLabel(k.status)}</p>
                </div>
                <span className="text-[11px] text-amber-700">Revisar</span>
              </button>
            ))}
            {pendingMerchants.slice(0, 3).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate('comercios')}
                className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{m.businessName}</p>
                  <p className="font-mono text-[10px] text-slate-500">{m.cuit}</p>
                </div>
                <span className="text-[11px] text-amber-700">Validar</span>
              </button>
            ))}
            <div className="px-3 py-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <MapPin className="h-3 w-3" /> Provincias
              </p>
              {provinces.length === 0 ? (
                <p className="text-[11px] text-slate-500">Sin domicilio fiscal.</p>
              ) : (
                <ul className="space-y-0.5">
                  {provinces.slice(0, 5).map((p) => (
                    <li key={p.name} className="flex justify-between gap-2 text-[11px]">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{p.loans} cr.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-4">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <div>
              <h2 className="text-[12px] font-semibold">Blotter · solicitudes</h2>
              <p className="text-[10px] text-slate-500">Últimas altas · click para el expediente</p>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onNavigate('solicitudes')}>
              Todas
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">Cliente</th>
                  <th className="px-3 py-1.5 text-right">Monto</th>
                  <th className="px-3 py-1.5">Estado</th>
                  <th className="px-3 py-1.5 text-right">Score</th>
                  <th className="px-3 py-1.5">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loans.slice(0, 12).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      No hay solicitudes.
                    </td>
                  </tr>
                ) : (
                  loans.slice(0, 12).map((l) => {
                    const u = byUser.get(l.userId)
                    return (
                      <tr
                        key={l.id}
                        className="cursor-pointer border-t border-slate-50 hover:bg-slate-50"
                        onClick={() => router.push(adminLoanHref(l.id, l.status))}
                      >
                        <td className="max-w-[140px] truncate px-3 py-1.5 font-medium">{u?.name || u?.email || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatARS(l.principal)}</td>
                        <td className="px-3 py-1.5">{loanBadge(l.status)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{l.scoreAtApproval ?? '—'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{formatDate(l.createdAt)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {topMerchants.length > 0 ? (
            <div className="shrink-0 border-t border-slate-100 px-3 py-1.5">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <Building2 className="h-3 w-3" /> Top comercios
              </p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {topMerchants.slice(0, 4).map((m) => (
                  <li key={m.id} className="flex justify-between gap-2 text-[11px]">
                    <span className="truncate">{m.businessName}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{m.operations} ops</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </OpsFloor>
  )
}
