'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ChevronRight, Calculator, ShieldCheck, Zap } from 'lucide-react'
import { computeFrenchAmortization, formatARS } from '@/lib/finance'
import { catalogByType, PERSONAL_QUOTE } from '@/lib/loan-catalog'
import { cn } from '@/lib/utils'

const PERSONAL = catalogByType('personal')
const AMOUNT_PRESETS = [100_000, 300_000, 600_000, 1_200_000, 2_000_000]
const TERM_OPTIONS = [3, 6, 12, 18, 24]

export function InteractiveHeroSimulator({ className }: { className?: string }) {
  const [amount, setAmount] = useState(450_000)
  const [term, setTerm] = useState(12)
  const [showAmortization, setShowAmortization] = useState(false)

  const result = useMemo(
    () => computeFrenchAmortization(amount, term, PERSONAL.monthlyRate),
    [amount, term],
  )

  const totalInterest = Math.max(0, result.totalAmount - amount)
  const capitalPct = Math.round((amount / result.totalAmount) * 100)
  const interestPct = 100 - capitalPct

  // Primer vencimiento estimado (30 días en el futuro)
  const firstDueDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }, [])

  // Cuotas de muestra
  const sampleSchedule = useMemo(() => {
    const i = PERSONAL.monthlyRate / 100
    let balance = amount
    const inst = result.installmentAmount
    const rows = []
    for (let idx = 1; idx <= Math.min(term, 4); idx++) {
      const interest = balance * i
      const capital = Math.min(balance, inst - interest)
      balance -= capital
      rows.push({
        num: idx,
        installment: inst,
        capital,
        interest,
        balance: Math.max(0, balance),
      })
    }
    return rows
  }, [amount, term, result.installmentAmount])

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#081810] p-6 sm:p-8 text-white shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      {/* Decorative gradient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -bottom-24 -z-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
              Cotizador en vivo
            </span>
            <p className="text-[13px] text-white/70">Sistema Francés · Cuotas Fijas en Pesos</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
            CFT {PERSONAL_QUOTE.cftLabel}
          </span>
          <p className="text-[11px] text-white/50">TNA {PERSONAL_QUOTE.tnaLabel}</p>
        </div>
      </div>

      {/* Main Controls */}
      <div className="mt-6 space-y-6">
        {/* Monto Slider & Input */}
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="loan-amount-slider" className="text-sm font-medium text-white/80">
              ¿Cuánto dinero necesitás?
            </label>
            <span className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
              {formatARS(amount)}
            </span>
          </div>

          <div className="mt-3">
            <input
              id="loan-amount-slider"
              type="range"
              min={50_000}
              max={2_500_000}
              step={10_000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="Monto del préstamo"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-emerald-400 focus:outline-none"
            />
            <div className="mt-1.5 flex justify-between text-[11px] text-white/50 font-mono">
              <span>$50.000</span>
              <span>$1.250.000</span>
              <span>$2.500.000</span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  amount === preset
                    ? 'bg-emerald-500 text-[#081810] font-semibold'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                {formatARS(preset)}
              </button>
            ))}
          </div>
        </div>

        {/* Plazo Selector */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-white/80">¿En cuántos meses?</span>
            <span className="font-mono text-lg font-bold text-white tabular-nums">
              {term} cuotas fijas
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-5 gap-1.5 sm:gap-2">
            {TERM_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition-all',
                  term === t
                    ? 'border-2 border-emerald-400 bg-emerald-500/20 text-white font-bold shadow-lg shadow-emerald-950/40'
                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <span className="text-base sm:text-lg font-bold font-mono">{t}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">meses</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result Callout Card */}
      <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-300 font-medium">
              Tu cuota mensual estimada
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-white tabular-nums">
                {formatARS(result.installmentAmount)}
              </span>
              <span className="text-xs text-white/60">/ mes</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-white/50">1er Vencimiento</span>
            <p className="font-mono text-xs font-semibold text-white/90">{firstDueDate}</p>
          </div>
        </div>

        {/* Visual Capital vs Interés Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/70">
            <span>Capital: {formatARS(amount)} ({capitalPct}%)</span>
            <span>Intereses: {formatARS(totalInterest)} ({interestPct}%)</span>
          </div>
          <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="bg-emerald-400 transition-all duration-300"
              style={{ width: `${capitalPct}%` }}
              title={`Capital: ${capitalPct}%`}
            />
            <div
              className="bg-amber-400 transition-all duration-300"
              style={{ width: `${interestPct}%` }}
              title={`Intereses: ${interestPct}%`}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-white/50">
            <span>Total a devolver: {formatARS(result.totalAmount)}</span>
            <span>Cuotas fijas e iguales</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        <Link
          href={`/sign-up?amount=${amount}&term=${term}`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 text-base font-bold text-[#081810] transition hover:bg-emerald-300 shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
        >
          Pedir este préstamo ahora
          <ArrowRight className="h-4 w-4" />
        </Link>

        <div className="flex items-center justify-between text-xs text-white/60 pt-1">
          <button
            type="button"
            onClick={() => setShowAmortization((v) => !v)}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            {showAmortization ? 'Ocultar amortización' : 'Ver detalle de primeras cuotas'}
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAmortization && 'rotate-90')} />
          </button>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Sin compromiso ni costos previos
          </span>
        </div>

        {/* Amortization schedule drawer */}
        {showAmortization && (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-3">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-[11px]">
                  <th className="pb-1.5">Cuota</th>
                  <th className="pb-1.5">Valor</th>
                  <th className="pb-1.5">Capital</th>
                  <th className="pb-1.5">Interés</th>
                  <th className="pb-1.5 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sampleSchedule.map((row) => (
                  <tr key={row.num} className="text-white/80">
                    <td className="py-1 font-semibold text-emerald-400">#{row.num}</td>
                    <td className="py-1">{formatARS(row.installment)}</td>
                    <td className="py-1 text-white/90">{formatARS(row.capital)}</td>
                    <td className="py-1 text-amber-300">{formatARS(row.interest)}</td>
                    <td className="py-1 text-right text-white/60">{formatARS(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {term > 4 && (
              <p className="mt-2 text-center text-[10px] text-white/40">
                Mostrando primeras 4 de {term} cuotas. El cronograma completo estará en tu panel al firmar.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Trust footline */}
      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-[11px] text-white/60">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>Acreditación directa en CBU/CVU</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>Sin seguros ni gastos sorpresa</span>
        </div>
      </div>
    </div>
  )
}
