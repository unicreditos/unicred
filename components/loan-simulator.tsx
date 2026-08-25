'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { computeFrenchAmortization, formatARS, formatPercent } from '@/lib/finance'
import { catalogByType } from '@/lib/loan-catalog'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const TERMS = [3, 6, 9, 12, 18, 24, 36, 48]

const PERSONAL = catalogByType('personal')

export function LoanSimulator({
  monthlyRate = PERSONAL.monthlyRate,
  minAmount = PERSONAL.minAmount,
  maxAmount = PERSONAL.maxAmount,
  cta = true,
  className,
}: {
  monthlyRate?: number
  minAmount?: number
  maxAmount?: number
  cta?: boolean
  className?: string
}) {
  const [amount, setAmount] = useState(500000)
  const [term, setTerm] = useState(12)

  const result = useMemo(
    () => computeFrenchAmortization(amount, term, monthlyRate),
    [amount, term, monthlyRate],
  )

  return (
    <Card className={cn('w-full overflow-hidden p-0', className)}>
      <div className="uc-gradient-navy px-6 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cian-200">Cuota fija estimada</p>
        <p className="mt-1 font-mono text-3xl font-black tracking-tight">
          {formatARS(result.installmentAmount)}
          <span className="ml-1 text-base font-normal text-white/70">/mes</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-200/80">
          {formatARS(amount)} en {term} cuotas · sistema francés
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Monto a solicitar</Label>
            <span className="font-mono text-sm font-semibold text-foreground">{formatARS(amount)}</span>
          </div>
          <Slider
            value={[amount]}
            min={minAmount}
            max={maxAmount}
            step={10000}
            onValueChange={(v) => setAmount(Array.isArray(v) ? v[0] : (v as number))}
            aria-label="Monto del crédito"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatARS(minAmount)}</span>
            <span>{formatARS(maxAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Plazo en cuotas</Label>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={`h-9 min-w-12 rounded-md border px-2 text-sm font-medium transition-colors ${
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
            <dd className="font-mono font-semibold text-foreground">{formatARS(result.totalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Intereses (estimados)</dt>
            <dd className="font-mono text-foreground">{formatARS(result.totalInterest)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">TNA</dt>
            <dd className="font-mono text-foreground">{formatPercent(result.tna)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">CFT (IVA incluido)</dt>
            <dd className="font-mono font-semibold text-foreground">{formatPercent(result.cft)}</dd>
          </div>
        </dl>

        {cta && (
          <Button asChild className="w-full font-semibold" size="lg">
            <Link href="/sign-up">Solicitar este crédito</Link>
          </Button>
        )}
      </div>
    </Card>
  )
}
