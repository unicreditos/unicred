'use client'

import { formatARSDecimal } from '@/lib/finance'
import type { AmountParse } from '@/lib/simulator-core'
import { cn } from '@/lib/utils'
import { useId, useState } from 'react'

type Tone = 'dark' | 'light' | 'glass'

/**
 * Campo para escribir el monto (ademas del control deslizante).
 * Valida al salir del campo y al apretar Enter; mientras escribe no pisa el valor.
 * Si el texto no es valido muestra el motivo y conserva el ultimo monto valido.
 */
export function AmountField({
  value,
  onCommit,
  parse,
  tone = 'dark',
  label = 'Monto',
}: {
  value: number
  onCommit: (v: number) => void
  parse: (raw: string) => AmountParse
  tone?: Tone
  label?: string
}) {
  const id = useId()
  const errId = `${id}-err`
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = draft ?? value.toLocaleString('es-AR')

  function commit() {
    if (draft === null) return
    const r = parse(draft)
    if (r.ok) {
      onCommit(r.value)
      setDraft(null)
      setError(null)
    } else {
      setError(r.error)
    }
  }

  const dark = tone === 'dark'
  return (
    <div>
      <label htmlFor={id} className={cn('text-sm font-medium', dark ? 'text-white/80' : 'text-brand-navy')}>
        {label} (ARS)
      </label>
      <div
        className={cn(
          'mt-1.5 flex h-11 items-center rounded-lg border px-3 font-mono text-base tabular-nums focus-within:ring-2 focus-within:ring-brand-primary',
          dark ? 'border-white/20 bg-white/5 text-white' : 'border-border bg-white text-brand-navy',
          error && 'border-red-400',
        )}
      >
        <span aria-hidden className={dark ? 'text-white/45' : 'text-muted-foreground'}>
          $
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={shown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          className="ml-1.5 h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>
      {error ? (
        <p id={errId} role="alert" className={cn('mt-1.5 text-xs', dark ? 'text-red-300' : 'text-red-600')}>
          {error} Seguimos mostrando {value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}.
        </p>
      ) : null}
    </div>
  )
}

export type TableRow = { number: number; installment: number; interest: number; capital: number; balance: number }

/** Tabla de amortizacion (sistema frances), desplegable, con scroll propio para no desbordar en 390 px. */
export function AmortizationTable({ rows, tone = 'dark' }: { rows: TableRow[]; tone?: Tone }) {
  const dark = tone === 'dark'
  const total = rows.reduce(
    (a, r) => ({ installment: a.installment + r.installment, interest: a.interest + r.interest, capital: a.capital + r.capital }),
    { installment: 0, interest: 0, capital: 0 },
  )
  const th = cn('px-3 py-2 text-right font-medium', dark ? 'text-white/55' : 'text-muted-foreground')
  const td = 'px-3 py-1.5 text-right'
  return (
    <details className={cn('group rounded-lg border', dark ? 'border-white/10' : 'border-border')}>
      <summary
        className={cn(
          'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary [&::-webkit-details-marker]:hidden',
          dark ? 'text-white/85' : 'text-brand-navy',
        )}
      >
        Ver tabla de cuotas ({rows.length})
        <span aria-hidden className="text-lg font-light transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de amortizacion, desplazable"
        className="max-h-72 overflow-auto border-t border-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <table className={cn('w-full min-w-[26rem] border-collapse font-mono text-xs tabular-nums', dark ? 'text-white/85' : 'text-brand-navy')}>
          <caption className="sr-only">
            Cuota, capital, interes y saldo de cada cuota. Valores en pesos, redondeados al centavo.
          </caption>
          <thead className={cn('sticky top-0', dark ? 'bg-ink' : 'bg-white')}>
            <tr>
              <th scope="col" className={cn(th, 'text-left')}>
                N°
              </th>
              <th scope="col" className={th}>
                Cuota
              </th>
              <th scope="col" className={th}>
                Capital
              </th>
              <th scope="col" className={th}>
                Interés
              </th>
              <th scope="col" className={th}>
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.number} className={cn('border-t', dark ? 'border-white/5' : 'border-border/60')}>
                <th scope="row" className={cn(td, 'text-left font-normal')}>
                  {r.number}
                </th>
                <td className={td}>{formatARSDecimal(r.installment)}</td>
                <td className={td}>{formatARSDecimal(r.capital)}</td>
                <td className={td}>{formatARSDecimal(r.interest)}</td>
                <td className={td}>{formatARSDecimal(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={cn('border-t font-semibold', dark ? 'border-white/20' : 'border-border')}>
              <th scope="row" className={cn(td, 'text-left')}>
                Total
              </th>
              <td className={td}>{formatARSDecimal(total.installment)}</td>
              <td className={td}>{formatARSDecimal(total.capital)}</td>
              <td className={td}>{formatARSDecimal(total.interest)}</td>
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={cn('border-t border-inherit px-3 py-2 text-[11px] leading-relaxed', dark ? 'text-white/45' : 'text-muted-foreground')}>
        Valores redondeados al centavo: la suma de capital e interés puede diferir unos centavos del total. El contrato
        fija el plan de cuotas definitivo.
      </p>
    </details>
  )
}