'use client'

import { listPendingBankTransfers, reviewBankTransfer } from '@/app/actions/payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatARS } from '@/lib/finance'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

type Row = Awaited<ReturnType<typeof listPendingBankTransfers>>[number]

export function TransferReviews() {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const data = await listPendingBankTransfers()
    setRows(data)
  }

  useEffect(() => {
    // Trae las transferencias pendientes apenas monta; no hay valor derivable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((err) => toast.error((err as Error).message))
  }, [])

  async function decide(id: string, action: 'approve' | 'reject', credited?: number) {
    setBusy(id)
    try {
      await reviewBankTransfer(id, action, credited)
      toast.success(action === 'approve' ? 'Transferencia acreditada' : 'Comprobante rechazado')
      await load()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!rows.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        No hay transferencias pendientes de verificar en Brubank.
      </section>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{row.customerName}</p>
              <p className="text-xs text-slate-500">{row.customerEmail}</p>
              <p className="mt-1 font-mono text-xs text-slate-600">{row.loanId}</p>
              <p className="text-xs text-slate-500">
                Informó {formatARS(row.declaredAmount)} · ref {row.reference || '—'} ·{' '}
                {row.transferDate || 'sin fecha'}
              </p>
              {row.coupons.length ? (
                <p className="mt-1 font-mono text-[11px] text-slate-500">{row.coupons.join(' · ')}</p>
              ) : null}
            </div>
            <p className="font-mono text-lg font-semibold">{formatARS(row.amount)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {row.proofUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={row.proofUrl} target="_blank" rel="noreferrer">
                  Ver comprobante
                </a>
              </Button>
            ) : null}
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const credited = Number(new FormData(event.currentTarget).get('credited'))
                void decide(row.id, 'approve', credited)
              }}
            >
              <Input
                name="credited"
                type="number"
                step="0.01"
                min="0"
                defaultValue={row.declaredAmount}
                className="h-8 w-36"
                disabled={busy === row.id}
              />
              <Button type="submit" size="sm" disabled={busy === row.id}>
                Acreditar
              </Button>
            </form>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy === row.id}
              onClick={() => void decide(row.id, 'reject')}
            >
              Rechazar
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}
