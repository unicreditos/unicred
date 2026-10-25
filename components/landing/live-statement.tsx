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

/**
 * Tira de código de barras decorativa del comprobante: se deriva de las cifras de la simulación, así cambia con
 * cada monto y plazo como el talón real de la cuponera. No codifica nada (aria-hidden).
 */
function Barcode({ seed }: { seed: string }) {
  const digits = seed.replace(/\D/g, '').padEnd(24, '7').slice(0, 24)
  let x = 0
  const bars: { x: number; w: number }[] = []
  for (const d of digits) {
    const n = Number(d)
    const w = 1 + (n % 3)
    bars.push({ x, w })
    x += w + 1 + ((n + 1) % 2)
    bars.push({ x, w: 1 })
    x += 2 + (n % 2)
  }
  return (
    <svg viewBox={`0 0 ${x} 28`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={28} fill="currentColor" />
      ))}
    </svg>
  )
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">{label}</dt>
      <dd className={cn('mt-1 truncate font-mono text-sm font-semibold tabular-nums', accent ? 'text-signal-amber' : 'text-white')}>{value}</dd>
    </div>
  )
}

export function LiveStatement({ className }: { className?: string }) {
  const [amount, setAmount] = useState(400_000)
  const [term, setTerm] = useState(12)

  // Mismo cálculo que el crédito real (lib/finance.ts vía simulator-core).
  const result = useMemo(() => simulate(PERSONAL, amount, term), [amount, term])
  const bars = result.rows
  const maxBar = bars[0] ? bars[0].installment : 1
  const ticketNo = `SIM-${String(Math.round(amount / 1000)).padStart(4, '0')}-${String(term).padStart(2, '0')}`

  return (
    <div className={cn('uc-ticket relative text-brand-navy-800', className)}>
      {/* Cuerpo del comprobante */}
      <div className="rounded-t-[1.75rem] bg-[#FBFCFE] px-6 pb-7 pt-5 sm:px-7">
        <div className="flex items-center justify-between gap-3 border-b border-dashed border-brand-navy-200 pb-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-navy-500">Comprobante de simulación</p>
          <p className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-brand-navy-400">{ticketNo}</p>
        </div>

        <h2 className="sr-only">Simulá tu crédito</h2>
        <div className="mt-5">
          <p className="text-sm text-brand-navy-500">Cuota fija mensual</p>
          <p className="mt-1 font-display text-5xl font-extrabold tracking-[-0.03em] tabular-nums text-brand-navy-900 sm:text-6xl" aria-live="polite">
            {formatARS(result.installmentAmount)}
          </p>
          <p className="mt-1.5 text-sm text-brand-navy-500">
            {term} cuotas · {formatARS(amount)} recibidos · sistema francés
          </p>
        </div>

        <div className="mt-7 space-y-3">
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
          <div className="flex justify-between font-mono text-[11px] text-brand-navy-400">
            <span>{formatARS(PERSONAL.minAmount)}</span>
            <span>{formatARS(PERSONAL.maxAmount)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          <span className="text-sm font-medium text-brand-navy-800">Plazo en cuotas</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cantidad de cuotas">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                aria-pressed={term === t}
                className={cn(
                  'h-10 min-w-11 rounded-full border px-3.5 font-mono text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                  term === t
                    ? 'border-brand-navy-900 bg-brand-navy-900 text-white'
                    : 'border-brand-navy-200 bg-white text-brand-navy-700 hover:border-brand-navy-400',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div
            className="flex h-14 items-end gap-[3px]"
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
          <div className="mt-2 flex items-center justify-between gap-4 text-xs text-brand-navy-500">
            <span className="font-medium text-brand-navy-700">Cada cuota por dentro</span>
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-sm bg-brand-primary" /> Capital
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-sm bg-signal-amber" /> Interés
              </span>
            </span>
          </div>
          <div className="mt-4">
            <AmortizationTable rows={result.rows} tone="light" />
          </div>
        </div>
      </div>

      {/* Troquel: muescas laterales + línea de corte */}
      <div className="relative h-0" aria-hidden>
        <span className="uc-ticket-notch -left-3" />
        <span className="uc-ticket-notch -right-3" />
        <span className="absolute inset-x-6 top-0 border-t-2 border-dashed border-brand-navy-200/80" />
      </div>

      {/* Talón: el costo completo */}
      <div className="rounded-b-[1.75rem] border-x border-b border-white/10 bg-brand-navy-900 px-6 pb-6 pt-7 text-white sm:px-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Total a devolver</p>
        <p className="mt-1.5 font-display text-4xl font-extrabold tracking-[-0.02em] tabular-nums text-signal-amber sm:text-5xl">
          {formatARS(result.totalAmount)}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 sm:grid-cols-3 gap-y-4 border-t border-white/10 pt-5">
          <Figure label="Capital" value={formatARS(amount)} />
          <Figure label="Intereses" value={formatARS(result.totalInterest)} />
          <Figure label="TNA" value={formatPercent(result.tna)} />
          <Figure label="TEA" value={formatPercent(result.tea)} />
          <div className="col-span-2">
            <Figure label="CFT (con IVA sobre intereses)" value={formatPercent(result.cft)} accent />
          </div>
        </dl>

        <div className="mt-5 text-white/35">
          <Barcode seed={`${Math.round(result.totalAmount)}${term}${Math.round(amount)}`} />
        </div>

        <Link
          href={signupHref(amount, term)}
          className="group mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-brand-primary-300 text-base font-semibold text-brand-navy-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-900"
        >
          Pedir este crédito
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-4 text-xs leading-relaxed text-white/60">
          Simulación a tasa de referencia ({formatPercent(PERSONAL_QUOTE.tna)} TNA). Tu primer crédito puede otorgarse hasta{' '}
          {formatARS(FIRST_CREDIT_HARD_CAP)}; la oferta final depende de tu evaluación. Sin gastos de otorgamiento ni
          seguros. CFT = TEA × 1,21 (IVA sobre intereses). Simulación informativa: no es una oferta ni un compromiso.{' '}
          <Link href="/legal/tasas" className="font-medium text-brand-primary-300 underline underline-offset-2">
            Cómo se calculan
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
