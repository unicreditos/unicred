'use client'

import { DashboardShell, isDashboardTab, type TabValue } from '@/components/dashboard/app-shell'
import { KYCProfileForm } from '@/components/dashboard/kyc-profile-form'
import { BCRAScore } from '@/components/dashboard/bcra-score'
import { LoanRequestSimulator } from '@/components/dashboard/loan-request'
import { LoansDashboard } from '@/components/dashboard/loans-dashboard'
import { ActivityInbox } from '@/components/dashboard/activity-inbox'
import { AccountSettings } from '@/components/dashboard/account-settings'
import { ClaimsPanel } from '@/components/dashboard/claims-panel'
import { DueCalendar } from '@/components/dashboard/due-calendar'
import {
  DigitalCard,
  SectionCard,
  StatusChip,
} from '@/components/unicred/dashboard-kit'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatARS, formatCBU, formatCVU, displayAlias, normalizeBankAlias } from '@/lib/finance'
import {
  loanStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/labels'
import {
  profile,
  loanProduct,
  loan,
  bcraCheck,
  bankAccount,
  kycVerification,
  loanContract,
  bcraReport,
  payment,
  paymentReceipt,
  savedPaymentMethod,
  disbursement,
} from '@/lib/db/schema'
import { useMemo, useState, useTransition, useEffect, KeyboardEvent } from 'react'
import {
  BellRing,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  HelpCircle,
  Inbox,
  Sparkles,
  Wallet,
  XCircle,
  ChevronRight,
  Landmark,
  ShieldCheck,
  Receipt,
  Star,
  Trash2,
  Download,
  ArrowRight,
  Printer,
  Check,
  AlertCircle,
  Banknote,
  Link2,
  Eye,
  Clock,
  X,
  Globe2,
  Scale,
  FileText,
  Handshake,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createBankAccount,
  updateBankAccount,
  setPrimaryBankAccount,
  deleteBankAccount,
  validateBankAccountLive,
} from '@/app/actions/banking'
import { getDiditPublicConfig, syncDiditSession } from '@/app/actions/didit'
import { DiditVerifyButton } from '@/components/didit-verify-button'
import { generateBCRAReport, generateLoanContract, acceptLoanContract, refinanceLoan } from '@/app/actions/documents'
import { withdrawLoanAcceptance } from '@/app/actions/loans'
import { useSession } from '@/lib/auth-client'
import { BRAND } from '@/lib/brand'
import { canWithdrawAcceptance, WITHDRAWAL_DAYS } from '@/lib/legal/withdrawal'
import { asMoraRows, evaluateIntimation, evaluateRefinance, MAX_REFINANCES } from '@/lib/legal/mora'
import { PayInstallmentDialog } from '@/components/payments/pay-installment-dialog'
import { kycMediaBundle, parseDiditCapture } from '@/lib/didit-capture'
import Link from 'next/link'

type Profile = typeof profile.$inferSelect
type LoanProduct = typeof loanProduct.$inferSelect
type Loan = typeof loan.$inferSelect
type BcraCheck = typeof bcraCheck.$inferSelect
type BankAccount = typeof bankAccount.$inferSelect
type KYCVerification = typeof kycVerification.$inferSelect
type LoanContract = typeof loanContract.$inferSelect
type BcraReportType = typeof bcraReport.$inferSelect
type PaymentType = typeof payment.$inferSelect
type PaymentReceiptType = typeof paymentReceipt.$inferSelect
type SavedMethodType = typeof savedPaymentMethod.$inferSelect
type DisbursementType = typeof disbursement.$inferSelect

type UpcomingInstallment = {
  id: string
  number: number
  amount: string | number
  dueDate: Date | string
  status: string
  loanId: string
  loanPrincipal: string | number
  loanTerm: number
  loanStatus: string
  loanPurpose: string | null
}

type KpiTotals = {
  totalRequested: number
  totalDebt: number
  pendingAmount: number
  totalPaid: number
  active: number
  paid: number
  rejected: number
  pendingApproval: number
}

interface DashboardTabsWrapperProps {
  initialProfile: Profile | null
  products: LoanProduct[]
  loans: Loan[]
  lastBcraCheck: BcraCheck | null
  upcomingInstallments?: UpcomingInstallment[]
  kpiTotals?: KpiTotals
  kycPct?: number
  bankAccounts?: BankAccount[]
  myKyc?: KYCVerification | null
  contracts?: (LoanContract & { loan?: Loan | null })[]
  bcraReports?: BcraReportType[]
  payments?: PaymentType[]
  paymentReceipts?: (PaymentReceiptType & { installment?: UpcomingInstallment | null })[]
  savedPaymentMethods?: SavedMethodType[]
  disbursements?: (DisbursementType & { loan?: Loan | null })[]
  installmentsAll?: UpcomingInstallment[]
}

const SCORE_BAND_COLORS: Record<string, string> = {
  excelente: 'text-emerald-600 dark:text-emerald-400',
  bueno: 'text-sky-600 dark:text-sky-400',
  regular: 'text-amber-600 dark:text-amber-400',
  bajo: 'text-rose-600 dark:text-rose-400',
}

function getScoreBand(score: number | null | undefined): { label: string; color: string; tone: string } {
  if (score === null || score === undefined) {
    return { label: 'Sin datos', color: 'text-muted-foreground', tone: 'bg-muted/70' }
  }
  if (score >= 720) {
    return { label: 'Excelente', color: SCORE_BAND_COLORS.excelente, tone: 'bg-emerald-500/10' }
  }
  if (score >= 640) {
    return { label: 'Bueno', color: SCORE_BAND_COLORS.bueno, tone: 'bg-sky-500/10' }
  }
  if (score >= 560) {
    return { label: 'Regular', color: SCORE_BAND_COLORS.regular, tone: 'bg-amber-500/10' }
  }
  return { label: 'Bajo', color: SCORE_BAND_COLORS.bajo, tone: 'bg-rose-500/10' }
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function formatDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  })
}

