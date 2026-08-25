'use client'

import { computeFrenchAmortization, formatARS, formatPercent } from '@/lib/finance'
import { PERSONAL_QUOTE } from '@/lib/loan-catalog'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const TERMS = [3, 6, 9, 12, 18, 24, 36, 48].filter(
  (t) => t >= PERSONAL_QUOTE.minTerm && t <= PERSONAL_QUOTE.maxTerm,
)

export function PedirSimulator({
  ctaHref = '/pedir/solicitud',
  ctaLabel = 'Continuar con esta simulación',
}: {
  ctaHref?: string
  ctaLabel?: string
}) {
  const [amount, setAmount] = useState(Math.min(PERSONAL_QUOTE.referenceAmount, PERSONAL_QUOTE.maxAmount))
  const [term, setTerm] = useState<number>(PERSONAL_QUOTE.referenceTerm)
  const plan = useMemo(
    () => computeFrenchAmortization(amount, term, PERSONAL_QUOTE.monthlyRate),
    [amount, term],
  )
  const href = `${ctaHref}?monto=${amount}&plazo=${term}`

  return (
    <div className="lp-sim-shell" id="simular">
      <div className="lp-sim-controls space-y-7">
        <div>
          <p className="lp-kicker">Simulador</p>
          <h2 className="lp-display mt-2 text-3xl text-[var(--lp-ink)] sm:text-4xl">Tus números, ahora</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
            Orientativo. El monto real se ofrece después del scoring, la capacidad de pago y tu historial en la app. Tope
            de línea {formatARS(PERSONAL_QUOTE.maxAmount)} — no es oferta automática.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between">
            <label className="lp-label mb-0" htmlFor="lp-amount">
              Monto
            </label>
            <span className="font-mono text-lg font-bold tabular-nums">{formatARS(amount)}</span>
          </div>
          <input
            id="lp-amount"
            type="range"
            min={PERSONAL_QUOTE.minAmount}
            max={PERSONAL_QUOTE.maxAmount}
            step={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-[var(--lp-signal)]"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-[var(--lp-muted)]">
            <span>{formatARS(PERSONAL_QUOTE.minAmount)}</span>
            <span>{formatARS(PERSONAL_QUOTE.maxAmount)}</span>
          </div>
        </div>

        <div>
          <p className="lp-label">Plazo</p>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={`h-10 min-w-12 rounded-full border px-3 text-sm font-bold transition ${
                  term === t
                    ? 'border-[var(--lp-ink)] bg-[var(--lp-ink)] text-white'
                    : 'border-[var(--lp-line)] bg-white text-[var(--lp-ink)] hover:border-[var(--lp-ink)]/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lp-sim-result">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lp-signal)]">Cuota</p>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight">
            {formatARS(plan.installmentAmount)}
            <span className="ml-1 text-base font-medium text-white/40">/mes</span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
          <div>
            <dt className="text-white/40">TNA</dt>
            <dd className="mt-0.5 font-mono font-bold">{formatPercent(plan.tna)}</dd>
          </div>
          <div>
            <dt className="text-white/40">CFT</dt>
            <dd className="mt-0.5 font-mono font-bold">{formatPercent(plan.cft)}</dd>
          </div>
          <div>
            <dt className="text-white/40">Total</dt>
            <dd className="mt-0.5 font-mono font-bold">{formatARS(plan.totalAmount)}</dd>
          </div>
          <div>
            <dt className="text-white/40">Plazo</dt>
            <dd className="mt-0.5 font-mono font-bold">{term} cuotas</dd>
          </div>
        </dl>
        <p className="text-[11px] leading-relaxed text-white/35">
          No es oferta vinculante. Primero score y capacidad; recién ahí se confirma el monto.
        </p>
        <Link href={href} className="lp-btn lp-btn-primary w-full">
          {ctaLabel}
        </Link>
      </div>
    </div>
  )
}
