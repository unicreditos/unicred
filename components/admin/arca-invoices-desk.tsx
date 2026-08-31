'use client'

import { getArcaInvoices, retryArcaInvoiceAdmin } from '@/app/actions/arca-invoices'
import { Button } from '@/components/ui/button'
import { formatARSDecimal } from '@/lib/finance'
import { useEffect, useState, useTransition } from 'react'

type Invoice = Awaited<ReturnType<typeof getArcaInvoices>>[number]

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
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy-900">Factura electrónica ARCA</h2>
          <p className="text-xs text-muted-foreground">
            IVA 21% sobre intereses de cada cuota cobrada. El recibo interno queda como anexo. Sin CAE,
            la fila queda en cola.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={load}>
          Actualizar
        </Button>
      </header>
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
                  <td className="px-4 py-3">{row.status}</td>
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
                            await retryArcaInvoiceAdmin(row.id)
                            setRows(await getArcaInvoices())
                          })
                        }
                      >
                        Reintentar CAE
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
