'use client'

import { approveLoan, rejectLoan, markLoanAsActive, markLoanAsPaid, updateLoanManual, ensureLoanExpediente } from '@/app/actions/admin'
import { issueIntimation } from '@/app/actions/documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { formatARS } from '@/lib/finance'
import { allowedAdminTransitions, LOAN_STATUS_LABELS, type LoanStatus } from '@/lib/loan-state'
import { cn } from '@/lib/utils'
import { Check, CheckCircle2, Clock, Edit3, FileText, Loader2, RotateCcw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type LoanRow = {
  id: string
  userId: string
  principal: string | number
  term: number
  status: string
  scoreAtApproval: number | null
  monthlyRate?: string | number | null
  rejectionReason?: string | null
  createdAt: Date | string
  contractId?: string | null
  contractStatus?: string | null
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendiente', variant: 'secondary' },
    approved: { label: 'Aprobado', variant: 'default' },
    active: { label: 'Activo', variant: 'default' },
    rejected: { label: 'Rechazado', variant: 'destructive' },
    paid: { label: 'Pagado', variant: 'outline' },
    cancelled: { label: 'Anulado', variant: 'outline' },
  }
  const cfg = map[status] ?? { label: LOAN_STATUS_LABELS[status as LoanStatus] ?? status, variant: 'outline' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function actionError(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : ''
  if (!msg || /Server Components render|Minified React error #441|digest/i.test(msg)) return fallback
  return msg
}

function shortId(id: string) {
  if (id.length > 12) return id.slice(0, 4) + '…' + id.slice(-4)
  return id
}

function formatDate(v: Date | string) {
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function scoreColor(s: number | null) {
  if (!s) return 'text-muted-foreground'
  if (s >= 720) return 'text-emerald-600'
  if (s >= 640) return 'text-emerald-600/80'
  if (s >= 560) return 'text-amber-600'
  return 'text-destructive'
}

export function LoansTable({ loans }: { loans: LoanRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [activeLoan, setActiveLoan] = useState<LoanRow | null>(null)

  const [rejectReason, setRejectReason] = useState(
    'Score crediticio insuficiente / capacidad de pago no demostrada',
  )
  const [approveForm, setApproveForm] = useState<{ score: string; principal: string; term: string; monthlyRate: string }>({
    score: '', principal: '', term: '', monthlyRate: '',
  })
  const [editForm, setEditForm] = useState<{
    principal: string; term: string; status: LoanRow['status']; monthlyRate: string; scoreAtApproval: string; rejectionReason: string
  }>({ principal: '', term: '', status: 'pending', monthlyRate: '', scoreAtApproval: '', rejectionReason: '' })

  const openApprove = (l: LoanRow) => {
    setActiveLoan(l)
    setApproveForm({
      score: String(l.scoreAtApproval ?? 650),
      principal: String(l.principal ?? ''),
      term: String(l.term ?? 12),
      monthlyRate: String(l.monthlyRate ?? ''),
    })
    setApproveOpen(true)
  }

  const openReject = (l: LoanRow) => {
    setActiveLoan(l)
    setRejectReason('Score crediticio insuficiente / capacidad de pago no demostrada')
    setRejectOpen(true)
  }

  const openEdit = (l: LoanRow) => {
    setActiveLoan(l)
    setEditForm({
      principal: String(l.principal ?? ''),
      term: String(l.term ?? ''),
      status: l.status,
      monthlyRate: String(l.monthlyRate ?? ''),
      scoreAtApproval: String(l.scoreAtApproval ?? ''),
      rejectionReason: l.rejectionReason ?? '',
    })
    setEditOpen(true)
  }

  const handleApprove = () => {
    if (!activeLoan) return
    const principal = approveForm.principal ? approveForm.principal.replace(/[^\d.,]/g, '').replace(',', '.') : ''
    const opts = {
      score: approveForm.score ? Number(approveForm.score) : undefined,
      principal: principal || undefined,
      term: approveForm.term ? Number(approveForm.term) : undefined,
      monthlyRate: approveForm.monthlyRate || undefined,
    }
    startTransition(async () => {
      try {
        const r = await approveLoan(activeLoan.id, opts)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Crédito aprobado · ID ${shortId(activeLoan.id)}`)
        setApproveOpen(false)
        setActiveLoan(null)
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'No se pudo aprobar el crédito'))
      }
    })
  }

  const handleReject = () => {
    if (!activeLoan) return
    if (!rejectReason.trim()) { toast.error('Ingresá el motivo del rechazo'); return }
    startTransition(async () => {
      try {
        const r = await rejectLoan(activeLoan.id, rejectReason)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Crédito rechazado · ${shortId(activeLoan.id)}`)
        setRejectOpen(false)
        setActiveLoan(null)
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'No se pudo rechazar el crédito'))
      }
    })
  }

  const handleEditSave = () => {
    if (!activeLoan) return
    const principal = editForm.principal ? editForm.principal.replace(/[^\d.,]/g, '').replace(',', '.') : ''
    const opts: any = {}
    if (principal) opts.principal = principal
    if (editForm.term) opts.term = Number(editForm.term)
    if (editForm.status && editForm.status !== activeLoan.status) opts.status = editForm.status
    if (editForm.monthlyRate) opts.monthlyRate = editForm.monthlyRate
    if (editForm.scoreAtApproval) opts.scoreAtApproval = Number(editForm.scoreAtApproval)
    if (editForm.rejectionReason !== undefined) opts.rejectionReason = editForm.rejectionReason

    startTransition(async () => {
      try {
        const r = await updateLoanManual(activeLoan.id, opts)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`Préstamo actualizado · ${shortId(activeLoan.id)}`)
        setEditOpen(false)
        setActiveLoan(null)
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'No se pudo actualizar el préstamo'))
      }
    })
  }

  const handleMarkActive = (l: LoanRow) => {
    if (!window.confirm(`¿Marcar el préstamo ${shortId(l.id)} como ACTIVO (desembolsado)?`)) return
    startTransition(async () => {
      try {
        const r = await markLoanAsActive(l.id)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success('Préstamo marcado como activo')
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'Acreditá el desembolso en Tesorería antes de activar'))
      }
    })
  }

  const handleIssueIntimation = (l: LoanRow) => {
    if (!l.contractId) return
    startTransition(async () => {
      try {
        const r = await issueIntimation(l.contractId as string)
        toast.success(`Intimación ${r.noticeNumber} emitida`)
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'No se pudo emitir la intimación'))
      }
    })
  }

  const handleEnsureExpediente = (l: LoanRow) => {
    startTransition(async () => {
      try {
        const r = await ensureLoanExpediente(l.id)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success('Expediente emitido. El cliente puede firmar.')
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'No se pudo emitir el expediente'))
      }
    })
  }

  const handleMarkPaid = (l: LoanRow) => {
    if (!window.confirm(`¿Marcar el préstamo ${shortId(l.id)} como PAGADO (cancelación total)?`)) return
    startTransition(async () => {
      try {
        const r = await markLoanAsPaid(l.id)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success('Préstamo marcado como pagado')
        router.refresh()
      } catch (err: unknown) {
        toast.error(actionError(err, 'No se pudo marcar como pagado'))
      }
    })
  }

  const renderActions = (l: LoanRow) => {
    if (l.status === 'pending') {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="default" disabled={isPending} className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openApprove(l)}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aprobar
          </Button>
          <Button size="sm" variant="destructive" disabled={isPending} className="gap-1" onClick={() => openReject(l)}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Rechazar
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} className="gap-1" onClick={() => openEdit(l)}>
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      )
    }
    if (l.status === 'approved') {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="default" disabled={isPending} className="gap-1 bg-sky-600 hover:bg-sky-700" onClick={() => handleMarkActive(l)}>
            <RotateCcw className="h-3.5 w-3.5" /> Activar / Desembolsar
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} className="gap-1" onClick={() => openEdit(l)}>
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      )
    }
    if (l.status === 'rejected') {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="default" disabled={isPending} className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openApprove(l)}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aprobar
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} className="gap-1 text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => openEdit(l)}>
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      )
    }
    if (l.status === 'active') {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="outline" disabled={isPending} className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => handleMarkPaid(l)}>
            <Check className="h-3.5 w-3.5" /> Marcar pagado
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} className="gap-1" onClick={() => openEdit(l)}>
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      )
    }
    if (l.status === 'paid') {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant="outline" className="gap-1 border-teal-300 text-teal-700 px-2 py-1 text-[11px] bg-teal-50">
            <Check className="h-3 w-3" /> Cancelado
          </Badge>
          <Button size="sm" variant="ghost" disabled={isPending} className="gap-1 h-7 text-[11px]" onClick={() => openEdit(l)}>
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>
      )
    }
    return (
      <Button size="sm" variant="outline" disabled={isPending} className="gap-1" onClick={() => openEdit(l)}>
        <Edit3 className="h-3.5 w-3.5" /> Editar
      </Button>
    )
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Cuotas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Expediente</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loans.length && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No hay créditos registrados.
                </TableCell>
              </TableRow>
            )}
            {loans.map((l) => (
              <TableRow key={l.id} className={cn(l.rejectionReason && l.status === 'rejected' ? 'bg-rose-50/30' : '')}>
                <TableCell className="font-mono text-xs">{shortId(l.id)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {shortId(l.userId)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatARS(l.principal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.term}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {statusBadge(l.status)}
                    {l.rejectionReason && (
                      <span className="text-[10px] text-rose-600 line-clamp-2 max-w-[200px]">
                        Motivo: {l.rejectionReason}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {l.contractId ? (
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={l.contractStatus === 'accepted' ? 'default' : 'outline'}
                        className={cn(
                          'w-fit text-[10px]',
                          l.contractStatus === 'accepted' && 'bg-emerald-600 hover:bg-emerald-600',
                          l.contractStatus === 'pending_acceptance' && 'border-amber-300 text-amber-700',
                        )}
                      >
                        {l.contractStatus === 'accepted' ? 'Firmado' : 'Pendiente firma'}
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/dashboard/documentos/contrato/${l.contractId}`} className="text-[10px] underline">
                          Contrato
                        </Link>
                        <Link href={`/dashboard/documentos/pagare/${l.contractId}`} className="text-[10px] underline">
                          Pagaré
                        </Link>
                        <Link href={`/dashboard/documentos/estado-deuda/${l.contractId}`} className="text-[10px] underline">
                          Deuda
                        </Link>
                        <Link href={`/dashboard/documentos/intimacion/${l.contractId}`} className="text-[10px] underline">
                          Intimación
                        </Link>
                        {l.status === 'active' && (
                          <button
                            type="button"
                            className="text-[10px] underline"
                            disabled={isPending}
                            onClick={() => handleIssueIntimation(l)}
                          >
                            Emitir
                          </button>
                        )}
                      </div>
                    </div>
                  ) : l.status === 'approved' || l.status === 'active' ? (
                    <Button size="sm" variant="outline" disabled={isPending} className="h-7 gap-1 text-[11px]" onClick={() => handleEnsureExpediente(l)}>
                      <FileText className="h-3 w-3" /> Emitir
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn('text-right font-medium tabular-nums', scoreColor(l.scoreAtApproval))}>
                  {l.scoreAtApproval ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(l.createdAt)}
                </TableCell>
                <TableCell className="text-right min-w-[220px]">
                  {renderActions(l)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG APROBAR */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Aprobar solicitud de crédito
            </DialogTitle>
            <DialogDescription>
              Confirmá monto, plazo, tasa y score. Si el crédito estaba rechazado, esta acción lo vuelve a calificar y emite el contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto aprobado (ARS)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={approveForm.principal}
                  onChange={(e) => setApproveForm({ ...approveForm, principal: e.target.value })}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Plazo (cuotas)</Label>
                <Input
                  type="number"
                  min={1}
                  max={96}
                  value={approveForm.term}
                  onChange={(e) => setApproveForm({ ...approveForm, term: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tasa mensual (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={approveForm.monthlyRate}
                  onChange={(e) => setApproveForm({ ...approveForm, monthlyRate: e.target.value })}
                  placeholder="10.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Score aprobación (0-1000)</Label>
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  value={approveForm.score}
                  onChange={(e) => setApproveForm({ ...approveForm, score: e.target.value })}
                />
              </div>
            </div>
            {activeLoan && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                <div><strong>Cliente:</strong> <span className="font-mono">{shortId(activeLoan.userId)}</span></div>
                <div><strong>ID Préstamo:</strong> <span className="font-mono">{activeLoan.id}</span></div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 gap-1"
              onClick={handleApprove}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar aprobación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG RECHAZAR */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <XCircle className="h-5 w-5" /> Rechazar solicitud de crédito
            </DialogTitle>
            <DialogDescription>
              El cliente recibirá el motivo por el cual fue rechazada su solicitud. Podrá volver a aplicar en el futuro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Motivo del rechazo (obligatorio)</Label>
              <Textarea
                rows={5}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej: Score BCRA inferior al mínimo requerido, relación cuota-ingreso mayor al 35%, antecedentes de cheques rechazados..."
              />
            </div>
            {activeLoan && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3 text-xs space-y-1">
                <div><strong>Cliente:</strong> <span className="font-mono">{shortId(activeLoan.userId)}</span></div>
                <div><strong>Monto solicitado:</strong> {formatARS(activeLoan.principal)} · {activeLoan.term} cuotas</div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="gap-1"
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDICIÓN MANUAL COMPLETA */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" /> Edición manual · Préstamo {activeLoan ? shortId(activeLoan.id) : ''}
            </DialogTitle>
            <DialogDescription>
              Solo aparecen los estados que la mesa puede aplicar. Para ponerlo vigente hay que acreditar el desembolso en Tesorería.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto principal (ARS)</Label>
                <Input value={editForm.principal} onChange={(e) => setEditForm({ ...editForm, principal: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Plazo (cuotas)</Label>
                <Input type="number" value={editForm.term} onChange={(e) => setEditForm({ ...editForm, term: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tasa mensual (%)</Label>
                <Input value={editForm.monthlyRate} onChange={(e) => setEditForm({ ...editForm, monthlyRate: e.target.value })} placeholder="10.50" />
              </div>
              <div className="space-y-1.5">
                <Label>Score crédito (0-1000)</Label>
                <Input type="number" value={editForm.scoreAtApproval} onChange={(e) => setEditForm({ ...editForm, scoreAtApproval: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Estado</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as LoanRow['status'] })}
                >
                  {(activeLoan ? allowedAdminTransitions(activeLoan.status) : [editForm.status]).map((status) => (
                    <option key={status} value={status}>
                      {LOAN_STATUS_LABELS[status as LoanStatus] ?? status}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Un rechazo se puede volver a calificar. El paso a vigente no está acá: va por Tesorería, con contrato firmado.
                </p>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Motivo rechazo (solo si estado = rejected)</Label>
                <Textarea rows={3} value={editForm.rejectionReason} onChange={(e) => setEditForm({ ...editForm, rejectionReason: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleEditSave} disabled={isPending} className="gap-1">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
