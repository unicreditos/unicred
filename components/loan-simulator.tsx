'use client'

import { AmortizationTable, AmountField } from '@/components/landing/sim-parts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { formatARS, formatPercent } from '@/lib/finance'
import { catalogByType } from '@/lib/loan-catalog'
import { clampAmount, parseAmountInput, SIM_AMOUNT_STEP, simulate, termOptionsFor } from '@/lib/simulator-core'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PERSONAL = catalogByType('personal')

export function LoanSimulator({
  monthlyRate = PERSONAL.monthlyRate,
  minAmount = PERSONAL.minAmount,
  maxAmount = PERSONAL.maxAmount,
  minTerm = PERSONAL.minTerm,
  maxTerm = PERSONAL.maxTerm,
  cta = true,
  variant = 'solid',
  className,
}: {
  monthlyRate?: number
  minAmount?: number
  maxAmount?: number
  minTerm?: number
  maxTerm?: number
  cta?: boolean
  /** `glass` deja ver el fondo (hero). `solid` es la tarjeta opaca de /simulador. */
  variant?: 'solid' | 'glass'
  className?: string
}) {
  const product = { minAmount, maxAmount, minTerm, maxTerm, monthlyRate }
  const terms = termOptionsFor(product)
  const [amount, setAmount] = useState(() => clampAmount(500_000, product))
  const [term, setTerm] = useState(() => (terms.includes(12) ? 12 : terms[terms.length - 1]))
  const glass = variant === 'glass'

  // Mismo calculo que el credito real (lib/finance.ts via simulator-core).
  const result = useMemo(() => simulate({ monthlyRate }, amount, term), [amount, term, monthlyRate])

  const body = (
    <>
      <div
        className={cn(
          'px-6 py-4',
          glass ? 'border-b border-white/25 bg-white/5' : 'uc-gradient-navy text-white',
        )}
      >
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-widest',
            glass ? 'text-brand-primary-800' : 'text-brand-cian-200',
          )}
        >
          Cuota fija estimada
        </p>
        <p
          className={cn(
            'mt-1 font-mono text-3xl font-black tracking-tight',
            glass && 'text-brand-navy',
          )}
        >
          {formatARS(result.installmentAmount)}
          <span
            className={cn(
              'ml-1 text-base font-normal',
              glass ? 'text-brand-navy/60' : 'text-white/70',
            )}
          >
            /mes
          </span>
        </p>
        <p className={cn('mt-1 text-[11px]', glass ? 'text-brand-navy/70' : 'text-slate-200/80')}>
          {formatARS(amount)} en {term} cuotas · sistema francés
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <AmountField
            value={amount}
            onCommit={setAmount}
            parse={(raw) => parseAmountInput(raw, product)}
            tone={glass ? 'glass' : 'light'}
            label="Monto a solicitar"
          />
          <Slider
            value={[amount]}
            min={minAmount}
            max={maxAmount}
            step={SIM_AMOUNT_STEP}
            onValueChange={(v) => setAmount(Array.isArray(v) ? v[0] : (v as number))}
            aria-label="Monto del crédito"
            className={glass ? '[&_[data-slot=slider-track]]:bg-white/55' : undefined}
          />
          <div
            className={cn(
              'flex justify-between text-xs',
              glass ? 'text-brand-navy/65' : 'text-muted-foreground',
            )}
          >
            <span>{formatARS(minAmount)}</span>
            <span>{formatARS(maxAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label className={glass ? 'text-brand-navy' : undefined}>Plazo en cuotas</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidad de cuotas">
            {terms.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={cn(
                  'h-11 min-w-12 rounded-md border px-2 text-sm font-medium transition-colors',
                  term === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : glass
                      ? 'border-white/50 bg-white/45 text-brand-navy hover:border-primary/50 hover:bg-white/70'
                      : 'border-border bg-background text-foreground hover:border-primary/50',
                )}
                aria-pressed={term === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <AmortizationTable rows={result.rows} tone={glass ? 'glass' : 'light'} />

        <dl
          className={cn(
            'space-y-2 rounded-lg p-4 text-sm',
            glass ? 'bg-white/40 ring-1 ring-white/50 backdrop-blur-sm' : 'bg-muted',
          )}
        >
          <div className="flex justify-between">
            <dt className={glass ? 'text-brand-navy/70' : 'text-muted-foreground'}>Total a devolver</dt>
            <dd className={cn('font-mono font-semibold', glass ? 'text-brand-navy' : 'text-foreground')}>
              {formatARS(result.totalAmount)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={glass ? 'text-brand-navy/70' : 'text-muted-foreground'}>Intereses (estimados)</dt>
            <dd className={cn('font-mono', glass ? 'text-brand-navy' : 'text-foreground')}>
              {formatARS(result.totalInterest)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={glass ? 'text-brand-navy/70' : 'text-muted-foreground'}>TNA</dt>
            <dd className={cn('font-mono font-semibold', glass ? 'text-brand-navy' : 'text-foreground')}>
              {formatPercent(result.tna)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={glass ? 'text-brand-navy/70' : 'text-muted-foreground'}>TEA</dt>
            <dd className={cn('font-mono font-semibold', glass ? 'text-brand-navy' : 'text-foreground')}>
              {formatPercent(result.tea)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={glass ? 'text-brand-navy/70' : 'text-muted-foreground'}>CFT est. (IVA sobre intereses)</dt>
            <dd className={cn('font-mono font-semibold', glass ? 'text-brand-navy' : 'text-foreground')}>
              {formatPercent(result.cft)}
            </dd>
          </div>
          <p className={cn('pt-1 text-[11px] leading-relaxed', glass ? 'text-brand-navy/65' : 'text-muted-foreground')}>
            CFT = TEA × 1,21. Sin seguros ni gastos de otorgamiento. Simulación informativa: no es oferta ni compromiso. La oferta final depende de tu evaluación.
          </p>
        </dl>

        {cta && (
          <Button asChild className="w-full font-semibold" size="lg">
            <Link href="/sign-up">Solicitar este crédito</Link>
          </Button>
        )}
      </div>
    </>
  )

  if (glass) {
    return (
      <div
        className={cn(
          'w-full overflow-hidden rounded-xl border border-white/40 bg-white/15 text-sm text-brand-navy shadow-lg shadow-brand-navy/10 backdrop-blur-2xl',
          className,
        )}
      >
        {body}
      </div>
    )
  }

  return <Card className={cn('w-full overflow-hidden p-0', className)}>{body}</Card>
}
