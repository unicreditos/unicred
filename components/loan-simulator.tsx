'use client'

import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { computeFrenchAmortization, formatARS, formatPercent } from '@/lib/finance'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const TERMS = [3, 6, 9, 12, 18, 24, 36, 48]

export function LoanSimulator({
  monthlyRate = 7.5,
  minAmount = 50000,
  maxAmount = 3000000,
  cta = true,
}: {
  monthlyRate?: number
  minAmount?: number
  maxAmount?: number
  cta?: boolean
}) {
  const [amount, setAmount] = useState(500000)
  const [term, setTerm] = useState(12)

  const result = useMemo(
    () => computeFrenchAmortization(amount, term, monthlyRate),
    [amount, term, monthlyRate],
  )

  return (
    <Card className="w-full max-w-md overflow-hidden p-0">
      <div className="bg-sidebar px-6 py-4">
        <p className="text-sm font-medium text-sidebar-foreground/70">Simulá tu crédito</p>
        <p className="mt-1 font-mono text-3xl font-bold text-sidebar-foreground">
          {formatARS(result.installmentAmount)}
          <span className="ml-1 text-base font-normal text-sidebar-foreground/60">/mes</span>
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Monto</Label>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatARS(amount)}
            </span>
          </div>
          <Slider
            value={[amount]}
            min={minAmount}
            max={maxAmount}
            step={10000}
            onValueChange={(v) => setAmount(Array.isArray(v) ? v[0] : v)}
            aria-label="Monto del crédito"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatARS(minAmount)}</span>
            <span>{formatARS(maxAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Cuotas</Label>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={`h-9 w-12 rounded-md border text-sm font-medium transition-colors ${
                  term === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/50'
                }`}
                aria-pressed={term === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <dl className="space-y-2 rounded-lg bg-muted p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total a devolver</dt>
            <dd className="font-mono font-semibold text-foreground">
              {formatARS(result.totalAmount)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">TNA</dt>
            <dd className="font-mono text-foreground">{formatPercent(result.tna)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">CFT (con IVA)</dt>
            <dd className="font-mono text-foreground">{formatPercent(result.cft)}</dd>
          </div>
        </dl>

        {cta && (
<Link href="/sign-up" className={buttonVariants({ className: 'w-full', size: 'lg' })}>Solicitar este crédito</Link>
        )}
      </div>
    </Card>
  )
}
