'use client'

import { createEarlySettlementCheckout, quoteEarlySettlement } from '@/app/actions/payments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatARS } from '@/lib/finance'
import { Banknote, FileText, Loader2, Scale } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Quote = Awaited<ReturnType<typeof quoteEarlySettlement>>

export function EarlySettlementCard({ loanId, loanStatus }: { loanId: string; loanStatus: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Cotiza la cancelación anticipada apenas cambia el crédito; no hay valor derivable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    quoteEarlySettlement(loanId)
      .then((data) => {
        if (!cancelled) setQuote(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loanId])

  if (loanStatus === 'paid') {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm font-semibold">Crédito cancelado</p>
            <p className="text-sm text-muted-foreground">Ya podés descargar la constancia de libre deuda.</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard?tab=documentos&doc=libre-deuda&docId=${encodeURIComponent(loanId)}`}>Libre deuda</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loanStatus !== 'active') return null

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" />
          Cancelación anticipada
        </CardTitle>
        <CardDescription>
          Se cobra el capital remanente. Los intereses no devengados se deducen del saldo contractual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando liquidación…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : quote && quote.unpaidCount > 0 ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Saldo contractual
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold">{formatARS(quote.contractualRemaining)}</dd>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Intereses no devengados
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-emerald-700">
                  −{formatARS(quote.interestDeduction)}
                </dd>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  A pagar hoy
                </dt>
                <dd className="mt-1 font-mono text-base font-bold">{formatARS(quote.settlementAmount)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              {quote.unpaidCount === 1
                ? '1 cuota abierta. El recibo se emite cuando Mercado Pago confirma el cobro.'
                : `${quote.unpaidCount} cuotas abiertas. El recibo se emite cuando Mercado Pago confirma el cobro.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={paying || quote.settlementAmount <= 0}
                onClick={async () => {
                  setPaying(true)
                  setError(null)
                  try {
                    const checkout = await createEarlySettlementCheckout(loanId)
                    if (checkout.paymentLinkUrl) {
                      window.location.href = checkout.paymentLinkUrl
                      return
                    }
                    throw new Error('No se generó el checkout.')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'No se pudo iniciar la cancelación.')
                    setPaying(false)
                  }
                }}
                className="gap-1.5"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                Pagar cancelación
              </Button>
              <Button asChild variant="outline" size="default" className="gap-1.5">
                <Link href={`/dashboard?tab=documentos&doc=cancelacion&docId=${encodeURIComponent(loanId)}`}>
                  <FileText className="h-4 w-4" />
                  Ver liquidación
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No hay saldo de capital para cancelar.</p>
        )}
      </CardContent>
    </Card>
  )
}
