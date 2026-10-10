'use client'

import { AmortizationTable, AmountField } from '@/components/landing/sim-parts'
import { Slider } from '@/components/ui/slider'
import { formatARS, formatPercent } from '@/lib/finance'
import { signupHref } from '@/lib/loan-intent'
import { catalogByType, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import { parseAmountInput, SIM_AMOUNT_STEP, simulate, termOptionsFor } from '@/lib/simulator-core'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PERSONAL = catalogByType('personal')
const TERMS = termOptionsFor(PERSONAL)

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'accent' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-brand-navy-500">{label}</dt>
      <dd
        className={cn(
          'font-mono tabular-nums',
          strong ? 'text-base font-bold text-brand-navy-800' : 'text-sm font-medium text-brand-navy-700',
          tone === 'accent' && 'text-lg font-bold text-brand-primary-700',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function LiveStatement({ className }: { className?: string }) {
  const [amount, setAmount] = useState(400_000)
  const [term, setTerm] = useState(12)

  // Mismo calculo que el credito real (lib/finance.ts via simulator-core).
  const result = useMemo(() => simulate(PERSONAL, amount, term), [amount, term])
  const bars = result.rows
  const maxBar = bars[0] ? bars[0].installment : 1

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-brand-navy-100 bg-white text-brand-navy-800 shadow-[0_30px_70px_-30px_rgba(5,15,35,0.6)]',
        className,
      )}
    >
      <div className="px-6 pb-1 pt-6">
        <h2 className="text-xl font-extrabold tracking-tight text-brand-navy-800">Simulá tu crédito</h2>
        <p className="mt-0.5 text-sm text-brand-navy-500">Ajustá los valores y mirá el resultado al instante.</p>
      </div>

      <div className="mx-6 mt-4 rounded-2xl bg-brand-navy-800 px-5 py-4 text-white">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/70">Cuota fija mensual</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl" aria-live="polite">
          {formatARS(result.installmentAmount)}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {term} cuotas · {formatARS(amount)} recibidos · sistema francés
        </p>
      </div>

      <div className="space-y-6 px-6 pt-6">
        <div className="space-y-3">
          <AmountField
            value={amount}
            onCommit={setAmount}
            parse={(raw) => parseAmountInput(raw, PERSONAL)}
            tone="light"
            label="Monto del crédito"
          />
          <span className="sr-only" id="live-amount-label">
            Monto del crédito, deslizá para cambiarlo
          </span>
          <Slider
            value={[amount]}
            min={PERSONAL.minAmount}
            max={PERSONAL.maxAmount}
            step={SIM_AMOUNT_STEP}
            onValueChange={(v) => setAmount(Array.isArray(v) ? v[0] : (v as number))}
            aria-labelledby="live-amount-label"
          />
          <div className="flex justify-between font-mono text-xs text-brand-navy-500">
            <span>{formatARS(PERSONAL.minAmount)}</span>
            <span>{formatARS(PERSONAL.maxAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-medium text-brand-navy-800">Plazo en cuotas</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidad de cuotas">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                aria-pressed={term === t}
                className={cn(
                  'h-10 min-w-11 rounded-lg border px-3 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                  term === t
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-brand-navy-200 bg-white text-brand-navy-700 hover:border-brand-primary/50 hover:bg-brand-primary-50',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 px-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy-500">Cada cuota por dentro</p>
        <div
          className="flex h-16 items-end gap-[3px]"
          role="img"
          aria-label={`Composición de las ${term} cuotas: el interés pesa más al principio y el capital al final`}
        >
          {bars.map((b) => (
            <div
              key={b.number}
              className="flex min-w-[3px] flex-1 flex-col justify-end overflow-hidden rounded-[2px]"
              style={{ height: `${(b.installment / maxBar) * 100}%` }}
              title={`Cuota ${b.number}: capital ${formatARS(b.capital)} · interés ${formatARS(b.interest)}`}
            >
              <div className="bg-signal-amber" style={{ height: `${(b.interest / (b.capital + b.interest || 1)) * 100}%` }} />
              <div className="flex-1 bg-brand-primary" />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-brand-navy-600">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-brand-primary" /> Capital
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-signal-amber" /> Interés
          </span>
        </div>
      </div>

      <div className="mt-5 px-6">
        <AmortizationTable rows={result.rows} tone="light" />
      </div>

      <dl className="mx-6 mt-4 divide-y divide-brand-navy-100 border-t border-brand-navy-100">
        <Row label="Capital recibido" value={formatARS(amount)} />
        <Row label="Intereses" value={formatARS(result.totalInterest)} />
        <Row label="Total a devolver" value={formatARS(result.totalAmount)} strong />
        <Row label="TNA" value={formatPercent(result.tna)} />
        <Row label="TEA" value={formatPercent(result.tea)} />
        <Row label="CFT (con IVA sobre intereses)" value={formatPercent(result.cft)} tone="accent" />
      </dl>

      <div className="mt-2 border-t border-brand-navy-100 bg-brand-navy-50 px-6 py-5">
        <Link
          href={signupHref(amount, term)}
          className="group flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary text-base font-semibold text-white transition hover:bg-brand-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          Pedir este crédito
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-3 text-xs leading-relaxed text-brand-navy-600">
          Simulación a tasa de referencia ({formatPercent(PERSONAL_QUOTE.tna)} TNA). Tu primer crédito puede otorgarse hasta{' '}
          {formatARS(FIRST_CREDIT_HARD_CAP)}; la oferta final depende de tu evaluación. Sin gastos de otorgamiento ni
          seguros. CFT = TEA × 1,21 (IVA sobre intereses). Simulación informativa: no es una oferta ni un compromiso.{' '}
          <Link href="/legal/tasas" className="font-medium text-brand-primary-700 underline underline-offset-2">
            Cómo se calculan
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
