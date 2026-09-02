'use client'

/**
 * Mesa de Aprobaciones: el único lugar donde el operador acredita dinero.
 * Junta las tres colas que hoy estaban dispersas o sin enlazar:
 *  1) Transferencias a cuenta informadas por el cliente (transfer reviews).
 *  2) Desembolsos pendientes de acreditar al CBU/CVU del tomador.
 * Cada acción usa la server action robusta ya existente (idempotente + audit + notify).
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { markDisbursementAsCredited } from '@/app/actions/banking'
import { TransferReviews } from '@/components/admin/transfer-reviews'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricTile, OpsFloor } from '@/components/unicred/workspace-shell'
import { formatARS, formatCBU, formatCVU } from '@/lib/finance'
import { CheckCircle2, FileCheck2, Landmark, Receipt as ReceiptIcon } from 'lucide-react'

type DisbursementRow = {
  id: string
  loanId: string
  userId: string
  amount: string | number
  status: string
  receiptNumber: string | null
  referenceNumber: string | null
  createdAt: Date | string
  customer: { fullName: string | null; cuil: string | null; email: string | null } | null
  bankAccount: {
    bankName: string
    accountType: string
    cbu: string | null
    cvu: string | null
    alias: string | null
  } | null
  contract?: { id: string; loanId: string; status: string } | null
}

function fmtDate(v: Date | string | null | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DisbursementApprovals({ rows }: { rows: DisbursementRow[] }) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  const pending = useMemo(
    () => rows.filter((d) => d.status === 'pending' || d.status === 'processing'),
    [rows],
  )

  if (!pending.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No hay desembolsos pendientes de acreditar.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pending.map((d) => {
        const signed = d.contract?.status === 'accepted'
        const dest = d.bankAccount
        return (
          <article key={d.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {d.customer?.fullName ?? `Cliente #${d.userId.slice(0, 8)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.customer?.email ?? '—'}
                  {d.customer?.cuil ? ` · CUIL ${d.customer.cuil}` : ''}
                </p>
                {dest ? (
                  <p className="mt-1 font-mono text-[11px] text-slate-600">
                    <Landmark className="mr-1 inline h-3 w-3" />
                    {dest.bankName} · {dest.accountType.toUpperCase()}
                    {dest.cbu ? ` · ${formatCBU(dest.cbu)}` : ''}
                    {dest.cvu && !dest.cbu ? ` · ${formatCVU(dest.cvu)}` : ''}
                    {dest.alias ? ` · ${dest.alias.toUpperCase()}` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-amber-700">Sin CBU/CVU cargado por el cliente.</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">Solicitado {fmtDate(d.createdAt)}</p>
              </div>
              <p className="font-mono text-lg font-semibold tabular-nums">{formatARS(d.amount)}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="gap-1 bg-emerald-600 hover:bg-emerald-600"
                disabled={isPending || !signed || !dest}
                title={
                  !signed
                    ? 'El cliente debe firmar el contrato y el pagaré'
                    : !dest
                      ? 'Falta el CBU/CVU del cliente'
                      : 'Acreditar desembolso'
                }
                onClick={() =>
                  start(async () => {
                    try {
                      const r = await markDisbursementAsCredited(d.id)
                      toast.success(`Acreditado · comprobante ${(r as any)?.receiptNumber ?? 'emitido'}`)
                      router.refresh()
                    } catch (e: any) {
                      toast.error(e?.message ?? 'No se pudo acreditar')
                    }
                  })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Acreditar al CBU/CVU
              </Button>
              {d.contract?.id ? (
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link href={`/dashboard/documentos/contrato/${d.contract.id}`} target="_blank">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    {signed ? 'Expediente' : 'Pendiente de firma'}
                  </Link>
                </Button>
              ) : null}
              {d.receiptNumber ? (
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link href={`/dashboard/documentos/recibo/${d.id}`} target="_blank">
                    <ReceiptIcon className="h-3.5 w-3.5" /> Comprobante
                  </Link>
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function AdminApprovalsDesk({ disbursementList = [] }: { disbursementList?: DisbursementRow[] }) {
  const [view, setView] = useState<'transferencias' | 'desembolsos'>('transferencias')

  const pendingDisb = disbursementList.filter((d) => d.status === 'pending' || d.status === 'processing').length

  return (
    <OpsFloor>
      <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MetricTile
          label="Desembolsos por acreditar"
          value={String(pendingDisb)}
          tone={pendingDisb ? 'warn' : 'ok'}
          hint="Al CBU/CVU del tomador"
        />
        <MetricTile label="Transferencias a verificar" value="Brubank" hint="Informadas por el cliente" />
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-card p-1">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="w-full">
          <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
            <TabsTrigger
              value="transferencias"
              className="h-7 rounded-md text-xs data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              Transferencias a cuenta
            </TabsTrigger>
            <TabsTrigger
              value="desembolsos"
              className="h-7 rounded-md text-xs data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              Desembolsos {pendingDisb ? `(${pendingDisb})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-amber-950">Acreditar mueve el ledger, no el banco</p>
          <p className="text-[11px] text-amber-800">
            {view === 'transferencias'
              ? 'Verificá el comprobante contra el ingreso real en la cuenta antes de acreditar la cuota.'
              : 'Acreditá solo después de transferir desde tesorería al CBU/CVU del cliente.'}
          </p>
        </div>
        {view === 'transferencias' ? <TransferReviews /> : <DisbursementApprovals rows={disbursementList} />}
      </div>
    </OpsFloor>
  )
}
