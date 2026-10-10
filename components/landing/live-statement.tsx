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

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'amber'
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className={cn('shrink-0 text-sm', tone === 'amber' ? 'text-signal-amber' : 'text-white/60')}>{label}</dt>
      <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-white/20" />
      <dd
        className={cn(
          'shrink-0 font-mono tabular-nums',
          strong ? 'text-lg font-semibold text-white' : 'text-sm text-white/90',
          tone === 'amber' && 'text-xl font-bold text-signal-amber',
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
        'relative isolate overflow-hidden rounded-[1.75rem] bg-ink text-white shadow-[0_40px_80px_-30px_rgba(8,23,15,0.55)]',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-brand-primary/20 blur-3xl"
      />

      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
        <span>Liquidación simulada</span>
        <span>Cuota fija · sistema francés</span>
      </div>

      <div className="px-6 pb-2 pt-6">
        <p className="text-sm text-white/60">Pagarías por mes</p>
        <p className="mt-1 font-display text-5xl font-bold tracking-tight tabular-nums sm:text-6xl" aria-live="polite">
          {formatARS(result.installmentAmount)}
        </p>
        <p className="mt-1 text-sm text-white/55">
          durante {term} meses, por {formatARS(amount)} recibidos
        </p>
      </div>

      <div className="space-y-6 px-6 pt-5">
        <div className="space-y-3">
          <AmountField
            value={amount}
            onCommit={setAmount}
            parse={(raw) => parseAmountInput(raw, PERSONAL)}
            tone="dark"
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
            className="[&_[data-slot=slider-track]]:bg-white/20!"
          />
          <div className="flex justify-between font-mono text-[11px] text-white/40">
            <span>{formatARS(PERSONAL.minAmount)}</span>
            <span>{formatARS(PERSONAL.maxAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-medium text-white/80">Cuotas</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidad de cuotas">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                aria-pressed={term === t}
                className={cn(
                  'h-9 min-w-11 rounded-full px-3 font-mono text-sm tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                  term === t
                    ? 'bg-brand-primary font-semibold text-ink'
                    : 'bg-white/8 text-white/75 hover:bg-white/15',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 px-6">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
          Cada cuota por dentro
        </p>
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
              <div className="bg-signal-amber/90" style={{ height: `${(b.interest / (b.capital + b.interest || 1)) * 100}%` }} />
              <div className="flex-1 bg-brand-primary" />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-brand-primary" /> Capital
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm bg-signal-amber" /> Interés
          </span>
        </div>
      </div>

      <div className="mt-6 px-6">
        <AmortizationTable rows={result.rows} tone="dark" />
      </div>

      <dl className="mt-6 space-y-2.5 border-t border-white/10 px-6 pb-6 pt-5">
        <Row label="Capital recibido" value={formatARS(amount)} />
        <Row label="Intereses" value={formatARS(result.totalInterest)} />
        <Row label="Total a devolver" value={formatARS(result.totalAmount)} strong />
        <Row label="TNA" value={formatPercent(result.tna)} />
        <Row label="TEA" value={formatPercent(result.tea)} />
        <Row label="CFT (con IVA sobre intereses)" value={formatPercent(result.cft)} tone="amber" />
      </dl>

      <div className="bg-white/[0.04] px-6 py-5">
        <Link
          href={signupHref(amount, term)}
          className="group flex h-12 items-center justify-center gap-2 rounded-full bg-brand-primary text-base font-semibold text-ink transition hover:bg-brand-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Pedir este crédito
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          Simulación a tasa de referencia ({formatPercent(PERSONAL_QUOTE.tna)} TNA). Tu primer crédito puede otorgarse hasta{' '}
          {formatARS(FIRST_CREDIT_HARD_CAP)}; la oferta final depende de tu evaluación. Sin gastos de otorgamiento ni
          seguros. CFT = TEA × 1,21 (IVA sobre intereses). Simulación informativa: no es una oferta ni un compromiso.{' '}
          <Link href="/legal/tasas" className="underline underline-offset-2 hover:text-white/80">
            Cómo se calculan
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
