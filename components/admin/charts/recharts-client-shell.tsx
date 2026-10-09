'use client'

import React, { useState, useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  calculateCriticalDelinquencyAlerts,
  type MonthlyPlacementPoint,
  type RealtimeDelinquencyData,
  type MerchantCategoryMetric,
  type ExecutiveKpiSummary,
  type CriticalAlertRubro,
  type CriticalAlertsSummary,
} from '@/lib/admin-desk/recharts-metrics'
import { Icon } from '@/components/uc/icons'

export interface RechartsClientShellProps {
  initialMonths: MonthlyPlacementPoint[]
  delinquency: RealtimeDelinquencyData
  merchantCategories: MerchantCategoryMetric[]
  summary: ExecutiveKpiSummary
}

// Formateador de moneda en ARS
function fmtArs(num: number): string {
  if (num == null || isNaN(num)) return '$ 0'
  return `$ ${num.toLocaleString('es-AR')}`
}

// Formateador compacto para ejes de gráficos ($ 1,5 M o $ 250 k)
function fmtCompactArs(num: number): string {
  if (num >= 1_000_000) {
    const val = (num / 1_000_000).toFixed(1).replace('.0', '')
    return `$ ${val}M`
  }
  if (num >= 1_000) {
    const val = (num / 1_000).toFixed(0)
    return `$ ${val}k`
  }
  return `$ ${num}`
}

