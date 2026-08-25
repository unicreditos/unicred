'use client'

import { getLoanInstallments, withdrawLoanAcceptance } from '@/app/actions/loans'
import { PayInstallmentButton } from '@/components/payments/pay-installment-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { barcodeSvg, couponCode, installmentPayUrl } from '@/lib/coupon'
import { formatARS, formatPercent } from '@/lib/finance'
import QRCode from 'qrcode'
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
  Wallet,
  XCircle,
  ChevronRight,
  AlertCircle,
  Receipt,
  ShieldAlert,
  FileSearch,
} from 'lucide-react'

type Loan = typeof loan.$inferSelect
type Installment = typeof installment.$inferSelect

const LOAN_STATUS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; tone: string }
> = {
  pending: {
    label: 'En evaluación',
    variant: 'secondary',
    tone: 'bg-muted/60 text-muted-foreground',
  },
  approved: {
    label: 'Aprobado',
    variant: 'default',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  rejected: {
    label: 'Rechazado',
    variant: 'destructive',
    tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
  active: {
    label: 'Activo',
    variant: 'default',
    tone: 'bg-primary/10 text-primary',
  },
  paid: {
    label: 'Cancelado',
    variant: 'outline',
    tone: 'bg-accent text-accent-foreground',
  },
  cancelled: {
    label: 'Arrepentido',
    variant: 'outline',
    tone: 'bg-muted text-muted-foreground',
  },
}

const INSTALLMENT_STATUS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'Pendiente',
    variant: 'secondary',
    icon: Clock3,
  },
  paid: {
    label: 'Pagada',
    variant: 'default',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Anulada',
    variant: 'outline',
    icon: XCircle,
  },
  overdue: {
    label: 'Vencida',
    variant: 'destructive',
    icon: XCircle,
  },
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isOverdue(dueDate: Date | string, status: string) {
  if (status !== 'pending') return false
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

export function LoansDashboard({ loans }: { loans: Loan[] }) {
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

  const selectedLoan = loans.find((l) => l.id === selectedLoanId)
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

  const totals = useMemo(() => computeLoanStats(loans), [loans])

  if (!selectedLoan) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total solicitudes"
            value={String(loans.length)}
            icon={CreditCard}
            tone="bg-primary/10 text-primary"
          />
          <StatCard
            label="Activos"
            value={String(totals.active)}
            icon={Wallet}
            tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          />
          <StatCard
            label="Saldo pendiente"
            value={formatARS(totals.pendingAmount)}
            icon={Receipt}
            tone="bg-amber-500/10 text-amber-700 dark:text-amber-400"
            mono
          />
          <StatCard
            label="Rechazados"
            value={String(totals.rejected)}
            icon={XCircle}
            tone="bg-rose-500/10 text-rose-700 dark:text-rose-400"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LayoutDashboardLocalIcon />
              </div>
              <div>
                <CardTitle>Mis préstamos y solicitudes</CardTitle>
                <CardDescription>
                  Historial de solicitudes. Solo los créditos activos generan cuotas y deuda.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loans.length === 0 ? (
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
                {loans.map((l) => {
                  const s = LOAN_STATUS[l.status] ?? LOAN_STATUS.pending
                  const rejected = isTerminalRejected(l.status)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLoanId(l.id)}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.tone}`}
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
                          <Badge variant={s.variant}>{s.label}</Badge>
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
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusCfg = LOAN_STATUS[selectedLoan.status] ?? LOAN_STATUS.pending
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
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
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
        <Card className="border-rose-200/80 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
          <CardContent className="flex gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                En este momento no podemos aprobar tu solicitud
              </p>
              <p className="text-sm text-rose-700/90 dark:text-rose-300/90">
                {selectedLoan.rejectionReason?.trim() ||
                  'La evaluación no llegó al umbral de aprobación. No se acreditó dinero ni se generó plan de pagos.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Podés volver a solicitar cuando tu perfil, tus ingresos o tu situación en BCRA hayan cambiado. Los montos de abajo son solo referenciales.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pendingReview ? (
        <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="flex gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Solicitud en evaluación
              </p>
              <p className="text-sm text-muted-foreground">
                Todavía no hay desembolso ni cuotas. Te avisamos cuando se resuelva.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {withdrawn ? (
        <Card className="border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40">
          <CardContent className="flex gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <XCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">Crédito anulado por arrepentimiento</p>
              <p className="text-sm text-muted-foreground">
                {selectedLoan.rejectionReason?.trim() ||
                  'Ejerciste el derecho de arrepentimiento. No hay deuda ni desembolso.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canTryWithdraw ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">Derecho de arrepentimiento</p>
              <p className="text-sm text-muted-foreground">
                Si ya aceptaste el contrato y el dinero todavía no se acreditó, podés anularlo
                dentro de los 10 días corridos (Ley 24.240 art. 34).
              </p>
              {withdrawError ? (
                <p className="text-sm text-destructive">{withdrawError}</p>
              ) : null}
            </div>
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
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={funded ? 'Monto acreditado' : 'Monto solicitado'}
          value={formatARS(selectedLoan.principal)}
          icon={Wallet}
          tone={rejected ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}
          mono
        />
        <StatCard
          label={funded ? 'Cuota mensual' : 'Cuota estimada'}
          value={formatARS(selectedLoan.installmentAmount)}
          icon={CreditCard}
          tone={rejected ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}
          mono
        />
        <StatCard
          label={funded ? 'Total a devolver' : 'Total estimado'}
          value={formatARS(selectedLoan.totalAmount)}
          icon={Receipt}
          tone={rejected ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}
          mono
        />
        <StatCard
          label="TNA · CFT"
          value={`${formatPercent(selectedLoan.tna)}`}
          icon={CalendarClock}
          tone={rejected ? 'bg-muted text-muted-foreground' : 'bg-sky-500/10 text-sky-700 dark:text-sky-400'}
          mono
          sub={selectedLoan.cft ? `CFT ${formatPercent(selectedLoan.cft)}` : undefined}
        />
      </div>

      {funded ? (
        <>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Plan de pagos</CardTitle>
                <CardDescription>
                  {paidCount} pagada{paidCount === 1 ? '' : 's'} · {pendingCount} pendiente
                  {pendingCount === 1 ? '' : 's'}
                  {overdueCount > 0 && (
                    <>
                      {' '}
                      ·{' '}
                      <span className="text-rose-600 dark:text-rose-400">
                        {overdueCount} vencida{overdueCount === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Progreso</p>
                <p className="font-mono text-sm font-semibold">
                  {installments.length > 0 ? `${paidCount} / ${installments.length}` : '—'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      const statusKey = overdue ? 'overdue' : inst.status
                      const cfg = INSTALLMENT_STATUS[statusKey] ?? INSTALLMENT_STATUS.pending
                      const StatusIcon = cfg.icon
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
                            <Badge variant={cfg.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {overdue && inst.status !== 'paid' && inst.status !== 'cancelled'
                                ? 'Vencida'
                                : cfg.label}
                            </Badge>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Talonario / cuponera</CardTitle>
                <CardDescription>
                  Cada talón muestra vencimiento, estado, fecha de pago y QR Mercado Pago si la cuota está abierta.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/documentos/cuponera/${selectedLoan.id}`}>Imprimir cuponera</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {installments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay talones para este crédito.</p>
            ) : (
              <LoanCouponBook loanId={selectedLoan.id} installments={installments} />
            )}
          </CardContent>
        </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan de pagos</CardTitle>
            <CardDescription>
              {rejected
                ? 'No se generó plan de pagos porque la solicitud fue rechazada.'
                : 'El plan de pagos se genera solo si la solicitud se aprueba.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  mono,
  sub,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
  mono?: boolean
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`mt-1 text-base font-semibold text-foreground ${mono ? 'font-mono' : ''}`}
            >
              {value}
            </p>
            {sub && (
              <p className="mt-0.5 text-xs text-muted-foreground font-mono">{sub}</p>
            )}
          </div>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
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

function LayoutDashboardLocalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}

function LoanCouponBook({
  loanId,
  installments,
}: {
  loanId: string
  installments: Installment[]
}) {
  const [qrs, setQrs] = useState<Record<string, string>>({})

  useEffect(() => {
    const origin = window.location.origin
    let cancelled = false
    void Promise.all(
      installments
        .filter((row) => row.status !== 'paid' && row.status !== 'cancelled')
        .map(async (row) => {
          const url = installmentPayUrl(row.id, origin)
          const data = await QRCode.toDataURL(url, { margin: 1, width: 180 })
          return [row.id, data] as const
        }),
    ).then((pairs) => {
      if (cancelled) return
      setQrs(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [installments])

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {installments.map((row) => {
        const code = couponCode({
          loanId,
          number: row.number,
          dueDate: row.dueDate,
          amount: row.amount,
        })
        const open = row.status !== 'paid' && row.status !== 'cancelled'
        return (
          <div key={row.id} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Cuota {String(row.number).padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">
                  Vence {formatDate(row.dueDate)} · {formatARS(row.amount)}
                </p>
              </div>
              <Badge variant={row.status === 'paid' ? 'default' : row.status === 'cancelled' ? 'outline' : 'secondary'}>
                {row.status === 'paid' ? 'Pagada' : row.status === 'cancelled' ? 'Anulada' : 'Pendiente'}
              </Badge>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Fecha de pago:{' '}
              {row.paidAt
                ? formatDate(row.paidAt)
                : row.status === 'paid' || row.status === 'cancelled'
                  ? 'Sin registrar'
                  : '—'}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              {open && qrs[row.id] ? (
                <div className="flex flex-col items-center">
                  <img src={qrs[row.id]} alt={`QR Mercado Pago cuota ${row.number}`} className="h-28 w-28" />
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    QR Mercado Pago
                  </p>
                </div>
              ) : null}
              <div className="min-w-0 flex-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: barcodeSvg(code, { height: 36, module: 1.1 }) }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
