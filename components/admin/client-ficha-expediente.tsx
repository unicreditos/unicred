'use client'

import { attachDisbursementProof } from '@/app/actions/banking'
import { issueIntimation, refinanceLoan } from '@/app/actions/documents'
import type { ClientFicha, FichaDocRow } from '@/app/actions/admin-ficha'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatARS } from '@/lib/finance'
import { paymentMethodLabel } from '@/lib/document-format'
import { cn } from '@/lib/utils'
import { MAX_REFINANCES } from '@/lib/legal/mora'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw, ScrollText, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function shortId(id: string) {
  const clean = id.replace(/^loan_/, '')
  return clean.length > 12 ? `${clean.slice(0, 4)}…${clean.slice(-4)}` : clean
}

function Status({ status }: { status: FichaDocRow['status'] }) {
  if (status === 'disponible') return <span className="text-xs font-medium text-emerald-700">Disponible</span>
  if (status === 'pendiente') return <span className="text-xs font-medium text-amber-700">Pendiente</span>
  return <span className="text-xs text-muted-foreground">No corresponde</span>
}

function IssueIntimationButton({ contractId }: { contractId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void issueIntimation(contractId)
          .then((r) => {
            router.refresh()
            toast.success(`Intimación ${r.noticeNumber} emitida`)
          })
          .catch((err) => toast.error((err as Error).message))
          .finally(() => setBusy(false))
      }}
    >
      <ScrollText className="h-3.5 w-3.5" />
      Intimar
    </Button>
  )
}

function RefinanceButton({ loanId, used }: { loanId: string; used: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8"
      disabled={busy}
      onClick={() => {
        if (!window.confirm(`Refinanciar el saldo en cuotas iguales? Quedan ${MAX_REFINANCES - used} de ${MAX_REFINANCES}.`)) return
        setBusy(true)
        void refinanceLoan(loanId)
          .then((r) => {
            router.refresh()
            toast.success(`Refinanciación ${r.number}/${MAX_REFINANCES}`)
          })
          .catch((err) => toast.error((err as Error).message))
          .finally(() => setBusy(false))
      }}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Refinanciar ({used}/{MAX_REFINANCES})
    </Button>
  )
}

function ProofUpload({ disbursementId }: { disbursementId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(formData: FormData) {
    setBusy(true)
    setError(null)
    try {
      await attachDisbursementProof(disbursementId, formData)
      router.refresh()
    } catch (err) {
      setError((err as Error).message || 'No se pudo adjuntar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="proof"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        className="max-w-[200px] text-[11px]"
      />
      <input
        name="reference"
        placeholder="N° de transferencia"
        className="h-8 w-40 rounded-md border border-border px-2 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" className="h-8" disabled={busy}>
        <Upload className="h-3.5 w-3.5" />
        Adjuntar
      </Button>
      {error ? <span className="text-[11px] text-rose-700">{error}</span> : null}
    </form>
  )
}

export function ClientFichaExpediente({ ficha }: { ficha: ClientFicha }) {
  const byLoan = ficha.credits.map((credit) => ({
    credit,
    docs: ficha.expediente.filter((row) => row.loanId === credit.id),
  }))

  if (!ficha.credits.length) {
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Todavía no hay créditos ni expediente para esta persona.
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {byLoan.map(({ credit, docs }) => (
        <section key={credit.id} className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-brand-navy-900">Crédito {shortId(credit.id)}</h2>
              <p className="text-xs text-muted-foreground">
                {formatARS(credit.principal)} · {credit.term} cuotas · saldo {formatARS(credit.outstanding)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {credit.intimationEligible && credit.contractId ? (
                <IssueIntimationButton contractId={credit.contractId} />
              ) : null}
              {credit.refinanceEligible ? (
                <RefinanceButton loanId={credit.id} used={credit.refinanceCount} />
              ) : (
                <span className="text-[11px] text-muted-foreground" title={credit.refinanceReason}>
                  Refinanciaciones {credit.refinanceCount}/{MAX_REFINANCES}
                </span>
              )}
              {credit.disbursementId && credit.disbursementStatus === 'credited' && !credit.proofUrl ? (
                <ProofUpload disbursementId={credit.disbursementId} />
              ) : null}
            </div>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.key} className={doc.status === 'no_corresponde' ? 'opacity-50' : undefined}>
                    <TableCell>
                      <p className="text-sm font-medium">{doc.label}</p>
                      <p className="text-[11px] text-muted-foreground">{doc.hint}</p>
                    </TableCell>
                    <TableCell>
                      <Status status={doc.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {doc.amount != null ? formatARS(doc.amount) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(doc.date)}</TableCell>
                    <TableCell className="text-right">
                      {doc.href ? (
                        <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                          <Link href={doc.href} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-brand-navy-900">Pagos del cliente</h2>
          <p className="text-xs text-muted-foreground">Monto, crédito, fecha, medio y recibo emitido</p>
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Recibo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ficha.payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay pagos acreditados.
                  </TableCell>
                </TableRow>
              ) : (
                ficha.payments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{fmtDate(row.paidAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.loanId ? shortId(row.loanId) : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{formatARS(row.amount)}</TableCell>
                    <TableCell className="text-xs">{paymentMethodLabel(row.method)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{row.reference || '—'}</TableCell>
                    <TableCell>
                      {row.receiptId ? (
                        <Link
                          href={`/dashboard/documentos/recibo/${row.receiptId}`}
                          target="_blank"
                          className={cn('text-xs font-medium text-brand-primary hover:underline')}
                        >
                          {row.receiptNumber || 'Ver'}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{row.status}</span>
                      )}
                    </TableCell>
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
