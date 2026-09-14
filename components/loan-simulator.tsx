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
  variant = 'solid',
  className,
}: {
  monthlyRate?: number
  minAmount?: number
  maxAmount?: number
  cta?: boolean
  /** `glass` deja ver el fondo (hero). `solid` es la tarjeta opaca de /simulador. */
  variant?: 'solid' | 'glass'
  className?: string
}) {
  const [amount, setAmount] = useState(500000)
  const [term, setTerm] = useState(12)
  const glass = variant === 'glass'

  const result = useMemo(
    () => computeFrenchAmortization(amount, term, monthlyRate),
    [amount, term, monthlyRate],
  )

  return (
    <Card
      className={cn(
        'w-full overflow-hidden p-0',
        glass &&
          'border-white/40 bg-white/80 text-brand-navy shadow-lg shadow-brand-navy/10 ring-1 ring-white/50 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/20',
        className,
      )}
    >
      <div
        className={cn(
          'px-6 py-4',
          glass ? 'border-b border-white/30 bg-white/10' : 'uc-gradient-navy text-white',
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
          <div className="flex items-center justify-between">
            <Label className={glass ? 'text-brand-navy' : undefined}>Monto a solicitar</Label>
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                glass
                  ? 'rounded-md bg-white/70 px-2 py-0.5 text-brand-navy'
                  : 'text-foreground',
              )}
            >
              {formatARS(amount)}
            </span>
          </div>
          <Slider
            value={[amount]}
            min={minAmount}
            max={maxAmount}
            step={10000}
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
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={cn(
                  'h-9 min-w-12 rounded-md border px-2 text-sm font-medium transition-colors',
                  term === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : glass
                      ? 'border-white/40 bg-white/30 text-brand-navy hover:border-primary/50 hover:bg-white/55'
                      : 'border-border bg-background text-foreground hover:border-primary/50',
                )}
                aria-pressed={term === t}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <dl
          className={cn(
            'space-y-2 rounded-lg p-4 text-sm',
            glass ? 'bg-white/25 ring-1 ring-white/35 backdrop-blur-sm' : 'bg-muted',
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
            CFT = TEA × 1,21. Sin seguros ni gastos de otorgamiento. Simulación informativa: no es oferta.
          </p>
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
