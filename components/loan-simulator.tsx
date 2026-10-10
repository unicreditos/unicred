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

function Cost({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn('uc-cost font-mono', className)}>{children}</span>
}

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

  const body = (
    <>
      <div
        className={cn(
          'px-6 py-4',
          glass ? 'border-b border-white/25 bg-white/10' : 'bg-brand-navy text-white',
        )}
      >
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-widest',
            glass ? 'text-brand-primary-800' : 'text-white/65',
          )}
        >
          Cuota fija estimada
        </p>
        <p
          className={cn(
            'mt-1 text-3xl font-bold tracking-tight',
            glass ? 'text-brand-navy' : 'text-white',
          )}
        >
          <Cost>{formatARS(result.installmentAmount)}</Cost>
          <span
            className={cn(
              'ml-1 text-base font-normal',
              glass ? 'text-brand-navy/60' : 'text-white/70',
            )}
          >
            /mes
          </span>
        </p>
        <p className={cn('mt-1 text-[11px]', glass ? 'text-brand-navy/75' : 'text-white/70')}>
          <Cost>{formatARS(amount)}</Cost> en {term} cuotas · sistema francés
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className={glass ? 'text-brand-navy' : undefined}>Monto a solicitar</Label>
            <Cost
              className={cn(
                'text-sm font-semibold',
                glass
                  ? 'rounded-md bg-white/80 px-2 py-0.5 text-brand-navy shadow-sm'
                  : 'text-foreground',
              )}
            >
              {formatARS(amount)}
            </Cost>
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
              glass ? 'text-brand-navy/70' : 'text-muted-foreground',
            )}
          >
            <Cost>{formatARS(minAmount)}</Cost>
            <Cost>{formatARS(maxAmount)}</Cost>
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
                  'h-9 min-w-12 rounded-md border px-2 text-sm font-medium tabular-nums transition-colors',
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

        <dl
          className={cn(
            'space-y-2 rounded-lg p-4 text-sm',
            glass ? 'bg-white/50 ring-1 ring-white/55 backdrop-blur-sm' : 'bg-muted',
          )}
        >
          {(
            [
              ['Total a devolver', formatARS(result.totalAmount), true],
              ['Intereses (estimados)', formatARS(result.totalInterest), false],
              ['TNA', formatPercent(result.tna), true],
              ['TEA', formatPercent(result.tea), true],
              ['CFT est. (IVA sobre intereses)', formatPercent(result.cft), true],
            ] as const
          ).map(([label, value, strong]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className={glass ? 'text-brand-navy/75' : 'text-muted-foreground'}>{label}</dt>
              <dd>
                <Cost
                  className={cn(
                    strong ? 'font-semibold' : 'font-medium',
                    glass ? 'text-brand-navy' : 'text-foreground',
                  )}
                >
                  {value}
                </Cost>
              </dd>
            </div>
          ))}
          <p className={cn('pt-1 text-[11px] leading-relaxed', glass ? 'text-brand-navy/70' : 'text-muted-foreground')}>
            CFT = TEA × 1,21. Sin seguros ni gastos de otorgamiento. Simulación informativa: no es oferta.
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
