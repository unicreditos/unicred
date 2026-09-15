'use client'

import { createEarlySettlementCheckout, quoteEarlySettlement } from '@/app/actions/payments'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/components/unicred/dashboard-kit'
import { DecisionBanner, MetricTile } from '@/components/unicred/workspace-shell'
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
      <DecisionBanner
        tone="ok"
        title="Crédito cancelado"
        detail="Ya podés descargar la constancia de libre deuda."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard?tab=documentos_certificados&doc=libre-deuda&docId=${encodeURIComponent(loanId)}`}>Libre deuda</Link>
          </Button>
        }
      />
    )
  }

  if (loanStatus !== 'active') return null

  return (
    <SectionCard
      title="Cancelación anticipada"
      description="Se cobra el capital remanente. Los intereses no devengados se deducen del saldo contractual."
      icon={<Scale className="h-4 w-4" />}
    >
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando liquidación…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : quote && quote.unpaidCount > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Saldo contractual" value={formatARS(quote.contractualRemaining)} />
              <MetricTile
                label="Intereses no devengados"
                value={`−${formatARS(quote.interestDeduction)}`}
                tone="ok"
              />
              <MetricTile
                label="A pagar hoy"
                value={formatARS(quote.settlementAmount)}
                hint={
                  quote.unpaidCount === 1
                    ? '1 cuota abierta'
                    : `${quote.unpaidCount} cuotas abiertas`
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El recibo se emite cuando Mercado Pago confirma el cobro.
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
                <Link href={`/dashboard?tab=documentos_certificados&doc=cancelacion&docId=${encodeURIComponent(loanId)}`}>
                  <FileText className="h-4 w-4" />
                  Ver liquidación
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay saldo de capital para cancelar.</p>
        )}
    </SectionCard>
  )
}
