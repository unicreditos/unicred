'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  calculatePartialPayment,
  type InstallmentLike,
  type LoanLike,
  type PartialPaymentResult,
} from '@/lib/customer/partial-payment'
import { solRef } from '@/lib/customer/view'
import { fdate, fmtPct, money } from '@/lib/uc/format'
import { PrintButton } from '@/components/uc/print-button'
import { Icon } from '@/components/uc/icons'

interface PartialPaymentCalculatorProps {
  loans: LoanLike[]
  installments: InstallmentLike[]
  preselectedLoanId?: string
}

export function PartialPaymentCalculator({
  loans,
  installments,
  preselectedLoanId,
}: PartialPaymentCalculatorProps) {
  // Filtrar créditos elegibles (activos o con cuotas impagas)
  const eligibleLoans = useMemo(() => {
    return loans.filter((l) => {
      if (l.status === 'active') return true
      const hasUnpaid = installments.some(
        (i) => i.loanId === l.id && (i.status === 'pending' || i.status === 'overdue'),
      )
      return hasUnpaid
    })
  }, [loans, installments])

  const [selectedLoanId, setSelectedLoanId] = useState<string>(() => {
    if (preselectedLoanId && eligibleLoans.some((l) => l.id === preselectedLoanId)) {
      return preselectedLoanId
    }
    return eligibleLoans[0]?.id || loans[0]?.id || ''
  })

  const currentLoan = useMemo(() => {
    return eligibleLoans.find((l) => l.id === selectedLoanId) || eligibleLoans[0] || loans[0]
  }, [eligibleLoans, loans, selectedLoanId])

  // Cuotas del crédito seleccionado
  const loanInstallments = useMemo(() => {
    if (!currentLoan) return []
    return installments
      .filter((i) => i.loanId === currentLoan.id)
      .sort((a, b) => a.number - b.number)
  }, [installments, currentLoan])

  // Referencia temporal actual
  const now = useMemo(() => new Date(), [])

  // Análisis rápido del crédito para calcular valores por defecto
  const quickStats = useMemo(() => {
    if (!currentLoan) {
      return {
        overdueTotal: 0,
        overdueInterest: 0,
        overdueCapital: 0,
        nextAmount: 0,
        totalDebt: 0,
        initialCapital: 0,
        overdueCount: 0,
      }
    }
    const res = calculatePartialPayment(currentLoan, loanInstallments, 0, now)
    const nextInst = loanInstallments.find(
      (i) => i.status === 'pending' || i.status === 'overdue',
    )
    return {
      overdueTotal: res.totalOverdueAmount,
      overdueInterest: res.totalOverdueInterest,
      overdueCapital: res.totalOverdueCapital,
      nextAmount: nextInst ? Number(nextInst.amount) || 0 : 0,
      totalDebt: res.initialTotalDebt,
      initialCapital: res.initialCapitalBalance,
      overdueCount: res.overdueCount,
    }
  }, [currentLoan, loanInstallments, now])

  // Monto ingresado por el usuario para la simulación
  const [paymentAmount, setPaymentAmount] = useState<number>(() => {
    if (quickStats.overdueTotal > 0) return quickStats.overdueTotal
    if (quickStats.nextAmount > 0) return quickStats.nextAmount
    return 10000
  })

  // Cálculo en tiempo real
  const result: PartialPaymentResult | null = useMemo(() => {
    if (!currentLoan) return null
    return calculatePartialPayment(currentLoan, loanInstallments, paymentAmount, now)
  }, [currentLoan, loanInstallments, paymentAmount, now])

  if (!currentLoan || eligibleLoans.length === 0) {
    return (
      <div className="uc-card uc-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: '#f1f5f9', marginBottom: 16 }}>
          <Icon name="check" size="sm" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>¡Estás al día con todos tus compromisos!</h2>
        <p className="uc-muted" style={{ maxWidth: 500, margin: '0 auto 24px' }}>
          No tenés cuotas vencidas ni créditos con saldos pendientes para amortizar en este momento.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/dashboard/creditos" className="uc-btn">
            Ver mis créditos
          </Link>
          <Link href="/dashboard" className="uc-btn uc-primary">
            Ir al inicio
          </Link>
        </div>
      </div>
    )
  }

  // Presets sugeridos
  const presets = [
    ...(quickStats.overdueInterest > 0
      ? [
          {
            label: 'Solo intereses vencidos',
            sub: 'Exigible',
            amount: quickStats.overdueInterest,
          },
        ]
      : []),
    ...(quickStats.overdueInterest > 0 && quickStats.overdueCapital > 0
      ? [
          {
            label: 'Intereses + 50% capital',
            sub: 'Alivio mora',
            amount: Math.round(quickStats.overdueInterest + quickStats.overdueCapital * 0.5),
          },
        ]
      : []),
    ...(quickStats.overdueTotal > 0
      ? [
          {
            label: 'Total vencido (Ponerte al día)',
            sub: '100% exigible',
            amount: quickStats.overdueTotal,
            highlight: true,
          },
        ]
      : []),
    ...(quickStats.nextAmount > 0
      ? [
          {
            label: '1 cuota completa',
            sub: 'Cuota contractual',
            amount: quickStats.nextAmount,
          },
        ]
      : []),
    ...(quickStats.totalDebt > 0
      ? [
          {
            label: 'Saldo total del crédito',
            sub: 'Cancelación total',
            amount: quickStats.totalDebt,
          },
        ]
      : []),
  ]

  const maxSliderValue = Math.max(50000, quickStats.totalDebt || 100000)

  // Próxima cuota a pagar para el botón directo de checkout
  const nextPayable = loanInstallments.find((i) => i.status === 'overdue') || loanInstallments.find((i) => i.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Selector de Crédito si el cliente tiene más de uno */}
      {eligibleLoans.length > 1 && (
        <div className="uc-card uc-pad" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Seleccioná el crédito a simular:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {eligibleLoans.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedLoanId(l.id)
                      const stats = calculatePartialPayment(l, installments, 0, now)
                      if (stats.totalOverdueAmount > 0) {
                        setPaymentAmount(stats.totalOverdueAmount)
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      selectedLoanId === l.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <b>{solRef(l.id)}</b> · {money(Number(l.principal) || 0)}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Tasa mensual</span>
              <div className="font-semibold text-sm">{fmtPct(Number(currentLoan.monthlyRate) || 0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen del crédito seleccionado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="uc-card p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs font-medium text-slate-500 block mb-1">Crédito Seleccionado</span>
          <div className="text-base font-bold text-slate-900">{solRef(currentLoan.id)}</div>
          <span className="text-xs text-slate-500">{currentLoan.term} cuotas fijas</span>
        </div>
        <div className="uc-card p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs font-medium text-slate-500 block mb-1">Saldo de Capital Inicial</span>
          <div className="text-base font-bold text-slate-900">{money(quickStats.initialCapital)}</div>
          <span className="text-xs text-slate-500">Capital puro adeudado</span>
        </div>
        <div className="uc-card p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs font-medium text-slate-500 block mb-1">Intereses Vencidos Exigibles</span>
          <div className={`text-base font-bold ${quickStats.overdueInterest > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {money(quickStats.overdueInterest)}
          </div>
          <span className="text-xs text-slate-500">
            {quickStats.overdueCount > 0 ? `${quickStats.overdueCount} cuota(s) vencida(s)` : 'Al día sin mora'}
          </span>
        </div>
        <div className="uc-card p-4 bg-white border border-slate-200 rounded-xl">
          <span className="text-xs font-medium text-slate-500 block mb-1">Total Vencido para Regularizar</span>
          <div className={`text-base font-bold ${quickStats.overdueTotal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {money(quickStats.overdueTotal)}
          </div>
          <span className="text-xs text-slate-500">
            {quickStats.overdueTotal > 0 ? 'Intereses + Capital vencido' : 'Sin deuda vencida'}
          </span>
        </div>
      </div>

      {/* Panel interactivo de ingreso de pago parcial */}
      <div className="uc-card uc-pad p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Icon name="wallet" size="sm" />
              ¿Cuánto dinero querés pagar hoy?
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Ingresá el importe parcial o a cuenta para calcular al instante su imputación legal y el impacto en tu saldo.
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <PrintButton label="Imprimir simulación" variant="outline" size="sm" />
          </div>
        </div>

        {/* Input con formato y visualización destacada */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-6 space-y-2">
            <label htmlFor="partialAmount" className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Monto a simular (en Pesos Argentinos)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                $
              </span>
              <input
                id="partialAmount"
                type="number"
                min="0"
                step="100"
                max={quickStats.totalDebt * 1.5 || 5000000}
                value={paymentAmount || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setPaymentAmount(Number.isFinite(val) ? Math.max(0, val) : 0)
                }}
                className="w-full pl-10 pr-4 py-3 text-2xl font-black text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-mono"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-slate-500 flex justify-between">
              <span>Mínimo: $500</span>
              <span>Total adeudado del crédito: {money(quickStats.totalDebt)}</span>
            </p>
          </div>

          {/* Slider interactivo */}
          <div className="md:col-span-6 space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center text-xs font-medium text-slate-600">
              <span>Ajuste rápido proporcional</span>
              <span className="font-bold text-blue-700">{money(paymentAmount)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={maxSliderValue}
              step="500"
              value={Math.min(paymentAmount, maxSliderValue)}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>$0</span>
              <span>50%</span>
              <span>100% ({money(maxSliderValue)})</span>
            </div>
          </div>
        </div>

        {/* Botones de montos sugeridos (presets) */}
        {presets.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Accesos rápidos sugeridos:
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPaymentAmount(p.amount)}
                  className={`inline-flex flex-col text-left px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    paymentAmount === p.amount
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : p.highlight
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-semibold">{p.label}</span>
                  <span className={`text-[11px] ${paymentAmount === p.amount ? 'text-blue-100' : 'text-slate-500'}`}>
                    {money(p.amount)} ({p.sub})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Veredicto y Diagnóstico Automático en Tiempo Real */}
          <div
            className={`uc-card p-6 rounded-2xl border-2 transition-all ${
              result.verdictTone === 'danger'
                ? 'bg-rose-50/70 border-rose-300'
                : result.verdictTone === 'warning'
                ? 'bg-amber-50/70 border-amber-300'
                : 'bg-emerald-50/70 border-emerald-300'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-sm ${
                      result.verdictTone === 'danger'
                        ? 'bg-rose-600'
                        : result.verdictTone === 'warning'
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {result.verdictTone === 'danger' ? '✕' : result.verdictTone === 'warning' ? '!' : '✓'}
                  </span>
                  <h3
                    className={`text-lg font-black ${
                      result.verdictTone === 'danger'
                        ? 'text-rose-900'
                        : result.verdictTone === 'warning'
                        ? 'text-amber-900'
                        : 'text-emerald-900'
                    }`}
                  >
                    {result.verdictTitle}
                  </h3>
                </div>
                <p
                  className={`text-sm leading-relaxed max-w-3xl ${
                    result.verdictTone === 'danger'
                      ? 'text-rose-800'
                      : result.verdictTone === 'warning'
                      ? 'text-amber-800'
                      : 'text-emerald-800'
                  }`}
                >
                  {result.verdictDescription}
                </p>
              </div>

              {/* Botón de acción para pagar este importe */}
              <div className="no-print shrink-0 self-start">
                {nextPayable ? (
                  <Link
                    href={`/dashboard/pagos?pay=${nextPayable.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                  >
                    <Icon name="wallet" size="sm" />
                    Pagar {money(result.paymentAmount)}
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Tarjetas de Cobertura Específica: Intereses vs Capital Vencido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-200/60">
              {/* Cobertura de Intereses */}
              <div className="bg-white/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Cobertura de Intereses Vencidos
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                      result.coversInterest
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {result.coversInterest ? '✓ 100% Cubiertos' : `✕ Solo ${result.interestCoveragePct}%`}
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900">
                  {money(result.allocatedToInterest)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    de {money(result.totalOverdueInterest)} exigibles
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.coversInterest ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${result.interestCoveragePct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {result.coversInterest
                    ? 'Todos los intereses vencidos quedan completamente cancelados.'
                    : `Faltan ${money(result.remainingInterestDue)} para completar los intereses vencidos.`}
                </p>
              </div>

              {/* Cobertura de Capital Vencido */}
              <div className="bg-white/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Cobertura de Capital Vencido
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                      result.coversOverdueCapital
                        ? 'bg-emerald-100 text-emerald-800'
                        : result.isOverdueCapitalPartial
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {result.coversOverdueCapital
                      ? '✓ 100% Amortizado'
                      : result.isOverdueCapitalPartial
                      ? `⚠️ Parcial (${result.overdueCapitalCoveragePct}%)`
                      : '✕ 0% Amortizado'}
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900">
                  {money(result.allocatedToOverdueCapital)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    de {money(result.totalOverdueCapital)} exigibles
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.coversOverdueCapital
                        ? 'bg-emerald-500'
                        : result.isOverdueCapitalPartial
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${result.overdueCapitalCoveragePct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {result.coversOverdueCapital
                    ? 'El capital vencido exigible queda 100% amortizado.'
                    : result.isOverdueCapitalPartial
                    ? `Resta amortizar ${money(result.remainingOverdueCapital)} de capital vencido.`
                    : 'Este pago no alcanza a amortizar capital vencido.'}
                </p>
              </div>
            </div>

            {/* Barra de Distribución del Pago */}
            <div className="mt-5 pt-4 border-t border-slate-200/60">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Distribución legal del pago ({money(result.paymentAmount)}):
              </span>
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-200 text-xs">
                {result.allocatedToInterest > 0 && (
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${(result.allocatedToInterest / Math.max(1, result.paymentAmount)) * 100}%`,
                    }}
                    title={`Intereses: ${money(result.allocatedToInterest)}`}
                  />
                )}
                {result.allocatedToOverdueCapital > 0 && (
                  <div
                    className="bg-blue-600 transition-all duration-500"
                    style={{
                      width: `${(result.allocatedToOverdueCapital / Math.max(1, result.paymentAmount)) * 100}%`,
                    }}
                    title={`Capital vencido: ${money(result.allocatedToOverdueCapital)}`}
                  />
                )}
                {result.allocatedToCapitalAdvance > 0 && (
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${(result.allocatedToCapitalAdvance / Math.max(1, result.paymentAmount)) * 100}%`,
                    }}
                    title={`Adelanto de capital: ${money(result.allocatedToCapitalAdvance)}`}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Intereses vencidos: <b>{money(result.allocatedToInterest)}</b>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  Capital vencido: <b>{money(result.allocatedToOverdueCapital)}</b>
                </span>
                {result.allocatedToCapitalAdvance > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Adelanto de capital futuro: <b>{money(result.allocatedToCapitalAdvance)}</b>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* IMPACTO EXACTO EN EL SALDO PENDIENTE */}
          <div className="uc-card uc-pad p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon name="credit" size="sm" />
                Impacto Exacto en tu Saldo Pendiente
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparativa antes y después de aplicar este pago parcial al crédito
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Saldo de Capital */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
                  Saldo de Capital Puro
                </span>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">Antes</span>
                    <span className="text-sm font-semibold line-through text-slate-500">
                      {money(result.initialCapitalBalance)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-emerald-600 font-bold block">Nuevo saldo</span>
                    <span className="text-xl font-black text-slate-900">
                      {money(result.newCapitalBalance)}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-xs">
                  <span className="text-slate-500">Amortización directa:</span>
                  <span className="font-bold text-emerald-600">
                    -{money(result.capitalReductionAmount)} ({result.capitalReductionPct}%)
                  </span>
                </div>
              </div>

              {/* Saldo Total de Cuotas */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
                  Deuda Total Contractual
                </span>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">Antes</span>
                    <span className="text-sm font-semibold line-through text-slate-500">
                      {money(result.initialTotalDebt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-blue-600 font-bold block">Nuevo saldo</span>
                    <span className="text-xl font-black text-slate-900">
                      {money(result.newTotalDebt)}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-xs">
                  <span className="text-slate-500">Reducción total de deuda:</span>
                  <span className="font-bold text-blue-600">
                    -{money(result.totalDebtReductionAmount)}
                  </span>
                </div>
              </div>

              {/* Regularización y Beneficios Adicionales */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
                  Regularización & Ahorro
                </span>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cuotas regularizadas:</span>
                    <b className="text-slate-900">
                      {result.schedule.filter((s) => s.statusAfterPayment === 'paid').length} cuota(s)
                    </b>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cuotas con saldo parcial:</span>
                    <b className="text-slate-900">
                      {result.schedule.filter((s) => s.statusAfterPayment === 'partial').length} cuota(s)
                    </b>
                  </div>
                  {result.allocatedToCapitalAdvance > 0 && (
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-emerald-700 font-semibold">Ahorro futuro est.:</span>
                      <b className="text-emerald-700">~{money(result.futureInterestSavedEstimate)}</b>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CRONOGRAMA DE IMPUTACIÓN CUOTA POR CUOTA */}
          <div className="uc-card uc-pad p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Desglose de Imputación Cuota a Cuota
                </h3>
                <p className="text-xs text-slate-500">
                  Regla de prelación legal (Art. 900 CCCN): los fondos se aplican primero a cancelar intereses de la cuota más antigua y luego a su capital.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Cuota</th>
                    <th className="py-2.5 px-3">Vencimiento</th>
                    <th className="py-2.5 px-3 text-right">Importe Original</th>
                    <th className="py-2.5 px-3 text-right">Interés Original</th>
                    <th className="py-2.5 px-3 text-right">Capital Original</th>
                    <th className="py-2.5 px-3 text-right text-blue-700">Pago Aplicado</th>
                    <th className="py-2.5 px-3 text-right">Saldo Restante</th>
                    <th className="py-2.5 px-3 text-center">Nuevo Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.schedule.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.statusAfterPayment === 'paid'
                          ? 'bg-emerald-50/30'
                          : row.statusAfterPayment === 'partial'
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-900">
                        Cuota {row.number}/{currentLoan.term}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-700">{fdate(row.dueDate)}</span>
                        {row.isOverdue && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800">
                            Vencida
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {money(row.originalAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {money(row.contractualInterest)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {money(row.contractualCapital)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-blue-700">
                        {row.allocatedTotal > 0 ? (
                          <div>
                            <div>+{money(row.allocatedTotal)}</div>
                            <div className="text-[10px] font-normal text-slate-400">
                              (Int: {money(row.allocatedInterest)} | Cap: {money(row.allocatedCapital)})
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">$0,00</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {money(row.remainingAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-md ${
                            row.statusAfterPayment === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.statusAfterPayment === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.statusAfterPayment === 'paid'
                            ? 'Cancelada'
                            : row.statusAfterPayment === 'partial'
                            ? 'Pago parcial'
                            : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
