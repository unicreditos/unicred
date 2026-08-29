'use client'

import { BcraVariablesGrid } from '@/components/admin/bcra-variables-grid'
import { BcraCuitLookup } from '@/components/admin/bcra-cuit-lookup'
import { BcraCatalogPanel } from '@/components/admin/bcra-catalog-panel'
import { LoansTable } from '@/components/admin/loans-table'
import { MerchantsTable } from '@/components/admin/merchants-table'
import { BankAccountsTable } from '@/components/admin/bank-accounts-table'
import { UsersTable } from '@/components/admin/users-table'
import { ClientFicha } from '@/components/admin/client-ficha'
import { CobranzasDesk, ComprobantesDesk, LegalesDesk, MovimientosDesk } from '@/components/admin/ops-desks'
import { AdminClaimsDesk } from '@/components/admin/claims-desk'
import { type StatsData } from '@/components/admin/summary-cards'
import type { ClientFicha as ClientFichaData } from '@/app/actions/admin-ficha'
import type { AdminOpsDesk } from '@/app/actions/admin-ops'
import type { AdminTabId } from '@/components/admin/admin-app-shell'
import { adminUrl } from '@/lib/admin-nav'


import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { csvDateSuffix, downloadCsv } from '@/lib/csv'
import { computeFrenchAmortization, formatARS, formatCBU, formatCVU } from '@/lib/finance'
import { kycStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { DonutChart, KpiCard, LineChart } from '@/components/unicred/dashboard-kit'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import * as React from 'react'
import { useMemo, useState, useTransition } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Hand as HandIcon,
  LayoutDashboard,
  Percent,
  Receipt as ReceiptIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  User as UserIcon,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import { KYCReviewCard, type KYCAdminRow } from '@/components/admin/kyc-review-card'
import { markDisbursementAsCredited } from '@/app/actions/banking'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type LoanRow = {
  id: string
  userId: string
  principal: string | number
  term: number
  status: string
  scoreAtApproval: number | null
  createdAt: Date | string
  contractId?: string | null
  contractStatus?: string | null
}

type MerchantRow = {
  id: string
  businessName: string
  cuit: string
  category: string | null
  status: string
  createdAt?: Date | string
  personType?: string | null
  taxCondition?: string | null
  taxStatus?: string | null
  kybStatus?: string | null
  titularMatch?: string | null
  legalName?: string | null
  kybBlockers?: string[] | null
}

type VariableBCRA = {
  idVariable: number
  descripcion: string
  fecha: string
  valor: number
}

type KYCRow = KYCAdminRow

type DisbursementRow = {
  id: string
  loanId: string
  userId: string
  bankAccountId: string | null
  amount: string | number
  netAmount: string | number | null
  status: string
  disbursementMethod: string
  referenceNumber: string | null
  receiptNumber: string | null
  expectedDate: Date | string | null
  creditedAt: Date | string | null
  createdAt: Date | string
  failureReason: string | null
  customer: { fullName: string | null; cuil: string | null; email: string | null } | null
  loan: { principal: string | number; term: number; totalAmount: string | number; status: string } | null
  bankAccount: {
    bankName: string
    accountType: string
    cbu: string | null
    cvu: string | null
    alias: string | null
    holderName: string
    holderCuil: string
  } | null
  contract?: { id: string; loanId: string; status: string } | null
}

type AuditRow = {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  action: string
  entityType: string
  entityId: string | null
  targetUserId: string | null
  severity: string
  summary: string
  changes: Record<string, unknown> | null
  createdAt: Date | string
}

type ProductRow = {
  id: string
  name: string
  type: string
  minAmount: string | number
  maxAmount: string | number
  minTerm: number
  maxTerm: number
  monthlyRate: string | number
  tna: string | number
  active: boolean
}

function shortId(id: string) {
  if (id.length > 12) return id.slice(0, 4) + '…' + id.slice(-4)
  return id
}

function formatPct(value: string | number | null | undefined) {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

/**
 * CFT estimado a partir de la tasa mensual: capitaliza los 12 meses. Es una
 * referencia; el CFT contractual sale del contrato de cada crédito.
 */
function estimatedCft(monthlyRate: string | number | null | undefined) {
  const m = typeof monthlyRate === 'string' ? parseFloat(monthlyRate) : Number(monthlyRate)
  if (!Number.isFinite(m) || m <= 0) return null
  return computeFrenchAmortization(100_000, 12, m).cft
}

function formatDate(v: Date | string | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function loanBadge(status: string) {
  const map: Record<string, { label: string; className: string; dot: string }> = {
    pending: { label: 'Pendiente', className: 'bg-amber-500/10 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    approved: { label: 'Aprobado', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    active: { label: 'Activo', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    rejected: { label: 'Rechazado', className: 'bg-destructive/10 text-destructive border-destructive/20', dot: 'bg-destructive' },
    paid: { label: 'Pagado', className: 'bg-teal-500/10 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  }
  const cfg = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function pct(p: number, t: number) {
  if (!t) return 0
  return Math.round((p / t) * 100)
}

export function AdminContent({
  activeTab,
  personaId = null,
  ficha = null,
  fichaError = null,
  opsDesk,
  stats,
  loans,
  merchants,
  bcra,
  kycList = [],
  disbursementList = [],
  bankAccounts = [],
  users = [],
  currentAdminId = '',
  products = [],
  auditLog = [],
  onNavigate,
}: {
  activeTab: AdminTabId
  personaId?: string | null
  ficha?: ClientFichaData | null
  fichaError?: string | null
  opsDesk: AdminOpsDesk
  stats: StatsData
  loans: LoanRow[]
  merchants: MerchantRow[]
  bcra: VariableBCRA[]
  kycList?: KYCRow[]
  disbursementList?: DisbursementRow[]
  bankAccounts?: any[]
  users?: any[]
  currentAdminId?: string
  products?: ProductRow[]
  auditLog?: AuditRow[]
  onNavigate?: (tab: AdminTabId) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }
  // Instante de referencia estable para los cálculos "en los últimos N días".
  const [now] = useState(() => Date.now())
  const [loanFilter, setLoanFilter] = useState<string>('all')
  const [loanSearch, setLoanSearch] = useState('')
  const [merchantFilter, setMerchantFilter] = useState<string>('all')
  const [kycFilter, setKycFilter] = useState<string>('all')
  const [kycSearch, setKycSearch] = useState('')
  const [disbFilter, setDisbFilter] = useState<string>('pending')

  const filteredLoans = useMemo(() => {
    const term = loanSearch.trim().toLowerCase()
    return loans.filter((l) => {
      if (loanFilter !== 'all' && l.status !== loanFilter) return false
      if (!term) return true
      return (
        l.id.toLowerCase().includes(term) ||
        l.userId.toLowerCase().includes(term) ||
        String(l.principal).includes(term)
      )
    })
  }, [loans, loanFilter, loanSearch])

  const filteredMerchants = useMemo(() => {
    const sorted = [...merchants].sort((a, b) => {
      const order = { pending: 0, active: 1, rejected: 2 } as Record<string, number>
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })
    if (merchantFilter === 'all') return sorted
    return sorted.filter((m) => m.status === merchantFilter)
  }, [merchants, merchantFilter])

  if (activeTab === 'overview') {
    const pendingLoans = loans.filter((l) => l.status === 'pending')
    const pendingMerchants = merchants.filter((m) => m.status === 'pending')
    const pendingKyc = kycList.filter((k) =>
      ['pending_review', 'pending', 'reviewing', 'submitted', 'in_review'].includes(k.status),
    )
    const pendingDisb = disbursementList.filter((d) => d.status === 'pending' || d.status === 'processing')
    const totalProcessed = (stats.loans.active ?? 0) + (stats.loans.paid ?? 0)
    const approvalPct = stats.loans.total ? Math.round((totalProcessed / stats.loans.total) * 100) : 0
    const ticket =
      stats.loans.active && Number(stats.loans.volume ?? 0)
        ? Math.round(Number(stats.loans.volume) / stats.loans.active)
        : 0
    const openDecisions = pendingLoans.length + pendingKyc.length + pendingMerchants.length + pendingDisb.length
    const recent = [...loans].slice(0, 8)
    const approvedCount = loans.filter((l) => ['approved', 'active', 'paid', 'disbursed'].includes(l.status)).length
    const cancelledCount = loans.filter((l) => l.status === 'cancelled').length
    const evaluatingCount = pendingLoans.length
    const rejectedCount = stats.loans.rejected ?? 0
    const now = new Date()
    const daySeries = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (13 - i))
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
    const thisMonth = loans.filter((l) => {
      const c = new Date(l.createdAt)
      return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear()
    }).length
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = loans.filter((l) => {
      const c = new Date(l.createdAt)
      return c.getMonth() === lastMonthDate.getMonth() && c.getFullYear() === lastMonthDate.getFullYear()
    }).length
    const mom = lastMonth > 0 ? `${(((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1)}%` : thisMonth > 0 ? 'Mes en curso' : undefined

    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {openDecisions > 0 ? (
          <DecisionBanner
            tone={pendingLoans.length ? 'warn' : 'info'}
            title={`${openDecisions} ${openDecisions === 1 ? 'decisión' : 'decisiones'} en cola`}
            detail={`${pendingLoans.length} créditos · ${pendingKyc.length} KYC · ${pendingMerchants.length} comercios · ${pendingDisb.length} desembolsos`}
            action={
              <Button size="sm" onClick={() => onNavigate?.(pendingLoans.length ? 'creditos' : pendingKyc.length ? 'kyc' : 'comercios')}>
                Resolver ahora
              </Button>
            }
          />
        ) : (
          <DecisionBanner tone="ok" title="Sin cola operativa" detail="No hay créditos, KYC, comercios ni desembolsos pendientes." />
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Solicitudes totales"
            value={(stats.loans.total ?? 0).toLocaleString('es-AR')}
            delta={mom}
            deltaLabel={lastMonth > 0 ? 'vs. mes anterior' : undefined}
            tone={lastMonth > 0 && thisMonth >= lastMonth ? 'up' : 'neutral'}
            icon={<FileText className="h-5 w-5" />}
            footer={`${thisMonth} este mes`}
          />
          <KpiCard
            title="Aprobadas"
            value={approvedCount.toLocaleString('es-AR')}
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconBg="bg-emerald-50 text-emerald-600"
            footer={`${approvalPct}% del total`}
            tone="up"
          />
          <KpiCard
            title="Desembolsadas"
            value={formatARS(stats.loans.volume)}
            icon={<Coins className="h-5 w-5" />}
            footer={`${stats.loans.active ?? 0} créditos activos`}
          />
          <KpiCard
            title="Clientes activos"
            value={(stats.users.customers ?? 0).toLocaleString('es-AR')}
            icon={<UserIcon className="h-5 w-5" />}
            footer={`${stats.users.merchants ?? 0} comercios · ticket ${formatARS(ticket)}`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-7">
            <h2 className="text-sm font-semibold text-brand-navy-900">Solicitudes por día</h2>
            <p className="mb-3 text-xs text-slate-500">Originación real de los últimos 14 días</p>
            <LineChart
              points={daySeries.map((d) => d.value)}
              labels={daySeries.map((d) => d.label)}
              color="#20BD5A"
              height={220}
            />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-5">
            <h2 className="text-sm font-semibold text-brand-navy-900">Estado de solicitudes</h2>
            <p className="mb-3 text-xs text-slate-500">Distribución de la cartera cargada</p>
            <DonutChart
              centerTitle="Total"
              centerValue={String(stats.loans.total ?? 0)}
              segments={[
                { label: 'Aprobadas', value: approvedCount, color: '#00C853', count: approvedCount },
                { label: 'En evaluación', value: evaluatingCount, color: '#20BD5A', count: evaluatingCount },
                { label: 'Rechazadas', value: rejectedCount, color: '#DC2626', count: rejectedCount },
                { label: 'Canceladas', value: cancelledCount, color: '#94A3B8', count: cancelledCount },
              ]}
            />
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-brand-navy-900">Cobranzas y tesorería</h2>
              <p className="mt-1 text-xs text-slate-500">
                Mercado: Argentina · moneda ARS. Mora, vencimientos y recibos del mes.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('cobranzas')}>
              Abrir mesa de cobro
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3">
              <p className="text-[11px] font-medium text-rose-700">Mora</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatARS(opsDesk.kpis.overdueAmount)}</p>
              <p className="text-[11px] text-slate-500">{opsDesk.kpis.overdueCount} cuotas vencidas</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-[11px] font-medium text-amber-800">Vence en 7 días</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatARS(opsDesk.kpis.due7Amount)}</p>
              <p className="text-[11px] text-slate-500">{opsDesk.kpis.due7Count} cuotas</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="text-[11px] font-medium text-emerald-800">Cobrado este mes</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatARS(opsDesk.kpis.collectedMonth)}</p>
              <p className="text-[11px] text-slate-500">{opsDesk.kpis.receiptsMonth} recibos</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium text-slate-600">A verificar</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{opsDesk.kpis.pendingReview}</p>
              <p className="text-[11px] text-slate-500">Transferencias RM</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium text-slate-600">Cupones abiertos</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{opsDesk.kpis.openTickets}</p>
              <p className="text-[11px] text-slate-500">Pago Fácil / Rapipago</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Créditos a decidir</h2>
                <p className="text-xs text-slate-500">Pendientes de aprobación o rechazo</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onNavigate?.('creditos')}>Abrir pipeline</Button>
            </header>
            <div className="divide-y divide-slate-100">
              {pendingLoans.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Sin créditos pendientes.</p>
              ) : (
                pendingLoans.slice(0, 6).map((l) => (
                  <button key={l.id} type="button" onClick={() => onNavigate?.('creditos')} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <div>
                      <p className="font-mono text-[11px] text-slate-500">{shortId(l.id)}</p>
                      <p className="text-sm font-semibold tabular-nums">{formatARS(l.principal)}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{l.term} cuotas</p>
                      <p>Score {l.scoreAtApproval ?? '—'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">KYC y comercios</h2>
                <p className="text-xs text-slate-500">Altas que bloquean originación o red</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onNavigate?.('usuarios')}>
                Personas
              </Button>
            </header>
            <div className="divide-y divide-slate-100">
              {pendingKyc.slice(0, 4).map((k) => (
                <button key={k.id} type="button" onClick={() => onNavigate?.('kyc')} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium">{k.user?.fullName || k.user?.email || 'Cliente'}</p>
                    <p className="text-xs text-slate-500">KYC · {kycStatusLabel(k.status)}</p>
                  </div>
                  <span className="text-xs text-amber-700">Revisar</span>
                </button>
              ))}
              {pendingMerchants.slice(0, 4).map((m) => (
                <button key={m.id} type="button" onClick={() => onNavigate?.('comercios')} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium">{m.businessName}</p>
                    <p className="font-mono text-xs text-slate-500">{m.cuit}</p>
                  </div>
                  <span className="text-xs text-amber-700">Validar</span>
                </button>
              ))}
              {pendingKyc.length === 0 && pendingMerchants.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Sin altas pendientes.</p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Solicitudes recientes</h2>
              <p className="text-xs text-slate-500">Movimiento real de cartera</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onNavigate?.('solicitudes')}>Ver todas</Button>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Plazo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Sin operaciones.</TableCell>
                  </TableRow>
                ) : (
                  recent.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{shortId(l.id)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatARS(l.principal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.term}</TableCell>
                      <TableCell>{loanBadge(l.status)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.scoreAtApproval ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    )
  }

  if (activeTab === 'creditos') {
    const counts: Record<string, number> = {}
    loans.forEach((l) => (counts[l.status] = (counts[l.status] ?? 0) + 1))

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-bold tabular-nums">{loans.length}</div>
          </div>
          <div className="rounded-lg border bg-emerald-500/5 p-3 space-y-1">
            <div className="text-xs text-emerald-700">Activos</div>
            <div className="text-xl font-bold tabular-nums text-emerald-700">{counts.active ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-amber-500/5 p-3 space-y-1">
            <div className="text-xs text-amber-700">Pendientes</div>
            <div className="text-xl font-bold tabular-nums text-amber-700">{counts.pending ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-destructive/5 p-3 space-y-1">
            <div className="text-xs text-destructive">Rechazados</div>
            <div className="text-xl font-bold tabular-nums text-destructive">{counts.rejected ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-teal-500/5 p-3 space-y-1">
            <div className="text-xs text-teal-700">Pagados</div>
            <div className="text-xl font-bold tabular-nums text-teal-700">{counts.paid ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-primary/5 p-3 space-y-1">
            <div className="text-xs text-primary">Volumen</div>
            <div className="text-xl font-bold tabular-nums text-primary">
              {formatARS(
                loans.reduce((acc, l) => acc + (typeof l.principal === 'string' ? parseFloat(l.principal) : l.principal || 0), 0),
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2">
          <Tabs value={loanFilter} onValueChange={setLoanFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="all" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <LayoutDashboard className="h-3 w-3 mr-1.5" />
                Todos ({loans.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <Clock className="h-3 w-3 mr-1.5 text-amber-600" />
                Pendientes ({counts.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger value="active" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-600" />
                Activos ({counts.active ?? 0})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <XCircle className="h-3 w-3 mr-1.5 text-destructive" />
                Rechazados ({counts.rejected ?? 0})
              </TabsTrigger>
              <TabsTrigger value="paid" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <ShieldCheck className="h-3 w-3 mr-1.5 text-teal-600" />
                Pagados ({counts.paid ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <LoansTable loans={filteredLoans} />
      </div>
    )
  }

  if (activeTab === 'comercios') {
    const counts: Record<string, number> = {}
    merchants.forEach((m) => (counts[m.status] = (counts[m.status] ?? 0) + 1))

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">{merchants.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Activos</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-emerald-600">
                {counts.active ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pendientes</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-amber-600">
                {counts.pending ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Rechazados</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-destructive">
                {counts.rejected ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2">
          <Tabs value={merchantFilter} onValueChange={setMerchantFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="all" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <LayoutDashboard className="h-3 w-3 mr-1.5" />
                Todos ({merchants.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <Clock className="h-3 w-3 mr-1.5 text-amber-600" />
                Pendientes ({counts.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger value="active" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-600" />
                Activos ({counts.active ?? 0})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <XCircle className="h-3 w-3 mr-1.5 text-destructive" />
                Rechazados ({counts.rejected ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <MerchantsTable merchants={filteredMerchants} />
      </div>
    )
  }

  if (activeTab === 'kyc') {
    const counts: Record<string, number> = {}
    kycList.forEach((k) => (counts[k.status] = (counts[k.status] ?? 0) + 1))

    const sortedKyc = [...kycList].sort((a, b) => {
      const order: Record<string, number> = { reviewing: 0, pending: 1, approved: 2, rejected: 3 }
      const oa = order[a.status] ?? 9
      const ob = order[b.status] ?? 9
      if (oa !== ob) return oa - ob
      return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    })
    const q = kycSearch.trim().toLowerCase()
    const filteredKyc = (() => {
      let list = sortedKyc
      if (kycFilter === 'pending_review') {
        list = sortedKyc.filter((k) => ['reviewing', 'pending', 'submitted', 'in_review'].includes(k.status))
      } else if (kycFilter !== 'all') {
        list = sortedKyc.filter((k) => k.status === kycFilter)
      }
      if (!q) return list
      return list.filter((k) => {
        const hay = [
          k.user?.fullName,
          k.user?.email,
          k.user?.cuil,
          k.user?.dni,
          k.dniNumber,
          k.providerReferenceId,
          k.ocr?.fullName,
          k.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    })()

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-bold tabular-nums">{kycList.length}</div>
          </div>
          <div className="rounded-lg border bg-sky-500/5 p-3 space-y-1">
            <div className="text-xs text-sky-700">En revisión</div>
            <div className="text-xl font-bold tabular-nums text-sky-700">{counts.reviewing ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-amber-500/5 p-3 space-y-1">
            <div className="text-xs text-amber-700">Pendientes</div>
            <div className="text-xl font-bold tabular-nums text-amber-700">{counts.pending ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-emerald-500/5 p-3 space-y-1">
            <div className="text-xs text-emerald-700">Aprobados</div>
            <div className="text-xl font-bold tabular-nums text-emerald-700">{counts.approved ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-rose-500/5 p-3 space-y-1">
            <div className="text-xs text-rose-700">Rechazados</div>
            <div className="text-xl font-bold tabular-nums text-rose-700">{counts.rejected ?? 0}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2">
          <Tabs value={kycFilter} onValueChange={setKycFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="pending_review" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <Clock className="h-3 w-3 mr-1.5 text-amber-600" />
                Por revisar ({(counts.reviewing ?? 0) + (counts.pending ?? 0)})
              </TabsTrigger>
              <TabsTrigger value="all" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <LayoutDashboard className="h-3 w-3 mr-1.5" />
                Todos ({kycList.length})
              </TabsTrigger>
              <TabsTrigger value="reviewing" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <Eye className="h-3 w-3 mr-1.5 text-sky-600" />
                Revisando ({counts.reviewing ?? 0})
              </TabsTrigger>
              <TabsTrigger value="approved" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-600" />
                Aprobados ({counts.approved ?? 0})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <XCircle className="h-3 w-3 mr-1.5 text-rose-600" />
                Rechazados ({counts.rejected ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={kycSearch}
            onChange={(e) => setKycSearch(e.target.value)}
            placeholder="Buscar por nombre, CUIL, DNI, email o sesión Didit"
            className="pl-9"
          />
        </div>

        {filteredKyc.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
              <UserCheck className="h-10 w-10 text-emerald-600" />
              <p className="font-medium">Nada para mostrar</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                No hay validaciones en este filtro. Cambiá a «Todos» o buscá por nombre, CUIL o DNI.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredKyc.map((k) => (
              <KYCReviewCard key={k.id} kyc={k} />
            ))}
          </div>
        )}

        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (activeTab === 'desembolsos') {
    const counts: Record<string, number> = {}
    disbursementList.forEach((d) => (counts[d.status] = (counts[d.status] ?? 0) + 1))

    const totalPendingAmount = disbursementList
      .filter((d) => d.status === 'pending' || d.status === 'processing')
      .reduce((acc, d) => acc + (typeof d.amount === 'string' ? parseFloat(d.amount) : Number(d.amount) || 0), 0)

    const sortedDisb = [...disbursementList].sort((a, b) => {
      const order: Record<string, number> = { processing: 0, pending: 1, credited: 2, failed: 3, reversed: 4 }
      const oa = order[a.status] ?? 9
      const ob = order[b.status] ?? 9
      if (oa !== ob) return oa - ob
      return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    })
    const filteredDisb = disbFilter === 'all' ? sortedDisb : sortedDisb.filter((d) => d.status === disbFilter)

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <DecisionBanner
          tone="warn"
          title="El botón no gira el dinero"
          detail="Acreditá solo después de transferir desde tesorería al CBU/CVU del cliente. Cargá TREASURY_CBU en el entorno para dejar constancia de la cuenta de origen."
        />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-bold tabular-nums">{disbursementList.length}</div>
          </div>
          <div className="rounded-lg border bg-amber-500/5 p-3 space-y-1">
            <div className="text-xs text-amber-700">Pendientes</div>
            <div className="text-xl font-bold tabular-nums text-amber-700">{counts.pending ?? 0}</div>
            <div className="text-[10px] font-mono text-amber-700/80">{formatARS(totalPendingAmount)}</div>
          </div>
          <div className="rounded-lg border bg-sky-500/5 p-3 space-y-1">
            <div className="text-xs text-sky-700">Procesando</div>
            <div className="text-xl font-bold tabular-nums text-sky-700">{counts.processing ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-emerald-500/5 p-3 space-y-1">
            <div className="text-xs text-emerald-700">Acreditados OK</div>
            <div className="text-xl font-bold tabular-nums text-emerald-700">{counts.credited ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-rose-500/5 p-3 space-y-1">
            <div className="text-xs text-rose-700">Fallidos</div>
            <div className="text-xl font-bold tabular-nums text-rose-700">{(counts.failed ?? 0) + (counts.reversed ?? 0)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2">
          <Tabs value={disbFilter} onValueChange={setDisbFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="pending" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <Clock className="h-3 w-3 mr-1.5 text-amber-600" />
                Pendientes ({counts.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger value="all" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <LayoutDashboard className="h-3 w-3 mr-1.5" />
                Todos ({disbursementList.length})
              </TabsTrigger>
              <TabsTrigger value="processing" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <CreditCard className="h-3 w-3 mr-1.5 text-sky-600" />
                Procesando ({counts.processing ?? 0})
              </TabsTrigger>
              <TabsTrigger value="credited" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1.5 text-emerald-600" />
                Acreditados ({counts.credited ?? 0})
              </TabsTrigger>
              <TabsTrigger value="failed" className="h-8 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
                <XCircle className="h-3 w-3 mr-1.5 text-rose-600" />
                Fallidos ({(counts.failed ?? 0) + (counts.reversed ?? 0)})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Comprobante / ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Cuenta destino</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDisb.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-xs">
                    Sin desembolsos para mostrar.
                  </TableCell>
                </TableRow>
              )}
              {filteredDisb.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold">
                      {d.receiptNumber ?? d.id.slice(0, 10)}
                    </div>
                    {d.referenceNumber && (
                      <div className="text-[10px] font-mono text-muted-foreground">
                        Ref: {d.referenceNumber}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium">
                      {d.customer?.fullName ?? `Cliente #${d.userId.slice(0, 8)}`}
                    </div>
                    {d.customer?.cuil && (
                      <div className="text-[10px] font-mono text-muted-foreground">
                        CUIL {d.customer.cuil}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono font-bold tabular-nums">{formatARS(d.amount)}</div>
                    {d.netAmount && d.netAmount !== d.amount && (
                      <div className="text-[10px] text-muted-foreground">
                        Neto: {formatARS(d.netAmount as any)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.bankAccount ? (
                      <div className="space-y-0.5 text-[11px]">
                        <div className="font-medium">{d.bankAccount.bankName}</div>
                        <div className="font-mono text-muted-foreground">
                          {d.bankAccount.accountType.toUpperCase()}
                          {d.bankAccount.cbu && ` · ${formatCBU(d.bankAccount.cbu)}`}
                          {d.bankAccount.cvu && !d.bankAccount.cbu && ` · ${formatCVU(d.bankAccount.cvu)}`}
                          {d.bankAccount.alias && ` · ${d.bankAccount.alias.toUpperCase()}`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sin cuenta asociada</span>
                    )}
                  </TableCell>
                  <TableCell>{disbBadge(d.status)}</TableCell>
                  <TableCell className="text-[11px] font-mono text-muted-foreground">
                    {formatDate(d.expectedDate ?? d.createdAt)}
                    {d.creditedAt && (
                      <div className="text-emerald-700 dark:text-emerald-400">
                        Acreditado: {formatDate(d.creditedAt)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {(d.status === 'pending' || d.status === 'processing') && (
                        <Button
                          size="sm"
                          disabled={isPending || d.contract?.status !== 'accepted'}
                          className="gap-1 bg-emerald-600 hover:bg-emerald-600"
                          title={
                            d.contract?.status === 'accepted'
                              ? 'Acreditar desembolso'
                              : 'El cliente debe firmar el contrato y el pagaré'
                          }
                          onClick={() =>
                            startTransition(async () => {
                              try {
                                const r = await markDisbursementAsCredited(d.id)
                                showToast(
                                  'ok',
                                  `Acreditado OK · Comprobante ${(r as any)?.receiptNumber ?? 'emitido'}`,
                                )
                                router.refresh()
                              } catch (e: any) {
                                showToast('err', e?.message ?? 'Error al acreditar')
                              }
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Marcar acreditado
                        </Button>
                      )}
                      {d.contract?.id && (
                        <Link
                          href={`/dashboard/documentos/contrato/${d.contract.id}`}
                          className="inline-flex"
                        >
                          <Button size="sm" variant="outline" className="gap-1">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            {d.contract.status === 'accepted' ? 'Expediente' : 'Pendiente firma'}
                          </Button>
                        </Link>
                      )}
                      {d.receiptNumber && (
                        <Link
                          href={`/dashboard/documentos/recibo/${d.id}`}
                          className="inline-flex"
                        >
                          <Button size="sm" variant="outline" className="gap-1">
                            <ReceiptIcon className="h-3.5 w-3.5" /> Comprobante
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (activeTab === 'cobranzas') {
    return <CobranzasDesk desk={opsDesk} />
  }

  if (activeTab === 'comprobantes') {
    return <ComprobantesDesk desk={opsDesk} />
  }

  if (activeTab === 'movimientos') {
    return <MovimientosDesk desk={opsDesk} />
  }

  if (activeTab === 'legales') {
    return <LegalesDesk desk={opsDesk} />
  }

  if (activeTab === 'reclamos') {
    return <AdminClaimsDesk />
  }

  if (activeTab === 'cobros') {
    return <CobranzasDesk desk={opsDesk} />
  }

  if (activeTab === 'cuentas-bancarias') {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <BankAccountsTable accounts={bankAccounts} />

        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (activeTab === 'bcra') {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <BcraCuitLookup />
        <BcraCatalogPanel />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-primary/[0.02] border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Cobertura del panel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{bcra.length} variables</div>
              <p className="text-xs text-muted-foreground mt-1">Tasas, inflación, reservas, tipo de cambio, LELIQ, Pases, etc.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-600" />
                Última actualización
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold tabular-nums">
                {bcra[0]?.fecha
                  ? new Date(bcra[0].fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Fecha de publicación en el BCRA</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                Motor scoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold tabular-nums">Activo</div>
              <p className="text-xs text-muted-foreground mt-1">Variables consumidas automáticamente por el algoritmo de evaluación crediticia.</p>
            </CardContent>
          </Card>
        </div>

        <BcraVariablesGrid variables={bcra} />
        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (activeTab === 'solicitudes') {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-2">
          <div className="flex items-center gap-2 px-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por monto / ID…"
              className="h-9 w-56"
              value={loanSearch}
              onChange={(e) => setLoanSearch(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm"
            value={loanFilter}
            onChange={(e) => setLoanFilter(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="active">Activos</option>
            <option value="rejected">Rechazados</option>
            <option value="paid">Pagados</option>
          </select>
          <span className="text-xs text-muted-foreground">
            {filteredLoans.length} de {loans.length}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => router.refresh()}>
              <RefreshCw className="h-4 w-4" /> Refrescar
            </Button>
            <Button
              size="sm"
              className="h-9 gap-1 shadow-sm"
              disabled={!filteredLoans.length}
              onClick={() =>
                downloadCsv(
                  `unicred-solicitudes-${csvDateSuffix()}.csv`,
                  ['ID', 'Usuario', 'Monto', 'Cuotas', 'Estado', 'Score', 'Fecha'],
                  filteredLoans.map((l) => [
                    l.id,
                    l.userId,
                    l.principal,
                    l.term,
                    l.status,
                    l.scoreAtApproval ?? '',
                    new Date(l.createdAt).toISOString(),
                  ]),
                )
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {[
            { l: 'Total solicitudes', v: String(loans.length), c: '' },
            { l: 'Pendientes', v: String(loans.filter(l => l.status === 'pending').length), c: 'text-amber-700' },
            { l: 'Aprobadas', v: String(loans.filter(l => l.status === 'approved' || l.status === 'active').length), c: 'text-emerald-700' },
            { l: 'Rechazadas', v: String(loans.filter(l => l.status === 'rejected').length), c: 'text-rose-700' },
            { l: 'Monto total', v: formatARS(loans.reduce((a, l) => a + (Number(l.principal) || 0), 0)), c: 'text-primary' },
          ].map(s => (
            <div key={s.l} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{s.l}</p>
              <p className={"mt-1 text-xl font-bold tabular-nums " + s.c}>{s.v}</p>
            </div>
          ))}
        </div>

        <LoansTable loans={filteredLoans} />
        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (activeTab === 'scoring') {
    const scored = loans.filter(l => l.scoreAtApproval != null && l.scoreAtApproval > 0)
    const avgScore = scored.length ? Math.round(scored.reduce((a, l) => a + (l.scoreAtApproval || 0), 0) / scored.length) : 0
    const dist = [0, 0, 0, 0, 0]
    scored.forEach(l => {
      const s = l.scoreAtApproval || 0
      if (s >= 800) dist[4]++; else if (s >= 650) dist[3]++; else if (s >= 500) dist[2]++; else if (s >= 350) dist[1]++; else dist[0]++
    })
    const distColors = ['#F43F5E', '#F59E0B', '#EAB308', '#0EA5E9', '#10B981']
    const distLabels = ['Crítico <350', 'Riesgo 350-500', 'Medio 500-650', 'Bueno 650-800', 'Excelente >800']
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <BcraCuitLookup />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Score promedio" value={avgScore ? String(avgScore) : '—'} hint={`${scored.length} créditos con score`} tone={avgScore >= 650 ? 'ok' : avgScore ? 'warn' : 'default'} />
          <MetricTile label="Con score BCRA" value={scored.length.toLocaleString('es-AR')} hint={`${loans.length ? pct(scored.length, loans.length) : 0}% de la originación`} />
          <MetricTile label="Sin score" value={(loans.length - scored.length).toLocaleString('es-AR')} hint="Pendiente de consulta a Central de Deudores" tone={loans.length - scored.length ? 'warn' : 'ok'} />
          <MetricTile label="Tier >800" value={String(dist[4])} hint={scored.length ? `${pct(dist[4], scored.length)}% del pool scoreado` : 'Sin pool'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white lg:col-span-5">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Distribución por tramo</h2>
              <p className="text-xs text-slate-500">Solo operaciones con score persistido</p>
            </header>
            <div className="space-y-2.5 px-4 py-4">
              {scored.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Sin scores en cartera.</p>
              ) : (
                distLabels.map((label, i) => {
                  const n = dist[i]
                  const p = scored.length ? Math.round((n / scored.length) * 100) : 0
                  return (
                    <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">{label}</span>
                          <span className="tabular-nums text-xs font-semibold">{n} · {p}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: distColors[i] }} />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white lg:col-span-7">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Operaciones scoreadas</h2>
              <p className="text-xs text-slate-500">Últimas 20 con score en originación</p>
            </header>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Tramo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Cuotas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scored.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Sin operaciones scoreadas aún.</TableCell></TableRow>
                  )}
                  {scored.slice(0, 20).map(l => {
                    const s = l.scoreAtApproval || 0
                    const tier = s >= 800 ? 4 : s >= 650 ? 3 : s >= 500 ? 2 : s >= 350 ? 1 : 0
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{shortId(l.id)}</TableCell>
                        <TableCell className="font-semibold tabular-nums">{s}</TableCell>
                        <TableCell>
                          <span className="text-xs" style={{ color: distColors[tier] }}>{distLabels[tier]}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatARS(l.principal)}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.term}</TableCell>
                        <TableCell>{loanBadge(l.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </div>
    )
  }

  if (activeTab === 'cartera_activa') {
    const activos = loans.filter(l => l.status === 'active' || l.status === 'approved')
    const volActivo = activos.reduce((a, l) => a + (Number(l.principal) || 0), 0)
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Capital vivo" value={formatARS(volActivo)} hint={`${activos.length} créditos vigentes`} />
          <MetricTile label="Plazo promedio" value={activos.length ? `${Math.round(activos.reduce((a, l) => a + (l.term || 0), 0) / activos.length)} meses` : '—'} hint="Sistema francés" />
          <MetricTile label="Ticket promedio" value={formatARS(activos.length ? Math.round(volActivo / activos.length) : 0)} hint="Sobre cartera activa" />
          <MetricTile label="Con score" value={`${activos.filter(l => (l.scoreAtApproval || 0) > 0).length}/${activos.length}`} hint="Score al momento de aprobación" />
        </div>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Detalle de cartera</CardTitle>
              <CardDescription>Créditos activos y aprobados pendientes de desembolso</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="uc-scroll-thin overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Operación</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Cuotas</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activos.length === 0 && (<TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Sin cartera activa por el momento.</TableCell></TableRow>)}
                  {activos.slice(0, 25).map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs font-semibold text-brand-primary">{shortId(l.id)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatARS(l.principal)}</TableCell>
                      <TableCell className="text-right font-mono">{l.term}</TableCell>
                      <TableCell className="font-mono font-semibold">{l.scoreAtApproval ?? '—'}</TableCell>
                      <TableCell>{loanBadge(l.status)}</TableCell>
                      <TableCell><Badge variant="outline" className="h-5 text-[10px]">UNICRÉDITOS APP</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (activeTab === 'usuarios' || activeTab === 'base_clientes') {
    if (personaId) {
      if (ficha) {
        return <ClientFicha ficha={ficha} />
      }
      return (
        <div className="mx-auto w-full max-w-7xl">
          <DecisionBanner
            tone="warn"
            title="No se pudo abrir la ficha"
            detail={fichaError || 'Esa persona no está en la base operativa.'}
            action={
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('usuarios')}>
                Volver a Personas
              </Button>
            }
          />
        </div>
      )
    }
    return <UsersTable users={users} currentAdminId={currentAdminId} />
  }

  if (activeTab === 'logs_auditoria') {
    const logs = auditLog.map((l) => ({
      ts: typeof l.createdAt === 'string' ? new Date(l.createdAt) : l.createdAt,
      u: l.actorEmail ?? l.actorUserId ?? 'sistema',
      a: l.summary,
      t: l.action,
      o: l.entityId ? `${l.entityType}:${shortId(l.entityId)}` : l.entityType,
      sev: l.severity,
    }))
    const last7d = logs.filter((l) => now - l.ts.getTime() < 7 * 24 * 60 * 60 * 1000)
    const criticas = logs.filter((l) => l.sev === 'error').length
    const actores = new Set(auditLog.map((l) => l.actorUserId).filter(Boolean)).size

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Logs de auditoría</h2>
            <p className="text-sm text-muted-foreground">Cada intervención manual de administración queda registrada con el usuario que la hizo. El registro no se edita ni se borra.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { l: 'Eventos últimos 7 días', v: last7d.length.toLocaleString('es-AR'), i: <Activity className="h-4 w-4" />, c: 'bg-brand-primary/10 text-brand-primary' },
            { l: 'Eventos registrados', v: logs.length.toLocaleString('es-AR'), i: <Hand className="h-4 w-4" />, c: 'bg-amber-500/10 text-amber-600' },
            { l: 'Alertas críticas', v: criticas.toLocaleString('es-AR'), i: <AlertTriangle className="h-4 w-4" />, c: 'bg-rose-500/10 text-rose-600' },
            { l: 'Administradores que operaron', v: actores.toLocaleString('es-AR'), i: <UserCheck className="h-4 w-4" />, c: 'bg-emerald-500/10 text-emerald-600' },
          ].map(s => (
            <Card key={s.l}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs text-muted-foreground font-medium">{s.l}</CardTitle>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.c)}>{s.i}</div>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{s.v}</div></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trazabilidad · últimos eventos</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <div className="uc-scroll-thin overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Usuario admin</TableHead>
                    <TableHead>Tipo evento</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead>ID Objeto</TableHead>
                    <TableHead>Severidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Todavía no hay intervenciones manuales registradas.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {l.ts.toLocaleDateString('es-AR')} · {l.ts.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{l.u}</TableCell>
                      <TableCell>
                        <code className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-brand-primary">{l.t}</code>
                      </TableCell>
                      <TableCell className="text-sm">{l.a}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{l.o}</TableCell>
                      <TableCell>{l.sev === 'error' ? <Badge variant="destructive" className="h-5 text-[11px]">ERROR</Badge> : l.sev === 'warning' ? <Badge variant="outline" className="h-5 border-amber-500/30 bg-amber-500/10 text-amber-700 text-[11px]">WARNING</Badge> : <Badge variant="outline" className="h-5 border-sky-500/30 bg-sky-500/10 text-sky-700 text-[11px]">INFO</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (activeTab === 'parametros' || activeTab === 'tarifas') {
    const activos = products.filter((p) => p.active)
    const montoMin = activos.length ? Math.min(...activos.map((p) => Number(p.minAmount) || 0)) : 0
    const montoMax = activos.length ? Math.max(...activos.map((p) => Number(p.maxAmount) || 0)) : 0
    const plazoMin = activos.length ? Math.min(...activos.map((p) => p.minTerm || 0)) : 0
    const plazoMax = activos.length ? Math.max(...activos.map((p) => p.maxTerm || 0)) : 0

    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-primary" />
            Parámetros de originación
          </h2>
          <p className="text-sm text-muted-foreground">
            Estos son los límites vigentes, tomados de los productos cargados en la base. Para
            cambiarlos hay que editar el producto correspondiente.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Monto mínimo" value={activos.length ? formatARS(montoMin) : '—'} hint="El más bajo entre los productos activos" />
          <MetricTile label="Monto máximo" value={activos.length ? formatARS(montoMax) : '—'} hint="El más alto entre los productos activos" />
          <MetricTile label="Plazo" value={activos.length ? `${plazoMin} a ${plazoMax} cuotas` : '—'} hint="Rango habilitado" />
          <MetricTile
            label="Productos activos"
            value={String(activos.length)}
            hint={`${products.length - activos.length} inactivo(s)`}
            tone={activos.length ? 'ok' : 'warn'}
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Productos de crédito</h3>
            <p className="text-xs text-slate-500">Tabla loan_product · define lo que el cliente puede pedir</p>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Plazo</TableHead>
                  <TableHead className="text-right">TNA</TableHead>
                  <TableHead className="text-right">Tasa mensual</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay productos cargados. Corré <code className="font-mono">npm run db:seed</code>.
                    </TableCell>
                  </TableRow>
                )}
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.type}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatARS(p.minAmount)} — {formatARS(p.maxAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {p.minTerm} — {p.maxTerm}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(p.tna)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(p.monthlyRate)}</TableCell>
                    <TableCell>
                      {p.active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Inactivo
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <Card className="border-amber-500/30 bg-amber-500/[0.03]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <CardTitle className="text-sm font-semibold">Reglas fijas del motor</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              El score se calcula con los datos de la Central de Deudores del BCRA al momento de la
              solicitud y queda guardado en el crédito.
            </p>
            <p>
              La acreditación de cuotas llega únicamente por el webhook de Mercado Pago. La
              corrección manual queda registrada con el usuario administrador que la hizo.
            </p>
            <p>
              Los desembolsos requieren cuenta bancaria verificada del cliente y se acreditan desde
              la pestaña Desembolsos.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (activeTab === 'tarifas') {
    const activos = products.filter((p) => p.active)
    const tnaValues = activos.map((p) => Number(p.tna)).filter((n) => Number.isFinite(n) && n > 0)
    const tnaMin = tnaValues.length ? Math.min(...tnaValues) : null
    const tnaMax = tnaValues.length ? Math.max(...tnaValues) : null
    const cfts = activos
      .map((p) => estimatedCft(p.monthlyRate))
      .filter((n): n is number => n !== null)
    const cftMin = cfts.length ? Math.min(...cfts) : null
    const cftMax = cfts.length ? Math.max(...cfts) : null

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Percent className="h-5 w-5 text-brand-primary" />
            Tasas vigentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Calculadas sobre los productos activos. El CFT es una estimación de referencia; el
            aplicable a cada crédito se informa en el contrato.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="TNA mínima"
            value={tnaMin !== null ? formatPct(tnaMin) : '—'}
            hint="Tasa nominal anual más baja publicada"
          />
          <MetricTile
            label="TNA máxima"
            value={tnaMax !== null ? formatPct(tnaMax) : '—'}
            hint="Tasa nominal anual más alta publicada"
          />
          <MetricTile
            label="CFT estimado"
            value={cftMin !== null && cftMax !== null ? `${formatPct(cftMin)} — ${formatPct(cftMax)}` : '—'}
            hint="Capitalizando la tasa mensual a 12 meses"
          />
          <MetricTile
            label="Productos publicados"
            value={String(activos.length)}
            hint="Visibles para el cliente en el simulador"
            tone={activos.length ? 'ok' : 'warn'}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-sm">Comparativa por producto</CardTitle>
              <CardDescription>TNA cargada y CFT estimado. El costo final sale del simulador y del contrato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activos.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay productos activos publicados.
                </p>
              )}
              {activos.map((p) => {
                const cft = estimatedCft(p.monthlyRate)
                return (
                  <div key={p.id} className="grid grid-cols-3 gap-2 border-b border-slate-100 py-3 last:border-0 text-sm">
                    <div className="col-span-1 min-w-0 truncate font-medium">
                      {p.name}
                      <span className="ml-1 text-xs text-muted-foreground">· {p.minTerm}-{p.maxTerm} cuotas</span>
                    </div>
                    <div className="text-right tabular-nums"><span className="text-[10px] text-muted-foreground mr-1">TNA</span>{formatPct(p.tna)}</div>
                    <div className="text-right tabular-nums"><span className="text-[10px] text-muted-foreground mr-1">CFT</span>{cft !== null ? formatPct(cft) : '—'}</div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-sm">Aviso al tomador</CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
              <p>UNICRÉDITOS es la plataforma de créditos de RM International Group S.A.S. No es un banco. Las tasas publicadas son de referencia; el CFT aplicable se informa antes de firmar.</p>
              <p>El atraso genera punitorios según contrato y puede impactar la situación en Central de Deudores del BCRA.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <p className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        Esta vista no está en el menú operativo. Volvé a Control.
      </p>
    </div>
  )
}

function Hand(props: any) { return <HandIcon {...props} /> }

function disbBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendiente', cls: 'bg-amber-500/10 text-amber-700 border-amber-200' },
    processing: { label: 'Procesando', cls: 'bg-sky-500/10 text-sky-700 border-sky-200' },
    credited: { label: 'Acreditado', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    failed: { label: 'Fallido', cls: 'bg-rose-500/10 text-rose-700 border-rose-200' },
    reversed: { label: 'Revertido', cls: 'bg-rose-500/10 text-rose-700 border-rose-200' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.cls)}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        status === 'credited' ? 'bg-emerald-500' :
        status === 'failed' || status === 'reversed' ? 'bg-rose-500' :
        status === 'processing' ? 'bg-sky-500' : 'bg-amber-500'
      )} />
      {cfg.label}
    </span>
  )
}

function ToastFloating({
  toast,
  onClose,
}: {
  toast: { type: 'ok' | 'err'; msg: string }
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-200 max-w-sm',
        toast.type === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
          : 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300',
      )}
    >
      {toast.type === 'ok' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span className="text-sm font-medium flex-1">{toast.msg}</span>
      <button
        onClick={onClose}
        className="ml-1 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