export function DashboardTabsWrapper({
  initialProfile,
  products,
  loans,
  lastBcraCheck,
  upcomingInstallments = [],
  kpiTotals,
  kycPct = 0,
  bankAccounts = [],
  myKyc = null,
  contracts = [],
  bcraReports = [],
  payments = [],
  paymentReceipts = [],
  savedPaymentMethods = [],
  disbursements = [],
  installmentsAll = [],
}: DashboardTabsWrapperProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const urlTab = isDashboardTab(rawTab) ? rawTab : null
  const [activeTab, setActiveTabState] = useState<TabValue>(urlTab ?? 'overview')

  const [syncedUrl, setSyncedUrl] = useState(() => urlTab ?? '')
  const currentUrl = urlTab ?? ''
  if (currentUrl !== syncedUrl) {
    setSyncedUrl(currentUrl)
    if (urlTab && urlTab !== activeTab) setActiveTabState(urlTab)
  }

  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Aviso al volver de Mercado Pago. El parámetro se limpia después de mostrarlo
  // para que recargar la página no repita el mensaje.
  useEffect(() => {
    const mp = searchParams.get('mp_status')
    if (!mp) return

    // Reacción a la vuelta del checkout externo, no sincronización de estado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mp === 'success') showToast('ok', 'Volviste de Mercado Pago. El recibo aparece cuando el cobro está confirmado.')
    else if (mp === 'pending') showToast('ok', 'Pago pendiente: si elegiste Pago Fácil o Rapipago, pagá el cupón en la red. Te avisamos al acreditar.')
    else if (mp === 'failure') showToast('err', 'El pago no se completó. Podés reintentar con otro medio.')

    const sp = new URLSearchParams(window.location.search)
    sp.delete('mp_status')
    const query = sp.toString()
    router.replace(`${window.location.pathname}${query ? `?${query}` : ''}`, { scroll: false })
  }, [searchParams, router])

  const setActiveTab = (t: TabValue) => {
    setActiveTabState(t)
    const sp = new URLSearchParams(window.location.search)
    sp.set('tab', t)
    sp.delete('bank')
    router.replace(`${window.location.pathname}?${sp.toString()}`, { scroll: false })
  }

  const score = initialProfile?.creditScore ?? null
  const band = getScoreBand(score as any as number)

  const nextInstallment = useMemo(() => {
    const source = (installmentsAll.length ? installmentsAll : upcomingInstallments).filter(
      (i) => i.status !== 'paid' && i.status !== 'cancelled',
    )
    if (source.length === 0) return null
    const sorted = [...source].sort(
      (a, b) => new Date(a.dueDate as any).getTime() - new Date(b.dueDate as any).getTime(),
    )
    return sorted[0]
  }, [installmentsAll, upcomingInstallments])

  const nextDueDays = nextInstallment
    ? daysBetween(new Date(nextInstallment.dueDate as any), new Date())
    : null

  const kpis: KpiTotals = kpiTotals ?? {
    totalRequested: 0,
    totalDebt: 0,
    pendingAmount: 0,
    totalPaid: 0,
    active: 0,
    paid: 0,
    rejected: 0,
    pendingApproval: 0,
  }

  const activeLoansList = loans.filter((l: any) => l.status === 'active')
  const firstName = (session?.user?.name ?? '').trim().split(/\s+/)[0] || 'ahí'
  const monthlyIncome = Number(initialProfile?.monthlyIncome) || 0
  const monthlyLoad = activeLoansList.reduce((sum, l: any) => sum + (Number(l.installmentAmount) || 0), 0)
  const capacityCeiling = monthlyIncome > 0 ? monthlyIncome * 0.35 : 0
  const capacityLeft = Math.max(0, capacityCeiling - monthlyLoad)
  const accountOk = !nextInstallment || nextDueDays === null || nextDueDays >= 0
  const recentMoves = [
    ...payments
      .filter((p) => p.status === 'paid')
      .map((p) => ({
        id: `pay-${p.id}`,
        title: 'Pago de cuota',
        amount: -Number(p.amount || 0),
        date: new Date((p.paidAt as any) || p.createdAt),
        kind: 'out' as const,
      })),
    ...disbursements
      .filter((d) => d.status === 'credited')
      .map((d) => ({
        id: `dis-${d.id}`,
        title: 'Desembolso de crédito',
        amount: Number(d.netAmount ?? d.amount ?? 0),
        date: new Date((d as any).creditedAt || d.createdAt),
        kind: 'in' as const,
      })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)

  return (
    <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
      <div key={activeTab} className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {activeTab === 'overview' && (
          <>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-brand-navy-900">
                  Hola, {firstName} 👋
                </h2>
                <p className="mt-1 text-sm text-slate-500">Bienvenido a tu cuenta UNICRÉDITOS.</p>
              </div>
              <Button onClick={() => setActiveTab('solicitar')} disabled={products.length === 0}>
                Solicitar nuevo crédito
              </Button>
            </div>

            <DigitalCard holder={session?.user?.name ?? firstName} className="md:col-span-3" />

            <div className="grid gap-3 md:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Capacidad estimada
                </p>
                {monthlyIncome > 0 ? (
                  <>
                    <p className="mt-2 text-[26px] font-bold tabular-nums tracking-tight text-brand-navy-900">
                      {formatARS(capacityLeft)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tope 35% de tus ingresos declarados ({formatARS(capacityCeiling)}) menos cuotas vigentes.
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#1E58E5]"
                        style={{
                          width: `${capacityCeiling > 0 ? Math.min(100, Math.round((monthlyLoad / capacityCeiling) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-lg font-semibold text-brand-navy-900">Sin ingresos cargados</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Declará ingresos en Identidad para ver tu tope de cuota (35%).
                    </p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveTab('perfil')}>
                      Completar perfil
                    </Button>
                  </>
                )}
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Próximo pago
                </p>
                <p className="mt-2 text-[26px] font-bold tabular-nums tracking-tight text-brand-navy-900">
                  {nextInstallment ? formatARS(nextInstallment.amount) : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {nextInstallment
                    ? `${formatDateShort(nextInstallment.dueDate)} · cuota #${nextInstallment.number}`
                    : 'No hay cuotas pendientes'}
                </p>
                {nextInstallment ? (
                  <Button size="sm" className="mt-3" onClick={() => setActiveTab('pagos')}>
                    Pagar ahora
                  </Button>
                ) : null}
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Estado de cuenta
                </p>
                <div className="mt-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-3 py-1 text-sm font-semibold',
                      accountOk
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
                    )}
                  >
                    {accountOk ? 'Al día' : 'Con atraso'}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {accountOk
                    ? 'Tus cuotas vigentes no están vencidas.'
                    : `La cuota #${nextInstallment?.number} venció el ${nextInstallment ? formatDateShort(nextInstallment.dueDate) : '—'}.`}
                </p>
              </section>
            </div>

            {nextInstallment && nextDueDays !== null && nextDueDays < 0 ? (
              <DecisionBanner
                tone="critical"
                title={`Cuota #${nextInstallment.number} vencida · ${formatARS(nextInstallment.amount)}`}
                detail={`Vencía el ${formatDateShort(nextInstallment.dueDate)}. Pagala ahora para no acumular atraso.`}
                action={
                  <Button size="sm" onClick={() => setActiveTab('pagos')}>
                    Pagar ahora
                  </Button>
                }
              />
            ) : nextInstallment && nextDueDays !== null && nextDueDays <= 7 ? (
              <DecisionBanner
                tone="warn"
                title={`Próxima cuota ${nextDueDays === 0 ? 'vence hoy' : `en ${nextDueDays} días`} · ${formatARS(nextInstallment.amount)}`}
                detail={`${formatDateShort(nextInstallment.dueDate)} · cuota #${nextInstallment.number}`}
                action={
                  <Button size="sm" onClick={() => setActiveTab('pagos')}>
                    Ir a pagar
                  </Button>
                }
              />
            ) : kycPct < 100 ? (
              <DecisionBanner
                tone="info"
                title="Completá tu identidad para originar crédito"
                detail={`Datos al ${kycPct}%. Sin CUIL e ingresos no podemos evaluar. La biometría se hace solo con Didit.`}
                action={
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('perfil')}>
                    Completar datos
                  </Button>
                }
              />
            ) : myKyc?.provider !== 'didit' || myKyc.status !== 'approved' ? (
              <DecisionBanner
                tone="warn"
                title="Verificá tu identidad con Didit"
                detail="No se aceptan fotos cargadas a mano. Completá la verificación dentro de UNICRÉDITOS para poder solicitar crédito."
                action={
                  <Button size="sm" onClick={() => setActiveTab('kyc_biometrico')}>
                    Verificar identidad
                  </Button>
                }
              />
            ) : activeLoansList.length === 0 ? (
              <DecisionBanner
                tone="ok"
                title="Cuenta al día, sin créditos vigentes"
                detail="Podés simular un préstamo personal. La aprobación depende de BCRA, Didit e ingresos."
                action={
                  <Button size="sm" onClick={() => setActiveTab('solicitar')} disabled={products.length === 0}>
                    Simular crédito
                  </Button>
                }
              />
            ) : (
              <DecisionBanner
                tone="ok"
                title="Sin vencimientos urgentes"
                detail="Tus cuotas vigentes están al día."
                action={
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('cuotas')}>
                    Ver créditos
                  </Button>
                }
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Próxima cuota"
                value={nextInstallment ? formatARS(nextInstallment.amount) : '—'}
                hint={
                  nextInstallment
                    ? `${formatDateShort(nextInstallment.dueDate)} · #${nextInstallment.number}`
                    : 'Sin cuotas pendientes'
                }
                tone={nextInstallment && nextDueDays !== null && nextDueDays < 0 ? 'critical' : nextInstallment && nextDueDays !== null && nextDueDays <= 7 ? 'warn' : 'ok'}
              />
              <MetricTile
                label="Saldo a devolver"
                value={formatARS(kpis.pendingAmount)}
                hint={`${kpis.active} crédito${kpis.active === 1 ? '' : 's'} activo${kpis.active === 1 ? '' : 's'}`}
              />
              <MetricTile
                label="Score UNICRÉDITOS"
                value={score ?? '—'}
                hint={score ? band.label : 'Consultá BCRA desde Situación BCRA'}
                tone={!score ? 'warn' : score >= 640 ? 'ok' : 'warn'}
              />
              <MetricTile
                label="Identidad"
                value={`${kycPct}%`}
                hint={
                  myKyc?.provider === 'didit' && myKyc.status === 'approved'
                    ? 'Didit aprobado'
                    : kycPct >= 100
                      ? 'Falta verificar con Didit'
                      : 'Faltan datos de perfil'
                }
                tone={kycPct >= 100 ? 'ok' : 'warn'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-lg border border-slate-200 bg-white lg:col-span-3">
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-brand-navy-900">Créditos vigentes</h2>
                    <p className="text-xs text-slate-500">Capital originado y estado contractual</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setActiveTab('cuotas')}>
                    Ver detalle
                  </Button>
                </header>
                <div className="p-4">
                  {!activeLoansList.length ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No hay créditos activos.{' '}
                      <button type="button" className="font-medium text-brand-primary" onClick={() => setActiveTab('solicitar')}>
                        Solicitar uno
                      </button>
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activeLoansList.map((l: any) => (
                        <div key={l.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-brand-navy-900">
                              {(l as any).purpose || 'Préstamo personal'}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">{String(l.id).slice(0, 12)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatARS(l.principal)}</p>
                            <p className="text-[11px] text-slate-500">{l.term} cuotas · {loanStatusLabel(l.status)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
                <header className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-brand-navy-900">Acciones</h2>
                  <p className="text-xs text-slate-500">Atajos de tu cuenta</p>
                </header>
                <div className="grid gap-2 p-3">
                  {[
                    { t: 'Pagar cuota', d: 'Checkout Mercado Pago', tab: 'pagos' as TabValue },
                    { t: 'Cancelar crédito', d: 'Prepago de capital remanente', tab: 'cuotas' as TabValue },
                    { t: 'Consultar BCRA', d: 'Central de Deudores', tab: 'scoring' as TabValue },
                    { t: 'Cargar cuenta', d: 'CBU / CVU de desembolso', tab: 'bancos' as TabValue },
                    { t: 'Reclamos', d: 'Ley 24.240 · 10 días hábiles', tab: 'reclamos' as TabValue },
                  ].map((a) => (
                    <button
                      key={a.tab}
                      type="button"
                      onClick={() => setActiveTab(a.tab)}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-[13px] font-medium text-brand-navy-900">{a.t}</span>
                        <span className="block text-[11px] text-slate-500">{a.d}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <DueCalendar installments={installmentsAll.length ? installmentsAll : upcomingInstallments} />

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-brand-navy-900">Movimientos recientes</h2>
                  <p className="text-xs text-slate-500">Pagos acreditados y desembolsos de tu cuenta</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setActiveTab('comprobantes')}>
                  Ver comprobantes
                </Button>
              </header>
              <div className="p-4">
                {!recentMoves.length ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Todavía no hay movimientos. Cuando pagues una cuota o se acredite un crédito, aparecen acá.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentMoves.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-full',
                              m.kind === 'in' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700',
                            )}
                          >
                            {m.kind === 'in' ? <Banknote className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-brand-navy-900">{m.title}</p>
                            <p className="text-[11px] text-slate-500">{formatDateShort(m.date)}</p>
                          </div>
                        </div>
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            m.kind === 'in' ? 'text-sky-700' : 'text-emerald-700',
                          )}
                        >
                          {m.kind === 'in' ? '+' : ''}
                          {formatARS(m.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* TAB CONTENT · Áreas funcionales */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 space-y-6">
          {activeTab === 'notificaciones' && (
            <ActivityInbox
              onOpenHref={(href) => {
                try {
                  const url = new URL(href, window.location.origin)
                  const tab = url.searchParams.get('tab')
                  if (isDashboardTab(tab)) {
                    setActiveTab(tab)
                    return
                  }
                } catch {
                  /* href interno */
                }
                router.push(href)
              }}
            />
          )}

          {activeTab === 'cuenta' && <AccountSettings />}
          {activeTab === 'reclamos' && <ClaimsPanel />}

          {activeTab === 'mis_solicitudes' && (
            <SectionCard
              title="Mis Solicitudes de Crédito"
              description={`${loans.length} solicitudes · historial completo de tus trámites con UNICRÉDITOS.`}
              icon={<Inbox className="h-4.5 w-4.5 text-brand-primary" />}
              action={
                <Button
                  size="sm"
                  className="gap-1.5 text-xs shadow-sm"
                  onClick={() => setActiveTab('solicitar')}
                  disabled={products.length === 0}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Nueva solicitud
                </Button>
              }
            >
              {!loans.length ? (
                <div className="py-14 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
                    <Inbox className="h-7 w-7 text-brand-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">Todavía no solicitaste nada</div>
                    <div className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
                      Desde aquí vas a poder hacer seguimiento de cada solicitud. Simulá tu primer crédito ahora.
                    </div>
                  </div>
                  <Button
                    className="mt-2 gap-1.5 shadow-sm"
                    onClick={() => setActiveTab('solicitar')}
                    disabled={products.length === 0}
                  >
                    <Sparkles className="h-4 w-4" /> Ir al simulador
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">N° Solicitud</th>
                        <th className="px-4 py-3 text-left">Producto</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-center">Cuotas</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loans.map((l: any) => {
                        const s: 'aprobado' | 'pendiente' | 'rechazado' | 'en_evaluacion' | 'activo' | 'pagado' | 'vencido' =
                          l.status === 'approved' || l.status === 'disbursed' || l.status === 'active'
                            ? l.status === 'disbursed' || l.status === 'active' ? 'activo' : 'aprobado'
                            : l.status === 'paid' ? 'pagado' : l.status === 'pending' ? 'pendiente' : l.status === 'rejected' ? 'rechazado' : 'en_evaluacion'
                        return (
                          <tr key={l.id} className="transition hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{l.id.slice(0, 12)}…</td>
                            <td className="px-4 py-3 font-semibold">{(l.productName ?? l.purpose ?? 'Personal').toString()}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">{formatARS(Number(l.principal) || 0)}</td>
                            <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{String(l.term ?? 1)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <StatusChip status={s} />
                                {l.status === 'rejected' && l.rejectionReason ? (
                                  <span className="max-w-[180px] text-[10px] leading-snug text-rose-600 line-clamp-2">
                                    {l.rejectionReason}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-[11px] text-muted-foreground">{formatDateShort((l as any).createdAt ?? new Date())}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === 'ayuda' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <SectionCard
                title="Centro de Ayuda · FAQ"
                description="Respuestas a las preguntas más frecuentes de nuestros clientes."
                icon={<HelpCircle className="h-4.5 w-4.5 text-brand-primary" />}
                className="lg:col-span-8"
              >
                <div className="space-y-2">
                  {[
                    { q: '¿Cuánto tarda la aprobación?', a: 'Si Didit y BCRA están en orden, la decisión suele salir el mismo día hábil. Casos con deuda en Central de Deudores pasan a revisión.' },
                    { q: '¿Qué documentos necesito?', a: 'La identidad se valida solo con Didit (DNI vigente y prueba de vida). No se aceptan fotos cargadas a mano. También necesitás CUIL y una cuenta propia (CBU, CVU o alias) para el desembolso.' },
                    { q: '¿Puedo cancelar el crédito antes?', a: 'Sí. En Créditos ves la liquidación de cancelación: se cobra el capital remanente y se deducen intereses no devengados. Pagás con Mercado Pago. Después podés descargar la constancia de libre deuda.' },
                    { q: '¿Puedo arrepentirme?', a: `Sí, ${WITHDRAWAL_DAYS} días corridos desde la aceptación del contrato, si el crédito todavía no se acreditó. El botón está en Documentos.` },
                    { q: '¿Qué pasa si me atraso con una cuota?', a: 'La cuota queda vencida en el cronograma. UNICRÉDITOS no liquida punitorios de oficio. Pagá desde Mercado Pago, tarjeta o transferencia.' },
                    { q: '¿Cómo descargo un comprobante o el informe BCRA?', a: 'En Comprobantes y Documentos. El informe refleja la consulta a la Central de Deudores.' },
                    { q: '¿UNICRÉDITOS es un banco?', a: 'No. UNICRÉDITOS es la plataforma de créditos de RM International Group S.A.S. Consultamos la Central de Deudores del BCRA para evaluar. El crédito está sujeto a aprobación.' },
                  ].map((f, i) => (
                    <details
                      key={i}
                      className="group rounded-xl border border-border/60 bg-background p-4 transition open:border-brand-primary/40 open:bg-brand-primary-50/20"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-[12px] font-black text-brand-primary">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="font-semibold leading-snug">{f.q}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-90 group-open:text-brand-primary" />
                      </summary>
                      <p className="mt-3 pl-11 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                    </details>
                  ))}
                </div>
              </SectionCard>

              <div className="flex flex-col gap-6 lg:col-span-4">
                <SectionCard
                  title="Contacto"
                  description="Atención remota de lunes a viernes, 9 a 18 hs."
                  icon={<Handshake className="h-4 w-4 text-brand-cian" />}
                >
                  <div className="space-y-2.5 text-sm">
                    {[
                      { icon: BellRing, title: 'Atención', value: BRAND.phone || 'Formulario y email (sin 0800 publicado)', tone: 'emerald' },
                      { icon: Landmark, title: 'Soporte', value: BRAND.supportEmail, tone: 'primary' },
                      { icon: Globe2, title: 'Sitio web oficial', value: BRAND.domain, tone: 'primary' },
                      { icon: ShieldCheck, title: 'Consultas BCRA', value: 'Central de Deudores', tone: 'navy' },
                    ].map((c, i) => (
                      <div
                        key={i}
                        className={
                          'flex items-center justify-between gap-3 rounded-xl border p-3 ' +
                          (c.tone === 'emerald'
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : c.tone === 'navy'
                              ? 'border-brand-navy-800/10 bg-brand-navy-900/5'
                              : 'border-brand-primary-200/60 bg-brand-primary-50/40')
                        }
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary ring-1 ring-border/80">
                            <c.icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.title}</div>
                            <div className="text-sm font-bold text-foreground truncate">{c.value}</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="¿No encontraste lo que buscabas?"
                  description="Presentá un reclamo Ley 24.240. Plazo máximo de respuesta: 10 días hábiles."
                  icon={<FileText className="h-4 w-4 text-brand-primary" />}
                  className="flex-1"
                >
                  <div className="space-y-3 text-sm">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      El expediente queda en tu cuenta. Confirmamos por mail. No hay chat en vivo ni 0800 publicado.
                    </p>
                    <Button className="w-full gap-1.5 shadow-sm" onClick={() => setActiveTab('reclamos')}>
                      <Inbox className="h-4 w-4" /> Presentar reclamo
                    </Button>
                    <Button variant="outline" className="w-full gap-1.5" asChild>
                      <a href={`mailto:${BRAND.supportEmail}`}>
                        <Globe2 className="h-4 w-4" /> {BRAND.supportEmail}
                      </a>
                    </Button>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === 'perfil' && (
            <KYCProfileForm
              initialProfile={initialProfile}
              user={{
                name: session?.user?.name,
                email: session?.user?.email,
                image: session?.user?.image,
              }}
            />
          )}
          {activeTab === 'solicitar' && (
            <>
              {activeLoansList.length > 0 ? (
                <DecisionBanner
                  tone="warn"
                  title={`Tenés ${activeLoansList.length} crédito${activeLoansList.length === 1 ? '' : 's'} vigente${activeLoansList.length === 1 ? '' : 's'}`}
                  detail="No se puede originar otro préstamo hasta cancelar o terminar el ciclo actual. Pagá desde Mercado Pago o revisá el cronograma."
                  action={
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('cuotas')}>
                      Ver créditos
                    </Button>
                  }
                />
              ) : myKyc?.provider !== 'didit' || myKyc.status !== 'approved' ? (
                <DecisionBanner
                  tone="warn"
                  title="Falta la verificación Didit"
                  detail="Sin identidad aprobada el simulador no origina crédito. Completá DNI y prueba de vida en Biometría."
                  action={
                    <Button size="sm" onClick={() => setActiveTab('kyc_biometrico')}>
                      Ir a biometría
                    </Button>
                  }
                />
              ) : null}
              <LoanRequestSimulator
                products={products}
                identityReady={myKyc?.provider === 'didit' && myKyc.status === 'approved'}
              />
            </>
          )}
          {activeTab === 'scoring' && (
            <BCRAScore profile={initialProfile} lastBcraCheck={lastBcraCheck} />
          )}
          {activeTab === 'cuotas' && <LoansDashboard loans={loans} />}

          {activeTab === 'kyc_biometrico' && (
            <KYCBiometricPanel kyc={myKyc} profile={initialProfile} />
          )}

          {activeTab === 'bancos' && (
            <BancosPanel
              accounts={bankAccounts}
              profile={initialProfile}
              defaultHolderName={session?.user?.name ?? ''}
              isPending={isPending}
              onCreate={(v) =>
                startTransition(async () => {
                  try {
                    await createBankAccount(v)
                    showToast('ok', 'Cuenta bancaria agregada.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error al agregar.')
                  }
                })
              }
              onUpdate={(id, v) =>
                startTransition(async () => {
                  try {
                    await updateBankAccount(id, v)
                    showToast('ok', 'Cuenta actualizada. Volvé a validar.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error al actualizar.')
                  }
                })
              }
              onSetPrimary={(id) =>
                startTransition(async () => {
                  try {
                    await setPrimaryBankAccount(id)
                    showToast('ok', 'Cuenta principal actualizada.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error.')
                  }
                })
              }
              onValidate={(id) =>
                startTransition(async () => {
                  try {
                    const r = await validateBankAccountLive(id)
                    if (r?.ok) showToast('ok', r.message || 'Cuenta verificada.')
                    else showToast('err', r?.message || 'No se pudo validar.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error de validación.')
                  }
                })
              }
              onDelete={(id) =>
                startTransition(async () => {
                  try {
                    await deleteBankAccount(id)
                    showToast('ok', 'Cuenta eliminada.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error al eliminar.')
                  }
                })
              }
            />
          )}

          {activeTab === 'pagos' && (
            <PagosPanel
              profile={initialProfile}
              loans={loans}
              installments={installmentsAll}
              payments={payments}
              savedMethods={savedPaymentMethods}
              isPending={isPending}
              payerEmail={session?.user?.email ?? null}
            />
          )}

          {activeTab === 'documentos' && (
            <DocumentosPanel
              profile={initialProfile}
              loans={loans}
              lastBcraCheck={lastBcraCheck}
              bcraReports={bcraReports}
              contracts={contracts}
              installments={installmentsAll}
              isPending={isPending}
              onGenBCRA={(cid) =>
                startTransition(async () => {
                  try {
                    const r = await generateBCRAReport(cid)
                    showToast('ok', `Informe ${r.reportNumber} generado.`)
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error al generar informe.')
                  }
                })
              }
              onGenContract={(lid) =>
                startTransition(async () => {
                  try {
                    await generateLoanContract(lid)
                    showToast('ok', 'Contrato generado. Revisá y aceptalo.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error al generar contrato.')
                  }
                })
              }
              onAcceptContract={(cid) =>
                startTransition(async () => {
                  try {
                    const ip = (typeof window !== 'undefined' ? 'local-client' : '') || '0.0.0.0'
                    const ua = typeof window !== 'undefined' ? window.navigator.userAgent : ''
                    await acceptLoanContract(cid, { ip, ua })
                    showToast('ok', 'Contrato y pagaré aceptados. El expediente quedó firmado.')
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'Error al aceptar.')
                  }
                })
              }
              onRefinance={(loanId) =>
                startTransition(async () => {
                  try {
                    const r = await refinanceLoan(loanId)
                    showToast('ok', `Refinanciación ${r.number}/2. El saldo se repartió en ${r.remainingCount} cuotas.`)
                    router.refresh()
                  } catch (e: any) {
                    showToast('err', e?.message ?? 'No se pudo refinanciar.')
                  }
                })
              }
              onWithdraw={(loanId) =>
                startTransition(async () => {
                  const r = await withdrawLoanAcceptance(loanId)
                  if (r.ok) {
                    showToast('ok', 'Arrepentimiento registrado. El crédito y el contrato quedaron anulados.')
                    router.refresh()
                  } else {
                    showToast('err', r.error)
                  }
                })
              }
            />
          )}

          {activeTab === 'comprobantes' && (
            <ComprobantesPanel
              receipts={paymentReceipts}
              disbursements={disbursements}
              payments={payments}
            />
          )}

          {toast && (
            <div
              className={cn(
                'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-200',
                toast.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300',
              )}
            >
              {toast.type === 'ok' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="text-sm font-medium">{toast.msg}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-1 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}

function kycLabel(s: string | null | undefined) {
  switch (s) {
    case 'approved':
      return 'Aprobado'
    case 'rejected':
      return 'Rechazado'
    case 'reviewing':
    case 'submitted':
      return 'En revisión'
    case 'pending':
      return 'Pendiente'
    case 'verified':
      return 'Verificado'
    default:
      return 'No iniciado'
  }
}
function kycVariant(s: string | null | undefined) {
  switch (s) {
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60'
    case 'rejected':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200/60'
    case 'reviewing':
    case 'submitted':
    case 'verified':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200/60'
    case 'pending':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/60'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function KYCBiometricPanel({
  kyc,
  profile,
}: {
  kyc: KYCVerification | null
  profile: Profile | null
}) {
  const [diditConfigured, setDiditConfigured] = useState<boolean | null>(null)
  const [diditError, setDiditError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()
  const approved = kyc?.status === 'approved' && kyc.provider === 'didit'
  const capture = useMemo(
    () => parseDiditCapture(kyc?.ocrData, { sessionId: kyc?.providerReferenceId, status: kyc?.status }),
    [kyc?.ocrData, kyc?.providerReferenceId, kyc?.status],
  )
  const media = useMemo(
    () =>
      kycMediaBundle(capture, {
        front: kyc?.dniFrontImageUrl,
        back: kyc?.dniBackImageUrl,
        selfie: kyc?.selfieImageUrl,
      }),
    [capture, kyc?.dniFrontImageUrl, kyc?.dniBackImageUrl, kyc?.selfieImageUrl],
  )
  const id = capture.ids[0]
  const shots = [
    { label: 'DNI frente', url: media.front },
    { label: 'DNI dorso', url: media.back },
    { label: 'Selfie / prueba de vida', url: media.selfie },
  ].filter((s) => s.url)

  useEffect(() => {
    void getDiditPublicConfig().then((cfg) => setDiditConfigured(cfg.configured))
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" /> Identidad Didit
              </CardTitle>
              <CardDescription>
                La verificación se hace dentro de UNICRÉDITOS: DNI, prueba de vida y coincidencia facial.
              </CardDescription>
            </div>
            <Badge variant="outline" className={cn('border px-2.5 py-1', kycVariant(kyc?.status))}>
              {kycLabel(kyc?.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            UNICRÉDITOS no recibe fotos ni videos cargados a mano. El flujo de Didit se abre acá, sin salir de la web.
          </p>
          {id?.fullName || id?.documentNumber || kyc?.dniNumber ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground">{id?.fullName || 'Documento verificado'}</p>
              <p className="mt-1 font-mono text-muted-foreground">
                DNI {id?.documentNumber || kyc?.dniNumber || '—'}
                {id?.birthDate ? ` · Nac. ${id.birthDate}` : ''}
              </p>
            </div>
          ) : null}
          {kyc?.rejectionReason && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
              <AlertCircle className="mr-1.5 inline h-3.5 w-3.5" />
              <span className="font-semibold">Rechazado:</span> {kyc.rejectionReason}
            </div>
          )}
          {kyc?.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              Revisado el {new Date(kyc.reviewedAt as any).toLocaleDateString('es-AR')}
              {kyc?.reviewedBy && ` · ${kyc.reviewedBy === 'didit' ? 'Didit' : `Operador #${kyc.reviewedBy.slice(0, 6)}`}`}
            </p>
          )}
          {kyc?.provider === 'didit' && kyc.providerReferenceId && (
            <p className="font-mono text-xs text-muted-foreground">Sesión Didit {kyc.providerReferenceId}</p>
          )}
          {kyc?.faceMatchScore != null && (
            <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
              Face match {String(kyc.faceMatchScore)}%
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Verificar con Didit</CardTitle>
          <CardDescription>
            Completá DNI y prueba de vida acá, sin salir de UNICRÉDITOS. Sin aprobación de Didit no se puede solicitar crédito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {shots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {shots.map((s) => (
                <figure key={s.label} className="overflow-hidden rounded-lg border bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url!} alt={s.label} className="h-28 w-full object-cover" referrerPolicy="no-referrer" />
                  <figcaption className="px-2 py-1 text-[10px] text-muted-foreground">{s.label}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          {diditConfigured === null ? (
            <p className="text-sm text-muted-foreground">Comprobando Didit…</p>
          ) : !diditConfigured ? (
            <p className="text-sm text-destructive">
              Didit no está configurado. Falta DIDIT_API_KEY en el proceso de Next. Reiniciá `next dev`.
            </p>
          ) : approved ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Tu identidad ya está verificada por Didit.
            </p>
          ) : (
            <>
              <DiditVerifyButton
                mode="session"
                dni={kyc?.dniNumber ?? profile?.dni ?? undefined}
                birthDate={profile?.birthDate ?? undefined}
                phone={profile?.phone ?? undefined}
                className="w-full"
                onError={setDiditError}
                onCompleted={() => router.refresh()}
              />
              {kyc?.providerReferenceId && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={syncing}
                  onClick={() => {
                    setSyncing(true)
                    void syncDiditSession(kyc.providerReferenceId ?? undefined)
                      .then((res) => {
                        if (!res.ok) setDiditError(res.error)
                        else router.refresh()
                      })
                      .finally(() => setSyncing(false))
                  }}
                >
                  Actualizar resultado Didit
                </Button>
              )}
            </>
          )}
          {diditError && <p className="text-sm text-destructive">{diditError}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

function BancosPanel({
  accounts,
  profile,
  defaultHolderName,
  isPending,
  onCreate,
  onUpdate,
  onSetPrimary,
  onDelete,
  onValidate,
}: {
  accounts: BankAccount[]
  profile: Profile | null
  defaultHolderName?: string
  isPending: boolean
  onCreate: (v: {
    accountType: 'cbu' | 'cvu' | 'alias' | 'cci'
    bankName: string
    cbu?: string
    cvu?: string
    alias?: string
    accountNumber?: string
    holderName: string
    holderCuil: string
    setAsPrimary?: boolean
  }) => void
  onUpdate: (
    id: string,
    v: {
      accountType: 'cbu' | 'cvu' | 'alias' | 'cci'
      bankName: string
      cbu?: string
      cvu?: string
      alias?: string
      accountNumber?: string
      holderName: string
      holderCuil: string
    },
  ) => void
  onSetPrimary: (id: string) => void
  onDelete: (id: string) => void
  onValidate: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<'cbu' | 'cvu' | 'alias' | 'cci'>('cbu')
  const [bankName, setBankName] = useState('')
  const [cbu, setCbu] = useState('')
  const [cvu, setCvu] = useState('')
  const [alias, setAlias] = useState('')
  const [cci, setCci] = useState('')
  const [holderName, setHolderName] = useState(
    (profile as any)?.fullName ?? (profile as any)?.holderName ?? defaultHolderName ?? '',
  )
  const [holderCuil, setHolderCuil] = useState(profile?.cuil ?? '')
  const [primary, setPrimary] = useState(accounts.length === 0)

  function resetForm() {
    setEditingId(null)
    setAccountType('cbu')
    setBankName('')
    setCbu('')
    setCvu('')
    setAlias('')
    setCci('')
    setHolderName((profile as any)?.fullName ?? defaultHolderName ?? '')
    setHolderCuil(profile?.cuil ?? '')
    setPrimary(accounts.length === 0)
  }

  function startEdit(a: BankAccount) {
    setEditingId(a.id)
    setAccountType((a.accountType as any) || 'cbu')
    setBankName(a.bankName || '')
    setCbu(a.cbu || '')
    setCvu(a.cvu || '')
    setAlias(normalizeBankAlias(a.alias || ''))
    setCci(a.accountNumber || '')
    setHolderName(a.holderName || '')
    setHolderCuil(a.holderCuil || '')
    setPrimary(!!a.isPrimary)
  }

  const payload = {
    accountType,
    bankName,
    cbu: cbu || undefined,
    cvu: cvu || undefined,
    alias: alias ? normalizeBankAlias(alias) : undefined,
    accountNumber: cci || undefined,
    holderName,
    holderCuil,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5 text-primary" /> Mis cuentas de desembolso
          </CardTitle>
          <CardDescription>
            Las cuentas se usarán para acreditar tus préstamos y cobrar reintegros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <Landmark className="h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">
                No tenés cuentas bancarias cargadas
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Agregá tu CBU, CVU o ALIAS para el desembolso. Tesorería acredita cuando
                confirma la transferencia, sin plazo fijo de 24/48 hs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                        a.accountType === 'cvu'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                          : a.accountType === 'alias'
                            ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                      )}
                    >
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{a.bankName}</p>
                        <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                          {a.accountType}
                        </Badge>
                        {a.isPrimary && (
                          <Badge className="gap-1 bg-amber-500/90 hover:bg-amber-500 text-white">
                            <Star className="h-3 w-3 fill-white" /> Principal
                          </Badge>
                        )}
                        {a.isVerified ? (
                          <Badge variant="outline" className="gap-1 border-emerald-300/60 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Verificada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-amber-300/60 text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> Pendiente verif.
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Titular: {a.holderName} · CUIL {a.holderCuil}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-xs">
                        {a.cbu && (
                          <span>
                            CBU: <span className="font-semibold">{formatCBU(a.cbu)}</span>
                          </span>
                        )}
                        {a.cvu && (
                          <span>
                            CVU: <span className="font-semibold">{formatCVU(a.cvu)}</span>
                          </span>
                        )}
                        {a.alias && (
                          <span>
                            ALIAS: <span className="font-semibold">{displayAlias(a.alias)}</span>
                          </span>
                        )}
                      </div>
                      {a.extractedProfile ? (
                        <div className="mt-2 grid gap-1 rounded-md bg-muted/60 px-2 py-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                          <span>Entidad: <strong className="text-foreground">{(a.extractedProfile as any).entidad || a.bankName}</strong></span>
                          <span>Código: {(a.extractedProfile as any).codigoEntidad || a.bankCode || '—'}</span>
                          <span>Esquema: {a.scheme || (a.extractedProfile as any).scheme || a.accountType}</span>
                          <span>Red: {a.networkStatus || (a.extractedProfile as any).estado || '—'}</span>
                          {(a.extractedProfile as any).sucursal ? <span>Sucursal: {(a.extractedProfile as any).sucursal}</span> : null}
                          {(a.extractedProfile as any).tipoCuenta ? <span>Tipo: {(a.extractedProfile as any).tipoCuenta}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!a.isVerified && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1"
                        disabled={isPending || !(a.cbu || a.cvu || a.alias)}
                        onClick={() => onValidate(a.id)}
                      >
                        <Globe2 className="h-3.5 w-3.5" /> Validar ArgenAPI
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={isPending}
                      onClick={() => startEdit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    {!a.isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isPending}
                        onClick={() => onSetPrimary(a.id)}
                      >
                        <Star className="h-3.5 w-3.5" /> Principal
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => onDelete(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Editar cuenta' : 'Agregar cuenta'}</CardTitle>
          <CardDescription>
            CBU/CVU: 22 dígitos. Alias: 6 a 20 caracteres, sin @. El @ es solo visual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo de cuenta</Label>
            <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cbu">CBU (Banco tradicional)</SelectItem>
                <SelectItem value="cvu">CVU (Billetera virtual · Mercado Pago / Ualá / etc)</SelectItem>
                <SelectItem value="alias">ALIAS (transferencias)</SelectItem>
                <SelectItem value="cci">CCI (Exterior)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Banco / Entidad</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ej: Banco Galicia" />
          </div>
          {accountType === 'cbu' && (
            <div className="space-y-1.5">
              <Label>CBU (22 dígitos)</Label>
              <Input
                value={cbu}
                onChange={(e) => setCbu(e.target.value.replace(/\D/g, '').slice(0, 22))}
                placeholder="00000000 0 00000000000000"
                className="font-mono tracking-wide"
              />
            </div>
          )}
          {accountType === 'cvu' && (
            <div className="space-y-1.5">
              <Label>CVU (22 dígitos)</Label>
              <Input
                value={cvu}
                onChange={(e) => setCvu(e.target.value.replace(/\D/g, '').slice(0, 22))}
                placeholder="00000000 0 00000000000000"
                className="font-mono tracking-wide"
              />
            </div>
          )}
          {accountType === 'alias' && (
            <div className="space-y-1.5">
              <Label>ALIAS</Label>
              <div className="flex overflow-hidden rounded-md border border-input bg-background">
                <span className="flex items-center border-r bg-muted px-3 text-sm font-medium text-muted-foreground">
                  @
                </span>
                <Input
                  value={alias}
                  onChange={(e) => setAlias(normalizeBankAlias(e.target.value))}
                  placeholder="emprenor"
                  className="border-0 lowercase shadow-none focus-visible:ring-0"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Escribí solo el alias. No hace falta el @; si lo pegás, se quita solo.
              </p>
            </div>
          )}
          {accountType === 'cci' && (
            <div className="space-y-1.5">
              <Label>CCI / SWIFT / IBAN (Transferencia internacional)</Label>
              <Input
                value={cci}
                onChange={(e) => setCci(e.target.value.trim())}
                placeholder="Ej: ADARARBAXXX / IBAN GB29 NWBK 6016 1331 9268 19"
                className="font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Ingrese el código SWIFT/BIC o el IBAN completo de la cuenta exterior.
              </p>
            </div>
          )}
          <Separator />
          <div className="space-y-1.5">
            <Label>Titular de la cuenta</Label>
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>CUIL titular</Label>
            <Input
              value={holderCuil}
              onChange={(e) => setHolderCuil(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="20-12345678-9"
              className="font-mono"
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs">
            <input
              type="checkbox"
              checked={primary}
              onChange={(e) => setPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-input"
              disabled={!!editingId}
            />
            <span>
              Establecer como <span className="font-semibold">cuenta principal</span> para
              acreditaciones.
            </span>
          </label>
        </CardContent>
        <CardFooter className="border-t bg-muted/20 gap-2">
          {editingId ? (
            <Button type="button" variant="outline" className="w-full" disabled={isPending} onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
          <Button
            disabled={
              isPending ||
              !bankName ||
              !holderName ||
              holderCuil.length < 11 ||
              (accountType === 'cbu' && cbu.length < 22) ||
              (accountType === 'cvu' && cvu.length < 22) ||
              (accountType === 'alias' && alias.length < 6) ||
              (accountType === 'cci' && !cci.trim())
            }
            className="w-full gap-1.5"
            onClick={() => {
              if (editingId) onUpdate(editingId, payload)
              else onCreate({ ...payload, setAsPrimary: primary })
            }}
          >
            <Landmark className="h-4 w-4" /> {editingId ? 'Guardar cambios' : 'Agregar cuenta'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function PagosPanel({
  profile: _profile,
  loans: _loans,
  installments,
  payments,
  savedMethods,
  isPending,
  payerEmail,
}: {
  profile: Profile | null
  loans: Loan[]
  installments: UpcomingInstallment[]
  payments: PaymentType[]
  savedMethods: SavedMethodType[]
  isPending: boolean
  payerEmail?: string | null
}) {
  const pending = [...installments]
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .sort((a, b) => new Date(a.dueDate as any).getTime() - new Date(b.dueDate as any).getTime())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [method, setMethod] = useState<any>('mercado_pago')
  const [payOpen, setPayOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const payFromUrl = searchParams.get('pay') || searchParams.get('cuota')
  const methodFromUrl = searchParams.get('method')
  const pendingIds = pending.map((row) => row.id).join(',')

  useEffect(() => {
    if (!payFromUrl) return
    if (!pendingIds.split(',').includes(payFromUrl)) return
    setSelectedIds((ids) => (ids.includes(payFromUrl) ? ids : [...ids, payFromUrl]))
    if (
      methodFromUrl &&
      ['mercado_pago', 'tarjeta_credito', 'tarjeta_debito', 'pago_facil', 'rapipago', 'ticket', 'mercadopago_wallet', 'transferencia_bancaria'].includes(
        methodFromUrl,
      )
    ) {
      setMethod(methodFromUrl)
    }
    setPayOpen(true)
  }, [payFromUrl, methodFromUrl, pendingIds])

  const toggle = (id: string) =>
    setSelectedIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]))

  const totalSel = pending
    .filter((i) => selectedIds.includes(i.id))
    .reduce((acc, i) => acc + (typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount) || 0), 0)

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-primary" /> Mis cuotas · pagar desde la web
              </CardTitle>
              <CardDescription>
                Caja de cobro: crédito, débito, tarjetas guardadas, Mercado Pago, Pago Fácil, Rapipago o transferencia. No salís del panel.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {pending.length} pendiente{pending.length === 1 ? '' : 's'} ·{' '}
              {installments.length - pending.length} pagada
              {installments.length - pending.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="text-sm font-medium">¡Sin cuotas pendientes!</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Estás al día con tus pagos. Cuando haya cuotas nuevas aparecerán acá.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Préstamo</TableHead>
                    <TableHead>Cuota</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((i) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const due = new Date(i.dueDate as any)
                    due.setHours(0, 0, 0, 0)
                    const daysLate = Math.round((today.getTime() - due.getTime()) / 86400000)
                    const overdue = i.status !== 'paid' && daysLate > 0
                    const sel = selectedIds.includes(i.id)
                    return (
                      <TableRow
                        key={i.id}
                        role="button"
                        tabIndex={0}
                        className={cn('cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', sel && 'bg-primary/5')}
                        onClick={() => toggle(i.id)}
                        onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggle(i.id)
                          }
                        }}
                      >
                        <TableCell>
                          <div
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded border',
                              sel
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-input',
                            )}
                          >
                            {sel && <Check className="h-3 w-3" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs">
                            # {i.loanId.slice(0, 8)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatARS(i.loanPrincipal)} · {i.loanTerm} cuotas
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {i.number} / {i.loanTerm}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">
                            {new Date(i.dueDate as any).toLocaleDateString('es-AR')}
                          </div>
                          {overdue && (
                            <Badge variant="destructive" className="mt-1 text-[10px] py-0 h-4">
                              {daysLate} días atrasada
                            </Badge>
                          )}
                          {!overdue && daysLate >= -7 && daysLate <= 0 && (
                            <Badge className="mt-1 text-[10px] py-0 h-4 bg-amber-500 hover:bg-amber-500">
                              Próxima · {Math.abs(daysLate)}d
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatARS(i.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={i.status === 'paid' ? 'default' : 'secondary'}
                            className={cn(
                              i.status === 'paid' && 'bg-emerald-500 hover:bg-emerald-500',
                              i.status === 'pending' && !overdue && 'bg-sky-500/80 hover:bg-sky-500',
                              overdue && 'bg-rose-500 hover:bg-rose-500',
                            )}
                          >
                            {i.status === 'paid'
                              ? 'Pagada'
                              : overdue
                                ? 'Vencida'
                                : 'Pendiente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6 lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checkout</CardTitle>
            <CardDescription>
              Cuotas seleccionadas: <span className="font-semibold">{selectedIds.length}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Total a pagar
                </span>
                <span className="font-mono text-2xl font-bold">{formatARS(totalSel)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger>
                  <SelectValue>{paymentMethodLabel(method)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mercado_pago">Mercado Pago · todos los medios</SelectItem>
                  <SelectItem value="pago_facil">Pago Fácil (efectivo)</SelectItem>
                  <SelectItem value="rapipago">Rapipago (efectivo)</SelectItem>
                  <SelectItem value="ticket">Cupón efectivo (Pago Fácil o Rapipago)</SelectItem>
                  <SelectItem value="tarjeta_credito">Tarjeta de crédito</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta de débito</SelectItem>
                  <SelectItem value="mercadopago_wallet">Dinero en cuenta Mercado Pago</SelectItem>
                  <SelectItem value="transferencia_bancaria">Transferencia a RM (Brubank)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {method === 'transferencia_bancaria'
                  ? 'Vas a ver el CBU de RM International Group (Brubank). Transferí, subí el comprobante y tesorería acredita cuando vea el dinero.'
                  : method === 'tarjeta_credito' || method === 'tarjeta_debito'
                    ? 'Se abre el formulario de tarjeta en esta caja: una nueva o una ya guardada. El cobro no te saca del panel.'
                    : 'El cobro se abre dentro de UNICRÉDITOS: tarjetas, cuenta Mercado Pago, Pago Fácil, Rapipago y QR EMV de Mercado Pago con el importe real.'}
              </p>
            </div>

            {savedMethods.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Métodos guardados</p>
                <div className="grid gap-2">
                  {savedMethods.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className="flex w-full items-center justify-between rounded-lg border bg-card p-2.5 text-left text-xs hover:border-brand-primary/40"
                      onClick={() => {
                        if (!pending.length) return
                        setMethod(m.type === 'card' ? 'tarjeta_credito' : method)
                        setSelectedIds((ids) => (ids.length ? ids : [pending[0].id]))
                        setPayOpen(true)
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {m.brand ?? m.type} {m.last4 && `**** ${m.last4}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {m.nickname ?? m.type}
                            {m.isDefault && ' · Default'}
                          </p>
                        </div>
                      </div>
                      {m.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          ✓
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t bg-muted/20 pt-4">
            <Button
              disabled={isPending || selectedIds.length === 0}
              className="w-full gap-1.5"
              onClick={() => setPayOpen(true)}
            >
              <Wallet className="h-4 w-4" />
              {method === 'transferencia_bancaria' ? 'Informar transferencia' : 'Abrir caja'}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Mercado Pago acredita en tiempo real y emite el recibo cuando confirma el dinero. La transferencia a RM la concilia tesorería.
            </p>
            <PayInstallmentDialog
              open={payOpen}
              onClose={() => {
                setPayOpen(false)
                const sp = new URLSearchParams(window.location.search)
                if (sp.has('pay') || sp.has('cuota') || sp.has('method')) {
                  sp.delete('pay')
                  sp.delete('cuota')
                  sp.delete('method')
                  const next = sp.toString()
                  router.replace(next ? `/dashboard?${next}` : '/dashboard?tab=pagos')
                }
              }}
              email={payerEmail}
              method={method}
              initialTab={method === 'transferencia_bancaria' ? 'transfer' : 'mp'}
              onSettled={() => router.refresh()}
              installments={pending
                .filter((i) => selectedIds.includes(i.id))
                .map((i) => ({
                  id: i.id,
                  number: i.number,
                  amount: i.amount,
                  dueDate: i.dueDate,
                  loanId: i.loanId,
                }))}
            />
          </CardFooter>
        </Card>

        {payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos pagos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-auto pr-1">
              {payments.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md',
                        p.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : p.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {p.status === 'paid' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : p.status === 'pending' ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {paymentMethodLabel(p.method)}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">
                        {p.referenceNumber ?? p.id.slice(0, 10)} ·{' '}
                        {new Date(p.createdAt as any).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">{formatARS(p.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{paymentStatusLabel(p.status)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function refinanceUsed(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 0
  const list = (data as { refinanciaciones?: unknown[] }).refinanciaciones
  return Array.isArray(list) ? list.length : 0
}

function lastRefinanceFromSignature(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const list = (data as { refinanciaciones?: Array<{ at?: string }> }).refinanciaciones
  return list?.[list.length - 1]?.at ?? null
}

function DocumentosPanel({
  profile: _profile,
  loans,
  lastBcraCheck,
  bcraReports,
  contracts,
  installments,
  isPending,
  onGenBCRA,
  onGenContract,
  onAcceptContract,
  onRefinance,
  onWithdraw,
}: {
  profile: Profile | null
  loans: Loan[]
  lastBcraCheck: BcraCheck | null
  bcraReports: BcraReportType[]
  contracts: (LoanContract & { loan?: Loan | null })[]
  installments: UpcomingInstallment[]
  isPending: boolean
  onGenBCRA: (checkId?: string | null) => void
  onGenContract: (loanId: string) => void
  onAcceptContract: (contractId: string) => void
  onRefinance: (loanId: string) => void
  onWithdraw: (loanId: string) => void
}) {
  const loantee = loans.filter((l) => l.status === 'approved' || l.status === 'active')

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" /> Constancia ARCA
          </CardTitle>
          <CardDescription>
            Razón social, domicilio fiscal e impuestos consultados al padrón con el certificado WSAA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="gap-1.5">
            <a href="/dashboard/documentos/constancia-arca" target="_blank" rel="noreferrer">
              <Printer className="h-4 w-4" /> Ver e imprimir constancia
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scale className="h-5 w-5 text-primary" /> Informes BCRA
              </CardTitle>
              <CardDescription>
                Imprimí tu informe completo con branding y logo de UNICRÉDITOS.
              </CardDescription>
            </div>
            <Badge variant="outline">{bcraReports.length} informes</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lastBcraCheck ? (
            <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 p-4 dark:bg-sky-950/20 dark:border-sky-800/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Última consulta BCRA
                  </p>
                  <p className="font-mono text-xl font-bold text-sky-700 dark:text-sky-400">
                    Score {lastBcraCheck.computedScore ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastBcraCheck.createdAt as any).toLocaleString('es-AR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => onGenBCRA(lastBcraCheck.id)}
                  className="gap-1.5"
                >
                  <FileCheck2 className="h-4 w-4" /> Generar informe imprimible
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4 dark:bg-amber-950/20 dark:border-amber-800/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Sin consulta BCRA previa
                  </p>
                  <p className="text-sm text-foreground/80">
                    Podés generar un informe inicial usando los datos de tu perfil.
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => onGenBCRA(null)}
                  className="gap-1.5"
                >
                  <FileCheck2 className="h-4 w-4" /> Generar informe ahora
                </Button>
              </div>
            </div>
          )}
          {bcraReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-center">
              <Scale className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-xs font-medium">Sin informes generados aún</p>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => onGenBCRA(null)}
                className="gap-1 mt-1"
              >
                <FileCheck2 className="h-3.5 w-3.5" /> Generar primer informe
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {bcraReports.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-xs"
                >
                  <div>
                    <p className="font-mono font-semibold text-foreground">
                      {r.reportNumber}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Emisión: {new Date(r.createdAt as any).toLocaleDateString('es-AR')} · Score{' '}
                      <span className="font-semibold">{r.scoreAtGeneration ?? '—'}</span>
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Link
                      href={`/dashboard/documentos/informe-bcra/${r.id}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/documentos/informe-bcra/${r.id}`}
                      className="inline-flex"
                    >
                      <Button size="sm" className="gap-1">
                        <Printer className="h-3.5 w-3.5" /> Imprimir PDF
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" /> Contratos de préstamo
              </CardTitle>
              <CardDescription>
                Expediente del acreedor: contrato de préstamo (mutuo), pagaré, estado de deuda e intimación. Firma electrónica Ley 25.506.
              </CardDescription>
            </div>
            <Badge variant="outline">{contracts.length} contratos</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loantee.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 text-xs font-medium text-primary-foreground/90 dark:text-foreground/90">
                Préstamos sin contrato generado
              </p>
              <div className="space-y-1.5">
                {loantee
                  .filter((l) => !contracts.some((c) => c.loanId === l.id))
                  .slice(0, 3)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-lg bg-background/70 p-2.5 text-xs"
                    >
                      <div>
                        <p className="font-mono font-semibold">#{l.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatARS(l.principal)} · {l.term} cuotas ·{' '}
                          <span className="font-medium">{loanStatusLabel(l.status)}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isPending}
                        onClick={() => onGenContract(l.id)}
                      >
                        <FileText className="h-3.5 w-3.5" /> Generar contrato
                      </Button>
                    </div>
                  ))}
                {loantee.filter((l) => !contracts.some((c) => c.loanId === l.id)).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Todos tus préstamos tienen contrato generado.
                  </p>
                )}
              </div>
            </div>
          )}
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-xs font-medium">Sin contratos emitidos</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-semibold text-foreground truncate">
                        {c.templateName} v{c.version}
                      </p>
                      <Badge
                        variant={c.status === 'accepted' ? 'default' : 'outline'}
                        className={cn(
                          'text-[10px]',
                          c.status === 'accepted' && 'bg-emerald-500 hover:bg-emerald-500',
                          c.status === 'pending_acceptance' &&
                            'bg-amber-500/90 hover:bg-amber-500 border-0 text-white',
                          c.status === 'rejected' && 'bg-rose-500 hover:bg-rose-500 border-0',
                          c.status === 'withdrawn' && 'bg-slate-500 hover:bg-slate-500 border-0 text-white',
                        )}
                      >
                        {c.status === 'accepted'
                          ? '✓ Aceptado'
                          : c.status === 'pending_acceptance'
                            ? 'Pendiente firma'
                            : c.status === 'rejected'
                              ? 'Rechazado'
                              : c.status === 'withdrawn'
                                ? 'Arrepentido'
                                : c.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Emisión: {new Date(c.createdAt as any).toLocaleDateString('es-AR')}
                      {c.acceptedAt &&
                        ` · Aceptado: ${new Date(c.acceptedAt as any).toLocaleDateString('es-AR')}`}
                      {c.acceptedIp && ` · IP ${c.acceptedIp}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={`/dashboard/documentos/contrato/${c.id}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> Contrato
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/documentos/pagare/${c.id}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        Pagaré
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/documentos/estado-deuda/${c.id}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        Deuda
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/documentos/cuponera/${c.loanId}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        Cuponera
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/documentos/cancelacion/${c.loanId}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        Cancelación
                      </Button>
                    </Link>
                    <Link
                      href={`/dashboard/documentos/solvencia/${c.loanId}`}
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" className="gap-1">
                        Solvencia
                      </Button>
                    </Link>
                    {(c.loan ?? loans.find((l) => l.id === c.loanId))?.status === 'paid' ? (
                      <Link
                        href={`/dashboard/documentos/libre-deuda/${c.loanId}`}
                        className="inline-flex"
                      >
                        <Button size="sm" variant="outline" className="gap-1">
                          Libre deuda
                        </Button>
                      </Link>
                    ) : null}
                    {evaluateIntimation(
                      asMoraRows(installments.filter((row) => row.loanId === c.loanId)),
                      lastRefinanceFromSignature(c.signatureData),
                    ).ok ? (
                      <Link
                        href={`/dashboard/documentos/intimacion/${c.id}`}
                        className="inline-flex"
                      >
                        <Button size="sm" variant="outline" className="gap-1">
                          Intimación
                        </Button>
                      </Link>
                    ) : null}
                    {c.status === 'accepted' &&
                    evaluateRefinance(
                      asMoraRows(installments.filter((row) => row.loanId === c.loanId)),
                      refinanceUsed(c.signatureData),
                    ).ok ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Refinanciar el saldo en cuotas iguales? Quedan ${MAX_REFINANCES - refinanceUsed(c.signatureData)} de ${MAX_REFINANCES}.`,
                            )
                          ) {
                            onRefinance(c.loanId)
                          }
                        }}
                      >
                        Refinanciar saldo
                      </Button>
                    ) : null}
                    {c.status === 'pending_acceptance' && (
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={isPending}
                        onClick={() => onAcceptContract(c.id)}
                      >
                        <Check className="h-3.5 w-3.5" /> Aceptar contrato y pagaré
                      </Button>
                    )}
                    {canWithdrawAcceptance({
                      contractStatus: c.status,
                      acceptedAt: c.acceptedAt,
                      loanStatus: (c.loan ?? loans.find((l) => l.id === c.loanId))?.status,
                      disbursedAt: (c.loan ?? loans.find((l) => l.id === c.loanId))?.disbursedAt,
                    }) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Arrepentirte de este crédito? Tenés ${WITHDRAWAL_DAYS} días corridos desde la firma. Solo si todavía no se acreditó.`,
                            )
                          ) {
                            onWithdraw(c.loanId)
                          }
                        }}
                      >
                        Arrepentirme ({WITHDRAWAL_DAYS} días)
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ComprobantesPanel({
  receipts,
  disbursements,
  payments: _payments,
}: {
  receipts: (PaymentReceiptType & { installment?: UpcomingInstallment | null })[]
  disbursements: (DisbursementType & { loan?: Loan | null })[]
  payments: PaymentType[]
}) {
  const [tab, setTab] = useState<'pagos' | 'desembolsos'>('pagos')
  const list = tab === 'pagos' ? receipts : (disbursements as any[])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-primary" /> Mis comprobantes
            </CardTitle>
            <CardDescription>
              Todos tus recibos válidos. Podés descargarlos en PDF en cualquier momento.
            </CardDescription>
          </div>
          <div className="rounded-lg bg-muted p-1 flex w-fit">
            {(['pagos', 'desembolsos'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'pagos'
                  ? `Recibos de pago (${receipts.length})`
                  : `Desembolsos / Acreditaciones (${disbursements.length})`}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {tab === 'pagos' ? 'Sin comprobantes de pago aún' : 'Sin desembolsos acreditados'}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {tab === 'pagos'
                ? 'Cuando pagues una cuota se emitirá automáticamente el comprobante válido con el saldo restante.'
                : 'Cuando tu préstamo sea desembolsado, aquí aparecerá el comprobante de acreditación en cuenta.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>N° comprobante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r: any) => {
                  const isRec = tab === 'pagos'
                  const receipt: PaymentReceiptType | null = isRec ? r : null
                  const disb: DisbursementType | null = isRec ? null : r
                  const targetId = isRec ? receipt!.id : disb!.id
                  const ttype = isRec
                    ? (receipt!.receiptType === 'disbursement'
                        ? 'Desembolso'
                        : receipt!.receiptType === 'partial_payment'
                          ? 'Pago parcial'
                          : receipt!.receiptType === 'loan_approved'
                            ? 'Crédito aprobado'
                            : 'Recibo de pago')
                    : disb!.status === 'credited'
                      ? 'Acreditado en cuenta'
                      : disb!.status === 'failed'
                        ? 'Fallido'
                        : disb!.status === 'processing'
                          ? 'En procesamiento'
                          : 'Pendiente'
                  const amount = isRec ? receipt!.amount : disb!.amount
                  const date = isRec ? receipt!.issuedAt ?? receipt!.createdAt : disb!.creditedAt ?? disb!.createdAt
                  const detalle = isRec
                    ? [
                        receipt!.installmentId && `Cuota #${(receipt as any).installment?.number ?? '?'}`,
                        receipt!.previousBalance !== null &&
                          receipt!.previousBalance !== undefined &&
                          `Saldo ant: ${formatARS(receipt!.previousBalance as any)}`,
                        receipt!.newBalance !== null &&
                          receipt!.newBalance !== undefined &&
                          `Saldo actual: ${formatARS(receipt!.newBalance as any)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : [
                        disb!.receiptNumber,
                        disb!.disbursementMethod === 'bank_transfer'
                          ? 'Transferencia bancaria'
                          : disb!.disbursementMethod,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                  return (
                    <TableRow key={targetId}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {isRec ? receipt!.receiptNumber : disb!.receiptNumber ?? disb!.id.slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            isRec
                              ? receipt!.receiptType === 'disbursement'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60'
                                : 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200/60'
                              : disb!.status === 'credited'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/60'
                                : disb!.status === 'failed'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200/60'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/60',
                          )}
                        >
                          {ttype}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(date as any).toLocaleDateString('es-AR')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {detalle}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatARS(amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Link
                            href={`/dashboard/documentos/recibo/${targetId}`}
                            className="inline-flex"
                          >
                            <Button size="sm" variant="outline" className="gap-1">
                              <Eye className="h-3.5 w-3.5" /> Recibo
                            </Button>
                          </Link>
                          {isRec ? (
                            <Link
                              href={`/dashboard/documentos/liquidacion/${targetId}`}
                              className="inline-flex"
                            >
                              <Button size="sm" variant="outline" className="gap-1">
                                Liquidación
                              </Button>
                            </Link>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                const w = window.open(
                                  `/dashboard/documentos/recibo/${targetId}`,
                                  '_blank',
                                  'noopener,noreferrer',
                                )
                                if (w) {
                                  const run = () => {
                                    try { if (typeof w.print === 'function') w.print() } catch {}
                                  }
                                  w.addEventListener('load', run, { once: true })
                                  setTimeout(run, 1800)
                                }
                              }
                            }}
                          >
                            <Printer className="h-3.5 w-3.5" /> Imprimir
                          </Button>
                          <Link
                            href={`/dashboard/documentos/recibo/${targetId}`}
                            className="inline-flex"
                          >
                            <Button size="sm" className="gap-1">
                              <Download className="h-3.5 w-3.5" /> PDF
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
