'use client'

import { DIRECTO } from '@/directo/copy'
import { directoSignupHref } from '@/directo/intent'
import { computeFrenchAmortization, formatARS, formatPercent } from '@/lib/finance'
import { catalogByType } from '@/lib/loan-catalog'
import { FIRST_CREDIT_HARD_CAP } from '@/lib/loan-underwriting'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const PERSONAL = catalogByType('personal')
const TERMS = [3, 6, 9, 12, 18, 24, 36, 48].filter((t) => t >= PERSONAL.minTerm && t <= PERSONAL.maxTerm)
const DEFAULT_AMOUNT = Math.min(PERSONAL.referenceAmount, FIRST_CREDIT_HARD_CAP)

export function DirectoRequestBox() {
  const [amount, setAmount] = useState<number>(DEFAULT_AMOUNT)
  const [term, setTerm] = useState<number>(PERSONAL.referenceTerm)
  const plan = useMemo(
    () => computeFrenchAmortization(amount, term, PERSONAL.monthlyRate),
    [amount, term],
  )
  const href = directoSignupHref(amount, term)

  return (
    <div id="solicitar" className="dx-form">
      <h2>Cuánto necesitás</h2>
      <p className="dx-cuota">
        {formatARS(plan.installmentAmount)} <span>/ mes, estimado</span>
      </p>
      <p>
        {formatARS(amount)} en {term} cuotas, sistema francés.
      </p>
      <div className="dx-field">
        <label htmlFor="dx-monto">
          Monto <b>{formatARS(amount)}</b>
        </label>
        <input
          id="dx-monto"
          type="range"
          min={PERSONAL.minAmount}
          max={PERSONAL.maxAmount}
          step={10_000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      <div className="dx-field">
        <p id="dx-plazo-label">
          Plazo <span />
        </p>
        <div className="dx-plazo" role="group" aria-labelledby="dx-plazo-label">
          {TERMS.map((t) => (
            <button
              key={t}
              type="button"
              data-on={t === term}
              aria-pressed={t === term}
              onClick={() => setTerm(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <dl className="dx-grid2">
        <div>
          <dt>TNA</dt>
          <dd>{formatPercent(plan.tna)}</dd>
        </div>
        <div>
          <dt>CFT c/IVA</dt>
          <dd>{formatPercent(plan.cft)}</dd>
        </div>
        <div>
          <dt>Total a devolver</dt>
          <dd>{formatARS(plan.totalAmount)}</dd>
        </div>
      </dl>
      <Link href={href} className="dx-btn">
        {DIRECTO.ctaPrimary}
      </Link>
      <p className="dx-legal">{DIRECTO.productLead}</p>
      <p className="dx-legal">{DIRECTO.disclaimer}</p>
    </div>
  )
}
