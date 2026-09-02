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
import { AdminControlTower } from '@/components/admin/admin-control-tower'
import { AdminPaymentsDesk } from '@/components/admin/admin-payments-desk'
import { AdminApprovalsDesk } from '@/components/admin/admin-approvals-desk'
import { AdminAnalyticsDesk } from '@/components/admin/admin-analytics-desk'
import { AdminStaffDesk } from '@/components/admin/admin-staff-desk'
import { AdminProductsDesk } from '@/components/admin/admin-products-desk'
import { AdminConfigDesk } from '@/components/admin/admin-config-desk'
import { type StatsData } from '@/components/admin/summary-cards'
import type { ClientFicha as ClientFichaData } from '@/app/actions/admin-ficha'
import type { AdminOpsDesk } from '@/app/actions/admin-ops'
import type { AdminOpsConfig } from '@/app/actions/admin-config'
import type { AdminPaymentsDesk as AdminPaymentsDeskData } from '@/app/actions/admin-cases'
import type { AdminTabId } from '@/components/admin/admin-app-shell'
import { adminLoanHref } from '@/lib/admin-nav'


import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { csvDateSuffix, downloadCsv } from '@/lib/csv'
import { formatARS, formatCBU, formatCVU } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { DecisionBanner, MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import * as React from 'react'
import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Receipt as ReceiptIcon,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react'
import { KYCReviewCard, type KYCAdminRow } from '@/components/admin/kyc-review-card'
import { markDisbursementAsCredited } from '@/app/actions/banking'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type LoanRow = {
  id: string
  userId: string
  merchantId?: string | null
  productId?: string | null
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
  payments = { kpis: { total: 0, volume: 0, pending: 0, failed: 0 }, rows: [] },
  opsConfig = null,
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
  payments?: AdminPaymentsDeskData
  opsConfig?: AdminOpsConfig | null
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
  const [disbFilter, setDisbFilter] = useState<string>('all')

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
      const order = { pending: 0, active: 1, approved: 1, rejected: 2 } as Record<string, number>
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })
    if (merchantFilter === 'all') return sorted
    if (merchantFilter === 'active') return sorted.filter((m) => m.status === 'active' || m.status === 'approved')
    return sorted.filter((m) => m.status === merchantFilter)
  }, [merchants, merchantFilter])

  if (activeTab === 'overview') {
    return (
      <AdminControlTower
        stats={stats}
        loans={loans}
        merchants={merchants}
        users={users}
        kycList={kycList}
        disbursementList={disbursementList}
        opsDesk={opsDesk}
        onNavigate={(tab) => onNavigate?.(tab)}
      />
    )
  }

  if (activeTab === 'creditos') {
    const counts: Record<string, number> = {}
    loans.forEach((l) => (counts[l.status] = (counts[l.status] ?? 0) + 1))

    return (
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:grid-cols-6">
          <div className="rounded-lg border bg-card px-2.5 py-1.5">
            <div className="text-[10px] text-muted-foreground">Total</div>
            <div className="text-[15px] font-semibold tabular-nums">{loans.length}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5">
            <div className="text-[10px] text-emerald-700">Activos</div>
            <div className="text-[15px] font-semibold tabular-nums text-emerald-700">{counts.active ?? 0}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-1.5">
            <div className="text-[10px] text-amber-700">Pendientes</div>
            <div className="text-[15px] font-semibold tabular-nums text-amber-700">{counts.pending ?? 0}</div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1.5">
            <div className="text-[10px] text-destructive">Rechazados</div>
            <div className="text-[15px] font-semibold tabular-nums text-destructive">{counts.rejected ?? 0}</div>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-2.5 py-1.5">
            <div className="text-[10px] text-teal-700">Pagados</div>
            <div className="text-[15px] font-semibold tabular-nums text-teal-700">{counts.paid ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-card px-2.5 py-1.5">
            <div className="text-[10px] text-primary">Volumen</div>
            <div className="truncate text-[13px] font-semibold tabular-nums text-primary">
              {formatARS(
                loans.reduce((acc, l) => acc + (typeof l.principal === 'string' ? parseFloat(l.principal) : l.principal || 0), 0),
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          <Tabs value={loanFilter} onValueChange={setLoanFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="all" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Todos ({loans.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Pendientes ({counts.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger value="active" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Activos ({counts.active ?? 0})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Rechazados ({counts.rejected ?? 0})
              </TabsTrigger>
              <TabsTrigger value="paid" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Pagados ({counts.paid ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
          <LoansTable loans={filteredLoans} />
        </div>
      </OpsFloor>
    )
  }

  if (activeTab === 'comercios') {
    const counts: Record<string, number> = {}
    merchants.forEach((m) => (counts[m.status] = (counts[m.status] ?? 0) + 1))
    const activeMerchants = (counts.active ?? 0) + (counts.approved ?? 0)

    return (
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricTile label="Total" value={String(merchants.length)} />
          <MetricTile label="Activos" value={String(activeMerchants)} tone="ok" />
          <MetricTile label="Pendientes" value={String(counts.pending ?? 0)} tone={counts.pending ? 'warn' : 'default'} />
          <MetricTile label="Rechazados" value={String(counts.rejected ?? 0)} tone={counts.rejected ? 'warn' : 'default'} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          <Tabs value={merchantFilter} onValueChange={setMerchantFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="all" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Todos ({merchants.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Pendientes ({counts.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger value="active" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Activos ({activeMerchants})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Rechazados ({counts.rejected ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
          <MerchantsTable merchants={filteredMerchants} />
        </div>
      </OpsFloor>
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
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-5">
          <MetricTile label="Total" value={String(kycList.length)} />
          <MetricTile label="En revisión" value={String(counts.reviewing ?? 0)} tone={counts.reviewing ? 'warn' : 'default'} />
          <MetricTile label="Pendientes" value={String(counts.pending ?? 0)} tone={counts.pending ? 'warn' : 'default'} />
          <MetricTile label="Aprobados" value={String(counts.approved ?? 0)} tone="ok" />
          <MetricTile label="Rechazados" value={String(counts.rejected ?? 0)} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          <Tabs value={kycFilter} onValueChange={setKycFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="pending_review" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Por revisar ({(counts.reviewing ?? 0) + (counts.pending ?? 0)})
              </TabsTrigger>
              <TabsTrigger value="all" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Todos ({kycList.length})
              </TabsTrigger>
              <TabsTrigger value="reviewing" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Revisando ({counts.reviewing ?? 0})
              </TabsTrigger>
              <TabsTrigger value="approved" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Aprobados ({counts.approved ?? 0})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Rechazados ({counts.rejected ?? 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={kycSearch}
            onChange={(e) => setKycSearch(e.target.value)}
            placeholder="Buscar por nombre, CUIL, DNI, email o sesión Didit"
            className="h-8 pl-9"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
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
            <div className="space-y-2">
              {filteredKyc.map((k) => (
                <KYCReviewCard key={k.id} kyc={k} />
              ))}
            </div>
          )}
        </div>

        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </OpsFloor>
    )
  }

  if (activeTab === 'desembolsos') {
    const counts: Record<string, number> = {}
    disbursementList.forEach((d) => {
      const key = d.status === 'completed' ? 'credited' : d.status
      counts[key] = (counts[key] ?? 0) + 1
    })

    const totalPendingAmount = disbursementList
      .filter((d) => d.status === 'pending' || d.status === 'processing')
      .reduce((acc, d) => acc + (typeof d.amount === 'string' ? parseFloat(d.amount) : Number(d.amount) || 0), 0)

    const sortedDisb = [...disbursementList].sort((a, b) => {
      const order: Record<string, number> = { processing: 0, pending: 1, credited: 2, completed: 2, failed: 3, reversed: 4 }
      const oa = order[a.status] ?? 9
      const ob = order[b.status] ?? 9
      if (oa !== ob) return oa - ob
      return new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    })
    const filteredDisb =
      disbFilter === 'all'
        ? sortedDisb
        : disbFilter === 'credited'
          ? sortedDisb.filter((d) => d.status === 'credited' || d.status === 'completed')
          : sortedDisb.filter((d) => d.status === disbFilter)

    return (
      <OpsFloor>
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-amber-950">El botón no gira el dinero</p>
          <p className="text-[11px] text-amber-800">
            Acreditá solo después de transferir desde tesorería al CBU/CVU del cliente. Cargá TREASURY_CBU en el entorno para dejar constancia de la cuenta de origen.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-5">
          <MetricTile label="Total" value={String(disbursementList.length)} />
          <MetricTile label="Pendientes" value={String(counts.pending ?? 0)} hint={formatARS(totalPendingAmount)} tone={counts.pending ? 'warn' : 'ok'} />
          <MetricTile label="Procesando" value={String(counts.processing ?? 0)} />
          <MetricTile label="Acreditados" value={String(counts.credited ?? 0)} tone="ok" />
          <MetricTile label="Fallidos" value={String((counts.failed ?? 0) + (counts.reversed ?? 0))} tone={(counts.failed || counts.reversed) ? 'warn' : 'ok'} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
          <Tabs value={disbFilter} onValueChange={setDisbFilter} className="w-full">
            <TabsList className="h-auto flex-wrap bg-transparent gap-1 p-0">
              <TabsTrigger value="pending" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Pendientes ({counts.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger value="all" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Todos ({disbursementList.length})
              </TabsTrigger>
              <TabsTrigger value="processing" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Procesando ({counts.processing ?? 0})
              </TabsTrigger>
              <TabsTrigger value="credited" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Acreditados ({counts.credited ?? 0})
              </TabsTrigger>
              <TabsTrigger value="failed" className="h-7 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none text-xs">
                Fallidos ({(counts.failed ?? 0) + (counts.reversed ?? 0)})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
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
        </div>

        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </OpsFloor>
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

  if (activeTab === 'pagos') {
    return <AdminPaymentsDesk desk={payments} />
  }

  if (activeTab === 'aprobaciones') {
    return <AdminApprovalsDesk disbursementList={disbursementList} />
  }

  if (activeTab === 'analytics') {
    return <AdminAnalyticsDesk stats={stats} loans={loans} products={products} opsDesk={opsDesk} />
  }

  if (activeTab === 'staff') {
    return <AdminStaffDesk users={users} currentAdminId={currentAdminId} />
  }

  if (activeTab === 'cuentas-bancarias') {
    return (
      <OpsFloor>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
          <BankAccountsTable accounts={bankAccounts} />
        </div>
        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </OpsFloor>
    )
  }

  if (activeTab === 'bcra') {
    return (
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
          <MetricTile label="Variables BCRA" value={String(bcra.length)} hint="Tasas, inflación, reservas, TC" />
          <MetricTile
            label="Última publicación"
            value={
              bcra[0]?.fecha
                ? new Date(bcra[0].fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'
            }
          />
          <MetricTile label="Motor scoring" value="Activo" hint="Variables consumidas en evaluación" tone="ok" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
          <div className="min-h-0 overflow-auto lg:col-span-4">
            <BcraCuitLookup />
            <div className="mt-2">
              <BcraCatalogPanel />
            </div>
          </div>
          <div className="min-h-0 overflow-auto lg:col-span-8">
            <BcraVariablesGrid variables={bcra} />
          </div>
        </div>
        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </OpsFloor>
    )
  }

  if (activeTab === 'solicitudes') {
    return (
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-5">
          <MetricTile label="Total" value={String(loans.length)} />
          <MetricTile label="Pendientes" value={String(loans.filter(l => l.status === 'pending').length)} tone="warn" />
          <MetricTile label="Aprobadas" value={String(loans.filter(l => l.status === 'approved' || l.status === 'active').length)} tone="ok" />
          <MetricTile label="Rechazadas" value={String(loans.filter(l => l.status === 'rejected').length)} />
          <MetricTile label="Monto total" value={formatARS(loans.reduce((a, l) => a + (Number(l.principal) || 0), 0))} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por monto / ID…"
            className="h-8 w-52"
            value={loanSearch}
            onChange={(e) => setLoanSearch(e.target.value)}
          />
          <select
            className="h-8 rounded-md border border-input bg-card px-2 text-xs"
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
          <span className="text-[11px] text-muted-foreground">
            {filteredLoans.length} de {loans.length}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1"
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
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
          <LoansTable loans={filteredLoans} />
        </div>
        {toast && <ToastFloating toast={toast} onClose={() => setToast(null)} />}
      </OpsFloor>
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
      <OpsFloor>
        <div className="shrink-0">
          <BcraCuitLookup />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricTile label="Score promedio" value={avgScore ? String(avgScore) : '—'} hint={`${scored.length} créditos con score`} tone={avgScore >= 650 ? 'ok' : avgScore ? 'warn' : 'default'} />
          <MetricTile label="Con score BCRA" value={scored.length.toLocaleString('es-AR')} hint={`${loans.length ? pct(scored.length, loans.length) : 0}% de la originación`} />
          <MetricTile label="Sin score" value={(loans.length - scored.length).toLocaleString('es-AR')} hint="Pendiente de consulta a Central de Deudores" tone={loans.length - scored.length ? 'warn' : 'ok'} />
          <MetricTile label="Tier >800" value={String(dist[4])} hint={scored.length ? `${pct(dist[4], scored.length)}% del pool scoreado` : 'Sin pool'} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-12">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-span-5">
            <header className="shrink-0 border-b border-border px-3 py-1.5">
              <h2 className="text-[12px] font-semibold">Distribución por tramo</h2>
              <p className="text-[10px] text-muted-foreground">Solo operaciones con score persistido</p>
            </header>
            <div className="min-h-0 flex-1 overflow-auto space-y-2 px-3 py-3">
              {scored.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin scores en cartera.</p>
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
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: distColors[i] }} />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-span-7">
            <header className="shrink-0 border-b border-border px-3 py-1.5">
              <h2 className="text-[12px] font-semibold">Operaciones scoreadas</h2>
              <p className="text-[10px] text-muted-foreground">Últimas 20 con score en originación</p>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
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
                        <TableCell className="font-mono text-xs">
                          <Link href={adminLoanHref(l.id, l.status)} className="hover:underline">
                            {shortId(l.id)}
                          </Link>
                        </TableCell>
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
      </OpsFloor>
    )
  }

  if (activeTab === 'cartera_activa') {
    const activos = loans.filter(l => l.status === 'active' || l.status === 'approved')
    const volActivo = activos.reduce((a, l) => a + (Number(l.principal) || 0), 0)
    return (
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricTile label="Capital vivo" value={formatARS(volActivo)} hint={`${activos.length} créditos vigentes`} />
          <MetricTile label="Plazo promedio" value={activos.length ? `${Math.round(activos.reduce((a, l) => a + (l.term || 0), 0) / activos.length)} meses` : '—'} hint="Sistema francés" />
          <MetricTile label="Ticket promedio" value={formatARS(activos.length ? Math.round(volActivo / activos.length) : 0)} hint="Sobre cartera activa" />
          <MetricTile label="Con score" value={`${activos.filter(l => (l.scoreAtApproval || 0) > 0).length}/${activos.length}`} hint="Score al momento de aprobación" />
        </div>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          <header className="shrink-0 border-b px-3 py-1.5">
            <h2 className="text-[12px] font-semibold">Detalle de cartera</h2>
            <p className="text-[10px] text-muted-foreground">Créditos activos y aprobados pendientes de desembolso</p>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
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
                      <TableCell className="font-mono text-xs font-semibold text-brand-primary">
                        <Link href={adminLoanHref(l.id, l.status)} className="hover:underline">
                          {shortId(l.id)}
                        </Link>
                      </TableCell>
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
        </section>
      </OpsFloor>
    )
  }

  if (activeTab === 'usuarios' || activeTab === 'base_clientes') {
    if (personaId) {
      if (ficha) {
        return (
          <OpsFloor>
            <div className="min-h-0 flex-1 overflow-auto">
              <ClientFicha ficha={ficha} />
            </div>
          </OpsFloor>
        )
      }
      return (
        <OpsFloor>
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
        </OpsFloor>
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
      <OpsFloor>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricTile label="Eventos 7 días" value={last7d.length.toLocaleString('es-AR')} />
          <MetricTile label="Eventos registrados" value={logs.length.toLocaleString('es-AR')} />
          <MetricTile label="Alertas críticas" value={criticas.toLocaleString('es-AR')} tone={criticas ? 'critical' : 'ok'} />
          <MetricTile label="Operadores que actuaron" value={actores.toLocaleString('es-AR')} />
        </div>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          <header className="shrink-0 border-b px-3 py-1.5">
            <h2 className="text-[12px] font-semibold">Trazabilidad</h2>
            <p className="text-[10px] text-muted-foreground">El registro no se edita ni se borra</p>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
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
        </section>
      </OpsFloor>
    )
  }

  if (activeTab === 'tarifas') {
    return <AdminProductsDesk products={products} />
  }

  if (activeTab === 'parametros') {
    return <AdminConfigDesk data={opsConfig} />
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Esta vista no está en el menú operativo. Volvé a Control.
      </p>
    </div>
  )
}

function disbBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendiente', cls: 'bg-amber-500/10 text-amber-700 border-amber-200' },
    processing: { label: 'Procesando', cls: 'bg-sky-500/10 text-sky-700 border-sky-200' },
    credited: { label: 'Acreditado', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    completed: { label: 'Acreditado', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    failed: { label: 'Fallido', cls: 'bg-rose-500/10 text-rose-700 border-rose-200' },
    reversed: { label: 'Revertido', cls: 'bg-rose-500/10 text-rose-700 border-rose-200' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.cls)}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        status === 'credited' || status === 'completed' ? 'bg-emerald-500' :
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
        className="ml-1 rounded p-0.5 hover:bg-black/5 dark:hover:bg-card/10 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

