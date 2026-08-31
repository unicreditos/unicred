'use client'

import { approveLoan, deleteLoanAdmin, markLoanAsActive, rejectLoan } from '@/app/actions/admin'
import type { AdminLoanCase } from '@/app/actions/admin-cases'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
import { adminClientHref, adminMerchantHref, adminPaymentHref, adminUrl } from '@/lib/admin-nav'
import { formatARS } from '@/lib/finance'
import {
  disbursementStatusLabel,
  installmentStatusLabel,
  kycStatusLabel,
  loanStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/labels'
import { cn } from '@/lib/utils'
import { ArrowLeft, CheckCircle2, Loader2, Trash2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function Field({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={cn('mt-1 truncate text-sm text-brand-navy-900', mono && 'font-mono')}>
        {value || value === 0 ? String(value) : '—'}
      </p>
    </div>
  )
}

export function AdminLoanCaseView({ data, mode }: { data: AdminLoanCase; mode: 'solicitud' | 'credito' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { loan, customer, totals } = data
  const backHref = mode === 'solicitud' ? adminUrl('solicitudes') : adminUrl('creditos')

  async function approve() {
    setBusy(true)
    try {
      const r = await approveLoan(loan.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Crédito calificado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo aprobar')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    const reason = window.prompt('Motivo del rechazo (lo ve el cliente):', 'Score o capacidad de pago insuficiente')
    if (!reason?.trim()) return
    setBusy(true)
    try {
      const r = await rejectLoan(loan.id, reason.trim())
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Crédito rechazado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo rechazar')
    } finally {
      setBusy(false)
    }
  }

  async function activate() {
    if (!window.confirm('¿Acreditar el desembolso y dejar el crédito vigente?')) return
    setBusy(true)
    try {
      const r = await markLoanAsActive(loan.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Desembolso acreditado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desembolsar')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('¿Borrar este crédito? Solo se elimina si está pendiente, rechazado o anulado.')) return
    setBusy(true)
    try {
      const r = await deleteLoanAdmin(loan.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Crédito eliminado')
      router.push(backHref)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2 text-slate-600">
          <Link href={backHref}>
            <ArrowLeft /> {mode === 'solicitud' ? 'Solicitudes' : 'Créditos'}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {loan.status === 'pending' || loan.status === 'rejected' ? (
            <>
              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => void approve()}>
                {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Aprobar
              </Button>
              {loan.status === 'pending' ? (
                <Button size="sm" variant="destructive" className="h-8" disabled={busy} onClick={() => void reject()}>
                  <XCircle /> Rechazar
                </Button>
              ) : null}
            </>
          ) : null}
          {loan.status === 'approved' ? (
            <Button size="sm" className="h-8" disabled={busy} onClick={() => void activate()}>
              {busy ? <Loader2 className="animate-spin" /> : null} Acreditar desembolso
            </Button>
          ) : null}
          {loan.status === 'pending' || loan.status === 'rejected' || loan.status === 'cancelled' ? (
            <Button size="sm" variant="ghost" className="h-8 text-destructive" disabled={busy} onClick={() => void remove()}>
              <Trash2 /> Eliminar
            </Button>
          ) : null}
        </div>
      </div>

      {loan.status === 'rejected' ? (
        <DecisionBanner tone="critical" title="Solicitud rechazada" detail={loan.rejectionReason || 'Sin motivo cargado.'} />
      ) : totals.overdueCount > 0 ? (
        <DecisionBanner tone="warn" title="Hay cuotas vencidas" detail={`${totals.overdueCount} cuota(s) en mora. Punitorios contractuales: 0%.`} />
      ) : loan.status === 'active' ? (
        <DecisionBanner tone="ok" title="Crédito vigente" detail="El calendario de cuotas está activo." />
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Estado" value={loanStatusLabel(loan.status)} />
          <Field label="Titular" value={customer.name} />
          <Field label="Producto" value={data.product?.name ?? loan.type} />
          <Field label="Score al calificar" value={loan.scoreAtApproval} mono />
          <Field label="CUIL" value={customer.cuil} mono />
          <Field label="Identidad" value={kycStatusLabel(customer.kycStatus)} />
          <Field label="Localidad" value={[customer.city, customer.province].filter(Boolean).join(', ')} />
          <Field label="Correo" value={customer.email} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 text-xs">
          <Link href={adminClientHref(customer.id)} className="text-brand-primary hover:underline">
            Ficha del titular
          </Link>
          {data.merchant ? (
            <Link href={adminMerchantHref(data.merchant.id)} className="text-brand-primary hover:underline">
              Comercio {data.merchant.businessName}
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Capital" value={formatARS(loan.principal)} hint={`${loan.term} cuotas`} />
        <MetricTile label="Cuota" value={formatARS(loan.installmentAmount)} hint="Sistema francés" />
        <MetricTile label="Saldo" value={formatARS(totals.outstanding)} hint={`${totals.pendingCount + totals.overdueCount} abiertas`} />
        <MetricTile
          label="TNA / TEA / CFT"
          value={`${fmtPct(loan.tna)} · ${fmtPct(loan.tea)} · ${fmtPct(loan.cft)}`}
          hint="CFT = TEA con IVA 21% sobre intereses"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="rounded-lg border border-slate-200 bg-white lg:col-span-7">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Calendario de cuotas</h3>
            <p className="text-xs text-slate-500">Punitorios 0% · mora solo cambia el estado de la cuota</p>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pagada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.installments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      El plan se genera al calificar el crédito.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.installments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums">{row.number}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatARS(row.amount)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(row.dueDate)}</TableCell>
                      <TableCell>{installmentStatusLabel(row.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(row.paidAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white lg:col-span-5">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Línea de tiempo</h3>
          </header>
          <ol className="space-y-3 px-4 py-4">
            {data.timeline.map((event, i) => (
              <li key={`${event.at}-${i}`} className="flex gap-3">
                <span
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    event.tone === 'ok' && 'bg-emerald-500',
                    event.tone === 'warn' && 'bg-amber-500',
                    event.tone === 'critical' && 'bg-rose-500',
                    event.tone === 'default' && 'bg-slate-300',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-slate-500">{event.detail}</p>
                  <p className="text-[11px] text-slate-400">{fmtDate(event.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Contrato y desembolso</h3>
          </header>
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
            <Field label="Contrato" value={data.contract ? (data.contract.status === 'accepted' ? 'Firmado' : 'Pendiente de firma') : 'Sin emitir'} />
            <Field label="Firmante" value={data.contract?.signerName} />
            <Field label="Desembolso" value={data.disbursement ? disbursementStatusLabel(data.disbursement.status) : 'Sin cola'} />
            <Field label="Comprobante" value={data.disbursement?.receiptNumber} mono />
          </div>
          {data.contract ? (
            <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-xs">
              <Link href={`/dashboard/documentos/contrato/${data.contract.id}`} className="underline">
                Contrato
              </Link>
              <Link href={`/dashboard/documentos/pagare/${data.contract.id}`} className="underline">
                Pagaré
              </Link>
              <Link href={`/dashboard/documentos/estado-deuda/${data.contract.id}`} className="underline">
                Estado de deuda
              </Link>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Pagos de este crédito</h3>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Sin pagos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{fmtDate(p.paidAt || p.createdAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatARS(p.amount)}</TableCell>
                      <TableCell className="text-xs">{paymentMethodLabel(p.method)}</TableCell>
                      <TableCell>
                        <Link href={adminPaymentHref(p.id)} className="hover:underline">
                          {paymentStatusLabel(p.status)}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {data.audit.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold">Intervenciones</h3>
          </header>
          <ul className="divide-y">
            {data.audit.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
                <span>{item.summary}</span>
                <span className="text-xs text-slate-500">
                  {item.actorEmail} · {fmtDate(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
