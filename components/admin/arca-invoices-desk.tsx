'use client'

import { getArcaInvoices, emitArcaInvoiceAdmin } from '@/app/actions/arca-invoices'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { formatARSDecimal } from '@/lib/finance'
import { useEffect, useState, useTransition } from 'react'

type Invoice = Awaited<ReturnType<typeof getArcaInvoices>>[number]

const STATUS_LABEL: Record<string, string> = {
  queued: 'En cola',
  failed: 'Falló',
  authorized: 'Autorizada',
  pending_cae: 'En cola',
}

const STATUS_CLASS: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
  authorized: 'bg-emerald-500/10 text-emerald-700',
  pending_cae: 'bg-muted text-muted-foreground',
}

export function ArcaInvoicesDesk() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [pending, start] = useTransition()

  function load() {
    start(async () => {
      setRows(await getArcaInvoices())
    })
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <SectionCard
      title="Factura electrónica ARCA"
      description="IVA 21% sobre intereses de cada cuota cobrada. El cálculo se pone en cola solo; emitir contra ARCA es manual."
      bodyClassName=""
      action={
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={load}>
          Actualizar
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">CAE</th>
              <th className="px-4 py-2 text-right">Neto</th>
              <th className="px-4 py-2 text-right">IVA</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2">Error</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Todavía no hay facturas de intereses en cola ni autorizadas.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[row.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.cae ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatARSDecimal(row.impNeto)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatARSDecimal(row.impIva)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatARSDecimal(row.impTotal)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.arcaError ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.status !== 'authorized' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await emitArcaInvoiceAdmin(row.id)
                            setRows(await getArcaInvoices())
                          })
                        }
                      >
                        {row.status === 'failed' ? 'Reintentar' : 'Emitir'}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
