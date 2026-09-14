'use client'

import { getLoanInstallments, withdrawLoanAcceptance } from '@/app/actions/loans'
import { AmortizationTable } from '@/components/dashboard/amortization-table'
import { EarlySettlementCard } from '@/components/dashboard/early-settlement-card'
import { PayInstallmentButton } from '@/components/payments/pay-installment-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionCard, StatusChip } from '@/components/unicred/dashboard-kit'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { formatARS, formatPercent } from '@/lib/finance'
import Link from 'next/link'
import { installment, loan } from '@/lib/db/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Inbox,
  Loader2,
  XCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'

type Loan = typeof loan.$inferSelect
type Installment = typeof installment.$inferSelect

function loanChipStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'en_evaluacion'
    case 'approved':
      return 'aprobado'
    case 'rejected':
      return 'rechazado'
    case 'active':
      return 'activo'
    case 'paid':
      return 'pagado'
    case 'cancelled':
      return 'arrepentido'
    default:
      return status
  }
}

function loanRowTone(status: string) {
  if (status === 'rejected') return 'bg-rose-500/10 text-rose-700'
  if (status === 'paid') return 'bg-emerald-500/10 text-emerald-700'
  if (status === 'pending') return 'bg-amber-500/10 text-amber-800'
  return 'bg-muted text-muted-foreground'
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function isOverdue(dueDate: Date | string, status: string) {
  if (status === 'paid' || status === 'cancelled') return false
  if (status === 'overdue') return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

function isFundedLoan(status: string) {
  return status === 'active' || status === 'paid' || status === 'cancelled'
}

function isTerminalRejected(status: string) {
  return status === 'rejected'
}

function isWithdrawn(status: string) {
  return status === 'cancelled'
}

export type LoansDashboardView = 'all' | 'vigentes' | 'historial'

function filterLoans(loans: Loan[], view: LoansDashboardView) {
  if (view === 'vigentes') {
    return loans.filter((l) => l.status === 'pending' || l.status === 'approved' || l.status === 'active')
  }
  if (view === 'historial') {
    return loans.filter((l) => l.status === 'paid' || l.status === 'rejected' || l.status === 'cancelled')
  }
  return loans
}

export function LoansDashboard({
  loans,
  view = 'all',
}: {
  loans: Loan[]
  view?: LoansDashboardView
}) {
  const listed = useMemo(() => filterLoans(loans, view), [loans, view])
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loadingInstallments, setLoadingInstallments] = useState(false)
  const [installmentError, setInstallmentError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const loadInstallments = useCallback(async (loanId: string) => {
    try {
      const data = await getLoanInstallments(loanId)
      setInstallments(data)
    } catch (err) {
      setInstallmentError((err as Error).message)
    } finally {
      setLoadingInstallments(false)
    }
  }, [])

  const selectedLoan = listed.find((l) => l.id === selectedLoanId)
  const shouldLoad = Boolean(selectedLoanId && selectedLoan && isFundedLoan(selectedLoan.status))

  // El cronograma corresponde a un crédito puntual: al cambiar la selección se
  // descarta acá mismo, así la pantalla nunca muestra las cuotas del anterior.
  const [shownLoanId, setShownLoanId] = useState<string | null>(null)
  if (shownLoanId !== selectedLoanId) {
    setShownLoanId(selectedLoanId)
    setInstallments([])
    setInstallmentError(null)
    setLoadingInstallments(shouldLoad)
  }

  useEffect(() => {
    if (!shouldLoad || !selectedLoanId) return
    // loadInstallments es asincrónica: el estado se escribe recién cuando el
    // servidor responde, no durante el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInstallments(selectedLoanId)
  }, [shouldLoad, selectedLoanId, loadInstallments])

  const totals = useMemo(() => computeLoanStats(listed), [listed])

  const overdueInstallments = useMemo(() => {
    // "Días de mora" es relativo al momento de la consulta; no hay forma pura de expresarlo.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return installments
      .filter(
        (inst) =>
          (inst.status !== 'paid' && inst.status !== 'cancelled' && isOverdue(inst.dueDate, inst.status)) ||
          (inst.paidAt && new Date(inst.paidAt) > new Date(inst.dueDate)),
      )
      .map((inst) => {
        const due = new Date(inst.dueDate)
        const paid = inst.paidAt ? new Date(inst.paidAt) : null
        const days = paid
          ? Math.max(0, Math.ceil((paid.getTime() - due.getTime()) / 86400000))
          : Math.max(0, Math.ceil((now - due.getTime()) / 86400000))
        return { ...inst, paid: Boolean(paid), days }
      })
  }, [installments])

  if (!selectedLoan) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Total solicitudes" value={String(listed.length)} />
          <MetricTile label="Activos" value={String(totals.active)} tone={totals.active ? 'ok' : 'default'} />
          <MetricTile
            label="Saldo pendiente"
            value={formatARS(totals.pendingAmount)}
            tone={totals.pendingAmount ? 'warn' : 'default'}
          />
          <MetricTile
            label="Rechazados"
            value={String(totals.rejected)}
            tone={totals.rejected ? 'critical' : 'default'}
          />
        </div>

        <SectionCard
          title={view === 'historial' ? 'Historial de créditos' : view === 'vigentes' ? 'Créditos vigentes' : 'Mis préstamos y solicitudes'}
          description={
            view === 'historial'
              ? 'Créditos cancelados, rechazados o anulados.'
              : 'Solo los créditos activos generan cuotas y deuda. El cupón de Pago Fácil o Rapipago se emite al pagar.'
          }
        >
          {listed.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Todavía no tenés solicitudes
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Andá a &quot;Solicitar crédito&quot; para enviar tu primera solicitud.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {listed.map((l) => {
                const rejected = isTerminalRejected(l.status)
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLoanId(l.id)}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${loanRowTone(l.status)}`}
                    >
                      {rejected ? (
                        <XCircle className="h-5 w-5" />
                      ) : l.status === 'paid' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : l.status === 'pending' ? (
                        <Clock3 className="h-5 w-5" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {rejected || l.status === 'pending'
                            ? `Solicitud ${formatARS(l.principal)} · ${l.term} cuotas`
                            : `Préstamo ${formatARS(l.principal)} · ${l.term} cuotas`}
                        </p>
                        <StatusChip status={loanChipStatus(l.status)} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                        {rejected ? (
                          <>
                            <span>Sin desembolso</span>
                            {l.scoreAtApproval != null ? <span>Score: {l.scoreAtApproval}</span> : null}
                            <span>{formatDate(l.createdAt)}</span>
                          </>
                        ) : l.status === 'pending' ? (
                          <>
                            <span>En evaluación</span>
                            <span>Cuota estimada: {formatARS(l.installmentAmount)}</span>
                            <span>{formatDate(l.createdAt)}</span>
                          </>
                        ) : (
                          <>
                            <span>Cuota: {formatARS(l.installmentAmount)}</span>
                            <span>TNA: {formatPercent(l.tna)}</span>
                            <span>{formatDate(l.createdAt)}</span>
                          </>
                        )}
                      </div>
                      {rejected && l.rejectionReason ? (
                        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 line-clamp-2">
                          Motivo: {l.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    )
  }

  const rejected = isTerminalRejected(selectedLoan.status)
  const withdrawn = isWithdrawn(selectedLoan.status)
  const pendingReview = selectedLoan.status === 'pending'
  const funded = isFundedLoan(selectedLoan.status)
  const canTryWithdraw =
    !funded &&
    !rejected &&
    !withdrawn &&
    !pendingReview &&
    !selectedLoan.disbursedAt &&
    selectedLoan.status === 'approved'

  const paidCount = installments.filter((i) => i.status === 'paid').length
  const pendingCount = installments.filter((i) => i.status !== 'paid').length
  const overdueCount = installments.filter((i) => isOverdue(i.dueDate, i.status)).length

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedLoanId(null)
            setInstallments([])
          }}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a préstamos
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {rejected || pendingReview
                ? `Solicitud ${formatARS(selectedLoan.principal)} · ${selectedLoan.term} cuotas`
                : `Préstamo ${formatARS(selectedLoan.principal)} · ${selectedLoan.term} cuotas`}
            </h2>
            <StatusChip status={loanChipStatus(selectedLoan.status)} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono">
            Solicitado el {formatDate(selectedLoan.createdAt)}
            {selectedLoan.scoreAtApproval != null
              ? rejected
                ? ` · Score en evaluación: ${selectedLoan.scoreAtApproval}`
                : ` · Score en aprobación: ${selectedLoan.scoreAtApproval}`
              : null}
          </p>
        </div>
      </div>

      {rejected ? (
        <DecisionBanner
          tone="critical"
          title="En este momento no podemos aprobar tu solicitud"
          detail={
            selectedLoan.rejectionReason?.trim() ||
            'La evaluación no llegó al umbral de aprobación. No se acreditó dinero ni se generó plan de pagos.'
          }
        />
      ) : null}

      {pendingReview ? (
        <DecisionBanner
          tone="warn"
          title="Solicitud en evaluación"
          detail="Todavía no hay desembolso ni cuotas. Te avisamos cuando se resuelva."
        />
      ) : null}

      {withdrawn ? (
        <DecisionBanner
          tone="info"
          title="Crédito anulado por arrepentimiento"
          detail={
            selectedLoan.rejectionReason?.trim() ||
            'Ejerciste el derecho de arrepentimiento. No hay deuda ni desembolso.'
          }
        />
      ) : null}

      {canTryWithdraw ? (
        <DecisionBanner
          tone="info"
          title="Derecho de arrepentimiento"
          detail="Si ya aceptaste el contrato y el dinero todavía no se acreditó, podés anularlo dentro de los 10 días corridos (Ley 24.240 art. 34)."
          action={
            <div className="flex flex-col items-end gap-1">
              {withdrawError ? <p className="text-sm text-destructive">{withdrawError}</p> : null}
              <Button
                variant="outline"
                disabled={withdrawing}
                onClick={async () => {
                  if (
                    !window.confirm(
                      '¿Arrepentirte de este crédito? Solo vale si el contrato está aceptado y el dinero no se acreditó.',
                    )
                  ) {
                    return
                  }
                  setWithdrawing(true)
                  setWithdrawError(null)
                  const r = await withdrawLoanAcceptance(selectedLoan.id)
                  setWithdrawing(false)
                  if (!r.ok) {
                    setWithdrawError(r.error)
                    return
                  }
                  window.location.reload()
                }}
              >
                {withdrawing ? 'Registrando…' : 'Arrepentirme'}
              </Button>
            </div>
          }
        />
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label={funded ? 'Monto acreditado' : 'Monto solicitado'}
          value={formatARS(selectedLoan.principal)}
          tone={rejected ? 'default' : 'ok'}
        />
        <MetricTile
          label={funded ? 'Cuota mensual' : 'Cuota estimada'}
          value={formatARS(selectedLoan.installmentAmount)}
        />
        <MetricTile
          label={funded ? 'Total a devolver' : 'Total estimado'}
          value={formatARS(selectedLoan.totalAmount)}
        />
        <MetricTile
          label="TNA · CFT"
          value={formatPercent(selectedLoan.tna)}
          hint={selectedLoan.cft ? `CFT ${formatPercent(selectedLoan.cft)}` : undefined}
        />
      </div>

      <AmortizationTable
        principal={Number(selectedLoan.principal) || 0}
        monthlyRate={Number(selectedLoan.monthlyRate) || 0}
        term={selectedLoan.term}
        tna={selectedLoan.tna}
        cft={selectedLoan.cft}
      />

      {funded ? (
        <>
        {(selectedLoan.status === 'active' || selectedLoan.status === 'paid') ? (
          <EarlySettlementCard loanId={selectedLoan.id} loanStatus={selectedLoan.status} />
        ) : null}
        <SectionCard
          title="Plan de pagos"
          description={`${paidCount} pagada${paidCount === 1 ? '' : 's'} · ${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}${overdueCount > 0 ? ` · ${overdueCount} vencida${overdueCount === 1 ? '' : 's'}` : ''}`}
          action={
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progreso</p>
              <p className="font-mono text-sm font-semibold">
                {installments.length > 0 ? `${paidCount} / ${installments.length}` : '—'}
              </p>
            </div>
          }
        >
            {loadingInstallments ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando cuotas…
              </div>
            ) : installmentError ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {installmentError}
              </div>
            ) : installments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No hay cuotas generadas para este préstamo.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha de pago</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst) => {
                      const overdue = isOverdue(inst.dueDate, inst.status)
                      const chip =
                        inst.status === 'paid'
                          ? 'pagado'
                          : inst.status === 'cancelled'
                            ? 'anulada'
                            : overdue
                              ? 'vencido'
                              : 'pendiente'
                      return (
                        <TableRow
                          key={inst.id}
                          className={
                            inst.status === 'paid'
                              ? 'opacity-70'
                              : overdue
                                ? 'bg-rose-500/5'
                                : undefined
                          }
                        >
                          <TableCell>
                            <span className="font-mono text-sm font-medium">#{inst.number}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarClock
                                className={`h-4 w-4 ${
                                  overdue ? 'text-rose-500' : 'text-muted-foreground'
                                }`}
                              />
                              <span className="text-sm">{formatDate(inst.dueDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm font-semibold">
                              {formatARS(inst.amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={chip} />
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground">
                              {inst.paidAt
                                ? formatDate(inst.paidAt)
                                : inst.status === 'paid' || inst.status === 'cancelled'
                                  ? 'Sin registrar'
                                  : '—'}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {inst.status === 'paid' || inst.status === 'cancelled' ? (
                              <p className="text-xs text-muted-foreground">
                                {inst.status === 'cancelled' ? 'Anulada' : 'Saldada'}
                              </p>
                            ) : selectedLoan.status === 'active' ? (
                              <PayInstallmentButton
                                installment={{
                                  id: inst.id,
                                  number: inst.number,
                                  amount: inst.amount,
                                  dueDate: inst.dueDate,
                                  loanId: inst.loanId,
                                }}
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground">Disponible al acreditar</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
        </SectionCard>
        <SectionCard
          title="Talonario"
          description="Cronograma de este crédito. El cupón de Pago Fácil o Rapipago se emite cuando elegís ese medio en Pagar, porque tiene vencimiento."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard?tab=documentos_talonario&doc=talonario&docId=${encodeURIComponent(selectedLoan.id)}`}>
                Ver cronograma
              </Link>
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">Abrí el cronograma para ver cuotas y vencimientos de este crédito.</p>
        </SectionCard>
        {overdueInstallments.length > 0 ? (
          <SectionCard
            title="Historial de mora"
            description="Cuotas vencidas o pagadas después del vencimiento. UNICRÉDITOS no liquida punitorios de oficio."
          >
              <div className="space-y-2">
                {overdueInstallments.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>
                      Cuota #{inst.number} · vence {formatDate(inst.dueDate)}
                    </span>
                    <span className="font-mono text-xs text-rose-700">
                      {inst.paid
                        ? `Pagada con ${inst.days} día${inst.days === 1 ? '' : 's'} de atraso`
                        : `${inst.days} día${inst.days === 1 ? '' : 's'} de mora`}
                    </span>
                  </div>
                ))}
              </div>
          </SectionCard>
        ) : null}
        </>
      ) : (
        <SectionCard
          title="Plan de pagos"
          description={
            rejected
              ? 'No se generó plan de pagos porque la solicitud fue rechazada.'
              : 'El plan de pagos se genera solo si la solicitud se aprueba.'
          }
        >
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
              {rejected ? (
                <XCircle className="h-8 w-8 text-rose-500/80" />
              ) : (
                <Clock3 className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm font-medium text-foreground">
                {rejected ? 'Sin cuotas ni deuda' : 'Aún sin cuotas'}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {rejected
                  ? 'Esta solicitud no acreditó fondos. Podés iniciar una nueva solicitud cuando tu situación crediticia lo permita.'
                  : 'Cuando se apruebe, vas a ver acá el cronograma y podrás pagar cada cuota.'}
              </p>
            </div>
        </SectionCard>
      )}
    </div>
  )
}

function computeLoanStats(loans: Loan[]) {
  let active = 0
  let rejected = 0
  let pendingAmount = 0
  for (const l of loans) {
    if (l.status === 'active') {
      active += 1
      pendingAmount += Number(l.totalAmount)
    } else if (l.status === 'approved') {
      pendingAmount += Number(l.totalAmount)
    } else if (l.status === 'rejected') {
      rejected += 1
    }
  }
  return { active, rejected, pendingAmount }
}