export function RechartsClientShell({
  initialMonths,
  delinquency,
  merchantCategories,
  summary,
}: RechartsClientShellProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'volume' | 'delinquency' | 'merchants'>('all')
  const [periodMonths, setPeriodMonths] = useState<6 | 12>(12)
  const [volumeChartMode, setVolumeChartMode] = useState<'combined' | 'amount' | 'count'>('combined')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [thresholdPct, setThresholdPct] = useState<number>(15)
  const [alertsFilter, setAlertsFilter] = useState<'all' | 'critical-only'>('all')
  const [alertsSort, setAlertsSort] = useState<'mora-desc' | 'volume-desc' | 'name-asc'>('mora-desc')
  const [pausedRubros, setPausedRubros] = useState<Set<string>>(new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Alertas Críticas y Mapa de Calor calculados dinámicamente según umbral (15% por defecto)
  const alertsSummary: CriticalAlertsSummary = useMemo(() => {
    return calculateCriticalDelinquencyAlerts(merchantCategories, thresholdPct)
  }, [merchantCategories, thresholdPct])

  // Rubros filtrados y ordenados para el mapa de calor
  const displayedAlertRubros = useMemo(() => {
    let list = alertsSummary.categories
    if (alertsFilter === 'critical-only') {
      list = list.filter((c) => c.isCritical)
    }
    const cloned = [...list]
    if (alertsSort === 'mora-desc') {
      cloned.sort((a, b) => b.delinquencyRatePct - a.delinquencyRatePct || b.delinquentVolume - a.delinquentVolume)
    } else if (alertsSort === 'volume-desc') {
      cloned.sort((a, b) => b.delinquentVolume - a.delinquentVolume || b.activePortfolioVolume - a.activePortfolioVolume)
    } else if (alertsSort === 'name-asc') {
      cloned.sort((a, b) => a.category.localeCompare(b.category))
    }
    return cloned
  }, [alertsSummary, alertsFilter, alertsSort])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3500)
  }

  const togglePauseRubro = (cat: string) => {
    setPausedRubros((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
        showToast(`Originación reactivada para el rubro: ${cat}`)
      } else {
        next.add(cat)
        showToast(`Aprobación automática de créditos pausada en comercios de: ${cat}`)
      }
      return next
    })
  }

  const copyAlertReport = (rubro: CriticalAlertRubro) => {
    const report = `[ALERTA DE RIESGO CREDITICIO UNICRÉDITOS]\nRubro: ${rubro.category}\nTasa de Mora: ${rubro.delinquencyRatePct}%\nSaldo en Mora: ${fmtArs(rubro.delinquentVolume)}\nSaldo Activo Total: ${fmtArs(rubro.activePortfolioVolume)}\nComercios Afectados: ${rubro.merchantsCount}\nCréditos Vigentes: ${rubro.activeLoansCount}\nProtocolo: ${rubro.mitigationProtocol}\nFecha: ${new Date().toLocaleString('es-AR')}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(report)
      showToast(`Reporte de ${rubro.category} copiado al portapapeles.`)
    }
  }

  // Filtrar meses según el selector de período
  const filteredMonths = useMemo(() => {
    if (periodMonths === 6) {
      return initialMonths.slice(-6)
    }
    return initialMonths.slice(-12)
  }, [initialMonths, periodMonths])

  // Métricas agregadas del período seleccionado
  const periodSummary = useMemo(() => {
    const totalVolume = filteredMonths.reduce((s, m) => s + m.volumePlaced, 0)
    const totalLoans = filteredMonths.reduce((s, m) => s + m.loansCount, 0)
    const avgTicket = totalLoans > 0 ? Math.round(totalVolume / totalLoans) : 0
    const bestMonth = [...filteredMonths].sort((a, b) => b.volumePlaced - a.volumePlaced)[0]
    return { totalVolume, totalLoans, avgTicket, bestMonth }
  }, [filteredMonths])

  if (!mounted) {
    return (
      <div className="w-full min-h-[420px] flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Cargando gráficos ejecutivos Recharts…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast de confirmación de acciones operativas */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Banner Superior de Alertas Críticas de Cartera */}
      {alertsSummary.hasCriticalAlerts ? (
        <div className="bg-linear-to-r from-red-950 via-slate-900 to-rose-950 p-4 rounded-xl text-white border border-red-700/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-lg bg-red-600/30 border border-red-500/70 text-red-300 animate-pulse">
              <Icon name="alert" size="sm" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-red-300 font-bold">
                  Protocolo de Riesgo Activo
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {alertsSummary.criticalCategoriesCount} rubro{alertsSummary.criticalCategoriesCount > 1 ? 's' : ''} en Alerta Crítica (&gt; {thresholdPct}% mora)
                </span>
              </div>
              <p className="text-xs text-red-100 font-medium mt-1">
                {alertsSummary.criticalCategories.map((c) => `${c.category} (${c.delinquencyRatePct}%)`).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-red-300">Capital en Riesgo Crítico</div>
              <div className="text-sm font-bold text-white">{fmtArs(alertsSummary.totalDelinquentInCriticalSectors)}</div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Ver Mapa de Calor</span>
              <span>↓</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/20 text-slate-800 p-3 rounded-xl border border-emerald-300/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-emerald-950">Semáforo Crediticio Normal:</span>
            <span className="text-emerald-800">
              Todos los rubros comerciales se mantienen por debajo del umbral de alerta crítica ({thresholdPct}%).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
          >
            Abrir Mapa de Calor
          </button>
        </div>
      )}

      {/* Barra de Filtros y Navegación de Vistas */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Selector de pestañas temáticas */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tablero General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'bg-white text-red-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Alertas Críticas (Mapa de Calor)</span>
            {alertsSummary.hasCriticalAlerts && (
              <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-bold">
                {alertsSummary.criticalCategoriesCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('volume')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'volume'
                ? 'bg-white text-emerald-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Volumen Mensual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delinquency')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'delinquency'
                ? 'bg-white text-amber-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Morosidad en Tiempo Real
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('merchants')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'merchants'
                ? 'bg-white text-blue-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Distribución por Comercios
          </button>
        </div>

        {/* Controles de Período y Acciones */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <span className="px-2 text-slate-500 font-medium">Período:</span>
            <button
              type="button"
              onClick={() => setPeriodMonths(6)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                periodMonths === 6
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 meses
            </button>
            <button
              type="button"
              onClick={() => setPeriodMonths(12)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                periodMonths === 12
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 meses
            </button>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            En tiempo real
          </div>
        </div>
      </div>

      {/* KPI Cards Ejecutivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Volumen Colocado */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
            <span>Volumen Colocado ({periodMonths}m)</span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <Icon name="credit" size="xs" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {fmtArs(periodSummary.totalVolume)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>{periodSummary.totalLoans} créditos colocados</span>
            <span className="font-medium text-emerald-600">
              Ticket prom: {fmtArs(periodSummary.avgTicket)}
            </span>
          </div>
        </div>

        {/* KPI 2: Cartera Activa Total */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
            <span>Saldo Vivo Cartera Activa</span>
            <span className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <Icon name="wallet" size="xs" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {fmtArs(delinquency.totalActivePortfolio)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>{delinquency.totalActiveCredits} créditos vigentes</span>
            <span className="font-medium text-blue-600">100% auditado</span>
          </div>
        </div>

        {/* KPI 3: Tasa de Morosidad */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
            <span>Tasa de Morosidad Actual</span>
            <span
              className={`p-1.5 rounded-md ${
                delinquency.overallDelinquencyRate <= 3
                  ? 'bg-emerald-50 text-emerald-600'
                  : delinquency.overallDelinquencyRate <= 6
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              <Icon name="activity" size="xs" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {delinquency.overallDelinquencyRate.toFixed(1)}%
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                delinquency.statusTone === 'healthy'
                  ? 'bg-emerald-100 text-emerald-800'
                  : delinquency.statusTone === 'caution'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {delinquency.statusTone === 'healthy' ? 'Saludable' : delinquency.statusTone === 'caution' ? 'Precaución' : 'Alerta'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>Mora +30d: {delinquency.severeDelinquencyRate.toFixed(1)}%</span>
            <span className="text-slate-500 font-medium">
              {fmtArs(delinquency.totalDelinquentPortfolio)}
            </span>
          </div>
        </div>

        {/* KPI 4: Rubro Líder */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
            <span>Rubro Principal Cartera</span>
            <span className="p-1.5 rounded-md bg-purple-50 text-purple-600">
              <Icon name="store" size="xs" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {summary.topCategoryName}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>{summary.topCategorySharePct.toFixed(1)}% de la cartera</span>
            <span className="font-medium text-purple-600">
              {merchantCategories.length} rubros activos
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE ALERTAS CRÍTICAS Y MAPA DE CALOR POR RUBRO COMERCIAL */}
      {(activeTab === 'all' || activeTab === 'alerts') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          {/* Encabezado y Contexto de Alertas */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-red-100 text-red-700">
                  <Icon name="alert" size="xs" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Alertas Críticas de Cartera · Mapa de Calor por Rubro Comercial
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Monitoreo continuo de riesgo crediticio por rubro de actividad comercial. Los sectores cuya tasa de morosidad supera el umbral del{' '}
                <span className="font-semibold text-red-600">{thresholdPct}%</span> activan advertencias visuales y protocolos de mitigación operativa inmediata.
              </p>
            </div>

            {/* Controles: Umbral de Alerta, Filtro y Acciones */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Selector de Umbral de Sensibilidad */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                <span className="px-2 text-slate-500 font-medium">Umbral Crítico:</span>
                {[10, 15, 20].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setThresholdPct(t)}
                    className={`px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                      thresholdPct === t
                        ? t === 15
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}% {t === 15 ? '(Oficial)' : ''}
                  </button>
                ))}
              </div>

              {/* Filtro: Todos vs Solo Críticos */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAlertsFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    alertsFilter === 'all'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({alertsSummary.totalCategoriesEvaluated})
                </button>
                <button
                  type="button"
                  onClick={() => setAlertsFilter('critical-only')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    alertsFilter === 'critical-only'
                      ? 'bg-red-600 text-white font-semibold shadow-xs'
                      : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  <span>Solo Críticos &gt;{thresholdPct}%</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      alertsFilter === 'critical-only' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {alertsSummary.criticalCategoriesCount}
                  </span>
                </button>
              </div>

              {/* Ordenamiento */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                <span className="px-2 text-slate-500 font-medium">Orden:</span>
                <select
                  value={alertsSort}
                  onChange={(e) => setAlertsSort(e.target.value as 'mora-desc' | 'volume-desc' | 'name-asc')}
                  className="bg-white border-0 text-slate-700 text-xs rounded-md px-2 py-1 font-medium focus:ring-1 focus:ring-slate-300"
                >
                  <option value="mora-desc">Mayor Tasa de Mora (%)</option>
                  <option value="volume-desc">Mayor Saldo en Riesgo ($)</option>
                  <option value="name-asc">Nombre de Rubro (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Leyenda y Escala Térmica */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Escala Térmica de Morosidad:</span>
              <span className="text-slate-500 hidden sm:inline">Intensidad cromática según tasa de mora actual</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500 border border-emerald-600" />
                <span className="text-slate-700">&lt; 5% Saludable</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500 border border-amber-600" />
                <span className="text-slate-700">5% - 9.9% Precaución</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-orange-500 border border-orange-600" />
                <span className="text-slate-700">10% - 14.9% Vigilancia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-red-600 border border-red-700 animate-pulse" />
                <span className="font-bold text-red-700">≥ {thresholdPct}% ALERTA CRÍTICA</span>
              </div>
            </div>
          </div>

          {/* Resumen Ejecutivo de Riesgo de los Rubros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
              <div className="text-slate-500 font-medium">Rubros Evaluados</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{alertsSummary.totalCategoriesEvaluated} rubros</div>
              <div className="text-slate-500 mt-1">
                {summary.currentActivePortfolio ? fmtArs(summary.currentActivePortfolio) : '$ 0'} cartera activa
              </div>
            </div>
            <div
              className={`p-3.5 rounded-lg border ${
                alertsSummary.hasCriticalAlerts ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-slate-500 font-medium">Rubros en Alerta Crítica</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-xl font-bold ${alertsSummary.hasCriticalAlerts ? 'text-red-700' : 'text-slate-900'}`}>
                  {alertsSummary.criticalCategoriesCount} rubro{alertsSummary.criticalCategoriesCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[11px] text-slate-500">(&gt; {thresholdPct}% mora)</span>
              </div>
              <div className="text-slate-600 mt-1">
                {alertsSummary.hasCriticalAlerts ? 'Requieren intervención inmediata' : 'Ningún rubro supera el umbral'}
              </div>
            </div>
            <div
              className={`p-3.5 rounded-lg border ${
                alertsSummary.hasCriticalAlerts ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-slate-500 font-medium">Saldo en Mora en Rubros Críticos</div>
              <div
                className={`text-xl font-bold mt-0.5 ${
                  alertsSummary.hasCriticalAlerts ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {fmtArs(alertsSummary.totalDelinquentInCriticalSectors)}
              </div>
              <div className="text-slate-600 mt-1">
                {alertsSummary.percentOfDelinquencyInCriticalSectors}% de la mora total
              </div>
            </div>
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
              <div className="text-slate-500 font-medium">Mora Máxima Registrada</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{alertsSummary.maxMoraPct.toFixed(1)}%</div>
              <div className="text-slate-500 mt-1">Promedio rubros: {alertsSummary.avgMoraPct.toFixed(1)}%</div>
            </div>
          </div>

          {/* El Mapa de Calor Visual (Heat Map Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider">
                Matriz Térmica de Rubros Comerciales (Heat Map)
              </span>
              <span className="text-slate-500 text-[11px]">
                Mostrando {displayedAlertRubros.length} de {alertsSummary.totalCategoriesEvaluated} rubros
              </span>
            </div>

            {displayedAlertRubros.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                No hay rubros que coincidan con el filtro actual ({alertsFilter === 'critical-only' ? `morosidad > ${thresholdPct}%` : ''}).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedAlertRubros.map((rubro) => {
                  const isPaused = pausedRubros.has(rubro.category)
                  const excessPct = Math.max(0, rubro.delinquencyRatePct - thresholdPct)

                  return (
                    <div
                      key={rubro.categorySlug}
                      className={`p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                        rubro.isCritical
                          ? 'border-red-400 bg-linear-to-b from-red-50/90 via-red-50/40 to-white shadow-xs ring-2 ring-red-400/30'
                          : rubro.heatLevel === 'elevated'
                          ? 'border-orange-300 bg-linear-to-b from-orange-50/60 to-white shadow-2xs'
                          : rubro.heatLevel === 'moderate'
                          ? 'border-amber-300 bg-linear-to-b from-amber-50/50 to-white shadow-2xs'
                          : 'border-emerald-200 bg-linear-to-b from-emerald-50/40 to-white shadow-2xs'
                      }`}
                    >
                      {/* Cabecera de la celda de calor */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate" title={rubro.category}>
                              {rubro.category}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {rubro.merchantsCount} comercio{rubro.merchantsCount !== 1 ? 's' : ''} · {rubro.activeLoansCount} crédito{rubro.activeLoansCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {rubro.isCritical ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-xs animate-pulse">
                              <span>🚨 ALERTA</span>
                            </span>
                          ) : (
                            <span
                              className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${rubro.badgeBgClass} ${rubro.badgeTextClass}`}
                            >
                              {rubro.badgeLabel}
                            </span>
                          )}
                        </div>

                        {/* Tasa de Mora en Display Térmico */}
                        <div className="my-3 p-2.5 rounded-lg bg-white/80 border border-slate-200/60">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[11px] font-medium text-slate-500">Tasa de Morosidad</span>
                            {rubro.isCritical && (
                              <span className="text-[10px] font-bold text-red-600">
                                +{excessPct.toFixed(1)}% sobre umbral
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span
                              className={`text-2xl font-extrabold tracking-tight font-mono ${
                                rubro.isCritical
                                  ? 'text-red-700'
                                  : rubro.heatLevel === 'elevated'
                                  ? 'text-orange-700'
                                  : rubro.heatLevel === 'moderate'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {rubro.delinquencyRatePct.toFixed(1)}%
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ({rubro.shareOfTotalPortfolioPct}% cartera)
                            </span>
                          </div>

                          {/* Termómetro de Morosidad con marca de umbral */}
                          <div className="mt-2 relative">
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, rubro.delinquencyRatePct)}%`,
                                  backgroundColor: rubro.heatHex,
                                }}
                              />
                            </div>
                            {/* Marcador vertical del umbral crítico */}
                            <div
                              className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-red-600 z-10"
                              style={{ left: `${Math.min(100, thresholdPct)}%` }}
                              title={`Umbral crítico ${thresholdPct}%`}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>0%</span>
                            <span className="text-red-600 font-bold">Umbral {thresholdPct}%</span>
                            <span>100%</span>
                          </div>
                        </div>

                        {/* Desglose de saldos financieros */}
                        <div className="space-y-1 text-[11px] text-slate-600 pb-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Saldo en Mora:</span>
                            <span className={`font-semibold ${rubro.isCritical ? 'text-red-700' : 'text-slate-800'}`}>
                              {fmtArs(rubro.delinquentVolume)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Saldo Activo Total:</span>
                            <span className="font-semibold text-slate-800">{fmtArs(rubro.activePortfolioVolume)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Colocado Histórico:</span>
                            <span className="text-slate-600">{fmtArs(rubro.totalPlacedVolume)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción operativa */}
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 mt-2">
                        {rubro.isCritical ? (
                          <>
                            <button
                              type="button"
                              onClick={() => togglePauseRubro(rubro.category)}
                              className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                                isPaused
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  : 'bg-red-600 text-white hover:bg-red-700 shadow-2xs'
                              }`}
                            >
                              {isPaused ? 'Reanudar Scoring' : 'Pausar Scoring'}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyAlertReport(rubro)}
                              title="Copiar reporte del rubro"
                              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                            >
                              <Icon name="receipt" size="xs" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-medium py-0.5">
                            ✓ Operación normal
                          </span>
                        )}
                        <Link
                          href="/admin/comercios"
                          className="py-1 px-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          Ver tiendas →
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Gráfico Recharts: Comparativa de Morosidad vs Umbral Crítico */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Gráfico Comparativo Recharts: Tasa de Morosidad vs. Umbral Crítico ({thresholdPct}%)
                </h4>
                <p className="text-[11px] text-slate-500">
                  La línea roja discontinua delimita la cota de tolerancia fijada en la política de riesgos.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-4 h-0.5 bg-red-600 border-t border-dashed border-red-600" />
                <span className="font-bold text-red-600">Umbral Crítico {thresholdPct}%</span>
              </div>
            </div>

            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={displayedAlertRubros}
                  margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="category"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#475569', fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    unit="%"
                    domain={[0, (dataMax: number) => Math.max(thresholdPct + 10, Math.ceil(dataMax / 10) * 10)]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const r = payload[0].payload as CriticalAlertRubro
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700 max-w-xs">
                          <div className="font-bold text-white border-b border-slate-700 pb-1 flex justify-between gap-4">
                            <span>{r.category}</span>
                            <span className={r.isCritical ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                              {r.isCritical ? 'CRÍTICO' : 'NORMAL'}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Tasa de Morosidad:</span>
                            <span className={`font-bold ${r.isCritical ? 'text-red-400' : 'text-white'}`}>
                              {r.delinquencyRatePct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Saldo en Mora:</span>
                            <span className="font-semibold text-white">{fmtArs(r.delinquentVolume)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Saldo Activo:</span>
                            <span className="font-semibold text-slate-300">{fmtArs(r.activePortfolioVolume)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Comercios:</span>
                            <span className="text-slate-300">{r.merchantsCount} tiendas</span>
                          </div>
                          {r.isCritical && (
                            <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-red-300">
                              ⚠️ Excede el umbral del {thresholdPct}% por +{(r.delinquencyRatePct - thresholdPct).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  {/* Línea de Referencia del Umbral Crítico */}
                  <ReferenceLine
                    y={thresholdPct}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `Umbral Crítico (${thresholdPct}%)`,
                      fill: '#dc2626',
                      fontSize: 11,
                      fontWeight: 'bold',
                      position: 'top',
                    }}
                  />
                  <Bar
                    dataKey="delinquencyRatePct"
                    name="Tasa de Mora (%)"
                    radius={[4, 4, 0, 0]}
                  >
                    {displayedAlertRubros.map((entry) => (
                      <Cell
                        key={entry.categorySlug}
                        fill={entry.heatHex}
                        stroke={entry.isCritical ? '#991b1b' : 'transparent'}
                        strokeWidth={entry.isCritical ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Matriz de Protocolos de Mitigación Operativa para Rubros Críticos */}
          {alertsSummary.hasCriticalAlerts && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Protocolos de Mitigación Operativa Inmediata (Rubros &gt; {thresholdPct}%)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {alertsSummary.criticalCategories.map((crit) => {
                  const isPaused = pausedRubros.has(crit.category)
                  return (
                    <div
                      key={crit.categorySlug}
                      className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{crit.category}</div>
                          <div className="text-[11px] text-red-700 font-semibold mt-0.5">
                            Mora Crítica: {crit.delinquencyRatePct.toFixed(1)}% · Saldo expuesto: {fmtArs(crit.delinquentVolume)}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                          Severidad {crit.delinquencyRatePct >= 25 ? 'Máxima' : 'Alta'}
                        </span>
                      </div>

                      <p className="text-slate-700 text-xs bg-white p-2.5 rounded-lg border border-red-100">
                        <span className="font-bold text-red-800">Protocolo: </span>
                        {crit.mitigationProtocol}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => togglePauseRubro(crit.category)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isPaused
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-red-700 text-white hover:bg-red-800 shadow-xs'
                          }`}
                        >
                          {isPaused ? 'Reanudar Originación' : 'Pausar Originación Automática'}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyAlertReport(crit)}
                          className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Copiar Informe
                        </button>
                        <Link
                          href="/admin/comercios"
                          className="px-3 py-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold ml-auto"
                        >
                          Ver {crit.merchantsCount} comercios adheridos →
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 1: VOLUMEN DE PRÉSTAMOS COLOCADOS POR MES */}
      {(activeTab === 'all' || activeTab === 'volume') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="text-lg font-bold text-slate-900">
                  Volumen de Préstamos Colocados por Mes
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Evolución del capital colocado y número de operaciones originadas en los últimos {periodMonths} meses.
              </p>
            </div>

            {/* Selector de modo de gráfico */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setVolumeChartMode('combined')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  volumeChartMode === 'combined'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Monto + Cantidad
              </button>
              <button
                type="button"
                onClick={() => setVolumeChartMode('amount')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  volumeChartMode === 'amount'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Solo Monto ($)
              </button>
              <button
                type="button"
                onClick={() => setVolumeChartMode('count')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  volumeChartMode === 'count'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Solo Cantidad (#)
              </button>
            </div>
          </div>

          {/* Gráfico Recharts ComposedChart */}
          <div className="w-full h-[360px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredMonths}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="barVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={fmtCompactArs}
                  label={{
                    value: 'Monto Colocado (ARS)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#64748b',
                    fontSize: 11,
                    offset: 0,
                  }}
                />
                {volumeChartMode === 'combined' && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    label={{
                      value: 'Créditos (#)',
                      angle: 90,
                      position: 'insideRight',
                      fill: '#64748b',
                      fontSize: 11,
                      offset: 0,
                    }}
                  />
                )}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const data = payload[0].payload as MonthlyPlacementPoint
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700">
                        <div className="font-bold text-sm text-emerald-400 border-b border-slate-700 pb-1">
                          {data.label}
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Volumen Colocado:</span>
                          <span className="font-semibold text-white">{fmtArs(data.volumePlaced)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Cantidad de Préstamos:</span>
                          <span className="font-semibold text-emerald-300">{data.loansCount} operaciones</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Ticket Promedio:</span>
                          <span className="font-semibold text-slate-200">{fmtArs(data.avgTicket)}</span>
                        </div>
                        {data.growthRatePct !== 0 && (
                          <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                            <span className="text-slate-300">Variación MoM:</span>
                            <span className={`font-semibold ${data.growthRatePct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {data.growthRatePct > 0 ? `+${data.growthRatePct}%` : `${data.growthRatePct}%`}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
                />
                {(volumeChartMode === 'combined' || volumeChartMode === 'amount') && (
                  <Bar
                    yAxisId="left"
                    dataKey="volumePlaced"
                    name="Monto Colocado ($)"
                    fill="url(#barVolumeGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                )}
                {(volumeChartMode === 'combined' || volumeChartMode === 'count') && (
                  <Line
                    yAxisId={volumeChartMode === 'combined' ? 'right' : 'left'}
                    type="monotone"
                    dataKey="loansCount"
                    name="Cantidad de Préstamos"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ fill: '#2563eb', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de desglose mensual */}
          <div className="overflow-x-auto pt-2 border-t border-slate-100">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 font-semibold">Mes</th>
                  <th className="py-2.5 font-semibold text-right">Monto Colocado</th>
                  <th className="py-2.5 font-semibold text-right">Créditos</th>
                  <th className="py-2.5 font-semibold text-right">Ticket Promedio</th>
                  <th className="py-2.5 font-semibold text-right">Variación MoM</th>
                  <th className="py-2.5 font-semibold text-right">Saldo Vivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMonths.map((m) => (
                  <tr key={m.key} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-medium text-slate-800">{m.label}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{fmtArs(m.volumePlaced)}</td>
                    <td className="py-2 text-right text-slate-600">{m.loansCount}</td>
                    <td className="py-2 text-right text-slate-600">{fmtArs(m.avgTicket)}</td>
                    <td className="py-2 text-right">
                      {m.growthRatePct === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : m.growthRatePct > 0 ? (
                        <span className="text-emerald-600 font-semibold">+{m.growthRatePct}%</span>
                      ) : (
                        <span className="text-red-600 font-semibold">{m.growthRatePct}%</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-slate-600">{fmtArs(m.outstandingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: TASA DE MOROSIDAD EN TIEMPO REAL */}
      {(activeTab === 'all' || activeTab === 'delinquency') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo: Donut de Tramos de Mora */}
          <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <h3 className="text-base font-bold text-slate-900">
                    Composición de Cartera en Mora
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Distribución en tiempo real por tramos de días de atraso.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold">
                {delinquency.totalActiveCredits} créditos
              </span>
            </div>

            {/* Gráfico Donut de Tramos */}
            <div className="w-full h-[280px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={delinquency.buckets}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                  >
                    {delinquency.buckets.map((b) => (
                      <Cell key={b.key} fill={b.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const b = payload[0].payload as (typeof delinquency.buckets)[0]
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs space-y-1 shadow-lg border border-slate-700">
                          <div className="font-semibold text-slate-200">{b.label}</div>
                          <div>Monto: <span className="font-bold text-emerald-400">{fmtArs(b.amount)}</span></div>
                          <div>Créditos: <span className="font-bold">{b.count}</span></div>
                          <div>Participación: <span className="font-bold text-amber-400">{b.shareOfPortfolioPct}%</span></div>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Indicador central del Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">
                  {delinquency.overallDelinquencyRate.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  Mora Global
                </span>
              </div>
            </div>

            {/* Lista de tramos con etiquetas y montos */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {delinquency.buckets.map((b) => (
                <div key={b.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span className="font-medium text-slate-700">{b.shortLabel}:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{b.count} ops</span>
                    <span className="font-bold text-slate-900">{fmtArs(b.amount)}</span>
                    <span className="w-12 text-right font-semibold text-slate-600">{b.shareOfPortfolioPct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Derecho: Evolución y Tasa de Morosidad Histórica */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <h3 className="text-base font-bold text-slate-900">
                    Evolución de la Tasa de Morosidad
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Seguimiento de la tasa global y mora severa (+30 días) en cosechas recientes.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                  Objetivo: &lt; 3.5%
                </span>
              </div>
            </div>

            {/* Gráfico Recharts AreaChart */}
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={delinquency.historicalTrend}
                  margin={{ top: 15, right: 20, left: 0, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="moraAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="mora30AreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload as (typeof delinquency.historicalTrend)[0]
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700">
                          <div className="font-bold text-amber-400 border-b border-slate-700 pb-1">
                            {d.monthLabel}
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Tasa Mora Total:</span>
                            <span className="font-semibold text-amber-300">{d.moraRatePct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Tasa Mora +30d:</span>
                            <span className="font-semibold text-red-400">{d.mora30RatePct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">Cartera en Mora:</span>
                            <span className="font-semibold text-white">{fmtArs(d.latePortfolio)}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="moraRatePct"
                    name="Tasa de Mora Total (%)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#moraAreaGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="mora30RatePct"
                    name="Tasa de Mora +30 Días (%)"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#mora30AreaGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Tarjetas resumen de gestión de cobro */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <div className="text-emerald-800 font-semibold">Al día</div>
                <div className="text-base font-bold text-emerald-900 mt-0.5">
                  {fmtArs(delinquency.buckets[0]?.amount || 0)}
                </div>
                <div className="text-emerald-700 text-[11px] mt-0.5">
                  {delinquency.buckets[0]?.shareOfPortfolioPct || 0}% de la cartera
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <div className="text-amber-800 font-semibold">Mora Temprana</div>
                <div className="text-base font-bold text-amber-900 mt-0.5">
                  {fmtArs(delinquency.buckets[1]?.amount || 0)}
                </div>
                <div className="text-amber-700 text-[11px] mt-0.5">Gestión preventiva</div>
              </div>

              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <div className="text-red-800 font-semibold">Mora Crítica (&gt;30d)</div>
                <div className="text-base font-bold text-red-900 mt-0.5">
                  {fmtArs(
                    (delinquency.buckets[2]?.amount || 0) +
                    (delinquency.buckets[3]?.amount || 0) +
                    (delinquency.buckets[4]?.amount || 0)
                  )}
                </div>
                <div className="text-red-700 text-[11px] mt-0.5">Cobranza prejudicial</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: DISTRIBUCIÓN DE CARTERA POR TIPO DE COMERCIO */}
      {(activeTab === 'all' || activeTab === 'merchants') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="text-lg font-bold text-slate-900">
                  Distribución de Cartera por Tipo de Comercio
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Participación, saldo colocado y tasa de morosidad segmentada por rubro comercial adherido.
              </p>
            </div>
            <Link
              href="/admin/comercios"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Icon name="store" size="xs" />
              Ver Comercios Adheridos
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gráfico Donut de Participación por Tipo de Comercio */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 self-start">
                Participación en la Cartera Activa (%)
              </h4>
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={merchantCategories}
                      dataKey="activePortfolioVolume"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      onClick={(entry: unknown) => {
                        const rec = entry as { category?: string; payload?: { category?: string } } | null
                        const cat = rec?.payload?.category ?? rec?.category ?? null
                        setSelectedCategory(cat)
                      }}
                    >
                      {merchantCategories.map((c) => (
                        <Cell
                          key={c.categorySlug}
                          fill={c.color}
                          stroke={selectedCategory === c.category ? '#0f172a' : '#ffffff'}
                          strokeWidth={selectedCategory === c.category ? 3 : 2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        const cat = payload[0].payload as MerchantCategoryMetric
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700">
                            <div className="font-bold text-blue-400 border-b border-slate-700 pb-1">
                              {cat.category}
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300">Saldo Activo:</span>
                              <span className="font-semibold text-white">{fmtArs(cat.activePortfolioVolume)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300">Participación:</span>
                              <span className="font-bold text-blue-300">{cat.shareOfTotalPortfolioPct}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300">Tasa Mora del Rubro:</span>
                              <span className="font-bold text-amber-400">{cat.delinquencyRatePct}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300">Comercios:</span>
                              <span className="font-semibold text-slate-300">{cat.merchantsCount} tiendas</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Click en un sector del gráfico para resaltar el rubro.
              </p>
            </div>

            {/* Gráfico de Barras: Saldo Activo vs Volumen Colocado por Rubro */}
            <div className="lg:col-span-7">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Comparativa: Saldo Activo y Total Colocado por Rubro ($ ARS)
              </h4>
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={merchantCategories}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 30, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={fmtCompactArs}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fill: '#475569', fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        const cat = payload[0].payload as MerchantCategoryMetric
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700">
                            <div className="font-bold text-white border-b border-slate-700 pb-1">
                              {cat.category}
                            </div>
                            <div>Saldo Activo: <span className="font-bold text-emerald-400">{fmtArs(cat.activePortfolioVolume)}</span></div>
                            <div>Total Colocado: <span className="font-bold text-blue-400">{fmtArs(cat.totalPlacedVolume)}</span></div>
                            <div>Mora en el Rubro: <span className="font-bold text-amber-400">{cat.delinquencyRatePct}%</span></div>
                          </div>
                        )
                      }}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
                    <Bar
                      dataKey="activePortfolioVolume"
                      name="Saldo Activo"
                      fill="#0284c7"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="totalPlacedVolume"
                      name="Colocado Histórico"
                      fill="#94a3b8"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabla detallada de rubros y comercios */}
          <div className="overflow-x-auto pt-2 border-t border-slate-100">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 font-semibold">Tipo de Comercio / Rubro</th>
                  <th className="py-2.5 font-semibold text-right">Comercios</th>
                  <th className="py-2.5 font-semibold text-right">Créditos Activos</th>
                  <th className="py-2.5 font-semibold text-right">Saldo Activo</th>
                  <th className="py-2.5 font-semibold text-right">Participación (%)</th>
                  <th className="py-2.5 font-semibold text-right">Ticket Promedio</th>
                  <th className="py-2.5 font-semibold text-right">Tasa Mora Rubro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {merchantCategories.map((c) => {
                  const isSelected = selectedCategory === c.category
                  return (
                    <tr
                      key={c.categorySlug}
                      onClick={() => setSelectedCategory(isSelected ? null : c.category)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="font-semibold text-slate-800">{c.category}</span>
                      </td>
                      <td className="py-2.5 text-right text-slate-600">{c.merchantsCount}</td>
                      <td className="py-2.5 text-right text-slate-600">{c.activeLoansCount}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900">{fmtArs(c.activePortfolioVolume)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, c.shareOfTotalPortfolioPct)}%`, backgroundColor: c.color }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700">{c.shareOfTotalPortfolioPct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-slate-600">{fmtArs(c.avgTicket)}</td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            c.delinquencyRatePct <= 3
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.delinquencyRatePct <= 6
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {c.delinquencyRatePct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
