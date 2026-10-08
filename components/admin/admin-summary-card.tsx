'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/uc/icons'
import { Badge, ButtonLink } from '@/components/uc/blocks'
import { money, fmtInt } from '@/lib/uc/format'
import type { Credit, Disbursement, LoanApplication } from '@/lib/admin-desk/types'
import {
  type PeriodPreset,
  calculateSummaryMetrics,
  resolveDateRange,
  toInputDate,
} from '@/lib/admin-desk/date-filter'

interface AdminSummaryCardProps {
  applications: LoanApplication[]
  credits: Credit[]
  disbursements: Disbursement[]
  initialPreset?: PeriodPreset
  initialFrom?: string
  initialTo?: string
}

const PRESETS: { id: PeriodPreset; label: string; testId: string }[] = [
  { id: 'current_month', label: 'Este mes', testId: 'preset-current-month' },
  { id: 'last_30_days', label: 'Últimos 30 días', testId: 'preset-last-30-days' },
  { id: 'last_month', label: 'Mes anterior', testId: 'preset-last-month' },
  { id: 'quarter', label: 'Trimestre', testId: 'preset-quarter' },
  { id: 'year', label: 'Este año', testId: 'preset-year' },
  { id: 'all', label: 'Histórico', testId: 'preset-all' },
  { id: 'custom', label: 'Personalizado', testId: 'preset-custom' },
]

export function AdminSummaryCard({
  applications,
  credits,
  disbursements,
  initialPreset = 'current_month',
  initialFrom = '',
  initialTo = '',
}: AdminSummaryCardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [preset, setPreset] = useState<PeriodPreset>(initialPreset)
  const [customFrom, setCustomFrom] = useState(initialFrom)
  const [customTo, setCustomTo] = useState(initialTo)
  const [appliedCustomFrom, setAppliedCustomFrom] = useState(initialFrom)
  const [appliedCustomTo, setAppliedCustomTo] = useState(initialTo)

  const fromInputId = useId()
  const toInputId = useId()

  // Calcular rango activo
  const range = resolveDateRange(
    preset,
    preset === 'custom' ? appliedCustomFrom : undefined,
    preset === 'custom' ? appliedCustomTo : undefined,
  )

  // Calcular métricas según el rango
  const metrics = calculateSummaryMetrics(applications, credits, disbursements, range)

  const updateUrl = (newPreset: PeriodPreset, fromStr?: string, toStr?: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (newPreset === 'current_month') {
      params.delete('period')
      params.delete('from')
      params.delete('to')
    } else {
      params.set('period', newPreset)
      if (newPreset === 'custom') {
        if (fromStr) params.set('from', fromStr)
        else params.delete('from')
        if (toStr) params.set('to', toStr)
        else params.delete('to')
      } else {
        params.delete('from')
        params.delete('to')
      }
    }
    const query = params.toString()
    const nextUrl = query ? `/admin?${query}` : '/admin'
    startTransition(() => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', nextUrl)
      }
      router.replace(nextUrl, { scroll: false })
    })
  }

  const handleSelectPreset = (p: PeriodPreset) => {
    setPreset(p)
    if (p !== 'custom') {
      updateUrl(p)
    } else {
      // Si pasa a custom y no hay fechas seleccionadas, inicializar con el rango previo
      if (!customFrom && range.from) {
        const fromIso = toInputDate(range.from)
        setCustomFrom(fromIso)
        setAppliedCustomFrom(fromIso)
      }
      if (!customTo && range.to) {
        const toIso = toInputDate(range.to)
        setCustomTo(toIso)
        setAppliedCustomTo(toIso)
      }
      updateUrl('custom', customFrom || toInputDate(range.from), customTo || toInputDate(range.to))
    }
  }

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setPreset('custom')
    setAppliedCustomFrom(customFrom)
    setAppliedCustomTo(customTo)
    updateUrl('custom', customFrom, customTo)
  }

  const handleReset = () => {
    setPreset('current_month')
    setCustomFrom('')
    setCustomTo('')
    setAppliedCustomFrom('')
    setAppliedCustomTo('')
    updateUrl('current_month')
  }

  return (
    <div
      className="uc-card"
      data-testid="processed-applications-summary-card"
      style={{
        padding: '22px 24px',
        background: 'linear-gradient(135deg, var(--uc-surface) 0%, color-mix(in srgb, var(--uc-accent) 6%, var(--uc-surface)) 100%)',
        border: '1px solid color-mix(in srgb, var(--uc-accent) 25%, var(--uc-border))',
        borderRadius: 'var(--uc-radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Encabezado y Selector de Fechas */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid color-mix(in srgb, var(--uc-border) 80%, transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'color-mix(in srgb, var(--uc-accent) 15%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--uc-accent)',
              flexShrink: 0,
            }}
          >
            <Icon name="cal" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--uc-text-muted)',
                }}
              >
                Resumen de Originación & Desembolsos
              </span>
              <Badge tone="info">Filtro de periodo</Badge>
            </div>
            <div
              data-testid="active-period-label"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--uc-text)',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Periodo:</span>
              <b style={{ color: 'var(--uc-accent)' }}>{range.label}</b>
            </div>
          </div>
        </div>

        {/* Selector de Presets de Rango de Fecha */}
        <div
          data-testid="summary-card-date-range-selector"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <div className="uc-chips" role="toolbar" aria-label="Seleccionar rango de fechas">
            {PRESETS.map((p) => {
              const active = preset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  className="uc-chip"
                  data-testid={p.testId}
                  aria-pressed={active}
                  onClick={() => handleSelectPreset(p.id)}
                  style={{
                    cursor: 'pointer',
                    fontSize: 12.5,
                    padding: '5px 11px',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {preset !== 'current_month' && (
            <button
              type="button"
              className="uc-link-btn"
              data-testid="date-range-reset-btn"
              onClick={handleReset}
              style={{ fontSize: 12, marginLeft: 4 }}
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Inputs para Rango Personalizado (si está activo) */}
      {preset === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          data-testid="custom-date-range-inputs"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--uc-surface-2)',
            borderRadius: 8,
            border: '1px solid var(--uc-border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--uc-text-muted)' }}>
            Personalizar fechas:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor={fromInputId} style={{ fontSize: 12, color: 'var(--uc-text-muted)' }}>
              Desde:
            </label>
            <input
              id={fromInputId}
              type="date"
              data-testid="date-range-from-input"
              className="uc-field uc-num"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ height: 32, fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor={toInputId} style={{ fontSize: 12, color: 'var(--uc-text-muted)' }}>
              Hasta:
            </label>
            <input
              id={toInputId}
              type="date"
              data-testid="date-range-to-input"
              className="uc-field uc-num"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ height: 32, fontSize: 13 }}
            />
          </div>
          <button
            type="submit"
            className="uc-btn uc-btn-primary"
            data-testid="date-range-apply-btn"
            style={{ height: 32, padding: '0 14px', fontSize: 13 }}
          >
            Aplicar rango
          </button>
        </form>
      )}

      {/* Grid de Métricas Principales */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {/* Métrica 1: Solicitudes Procesadas */}
        <div
          style={{
            background: 'var(--uc-surface)',
            border: '1px solid var(--uc-border)',
            borderRadius: 10,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--uc-text-muted)' }}>
              Solicitudes procesadas en el periodo
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <span
                className="uc-num"
                data-testid="total-processed-applications"
                style={{ fontSize: 28, fontWeight: 750, color: 'var(--uc-text)', lineHeight: 1.1 }}
              >
                {fmtInt(metrics.totalProcessed)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--uc-text-muted)' }}>
                resueltas
              </span>
            </div>
          </div>

          {/* Desglose de solicitudes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
            <Badge tone="success">{fmtInt(metrics.approvedCount)} aprobadas</Badge>
            <Badge tone="danger">{fmtInt(metrics.rejectedCount)} rechazadas</Badge>
            {metrics.cancelledCount > 0 && (
              <Badge tone="neutral">{fmtInt(metrics.cancelledCount)} anuladas</Badge>
            )}
            <span style={{ color: 'var(--uc-text-subtle)', marginLeft: 'auto', fontSize: 11.5 }}>
              de {fmtInt(metrics.allProcessedCount)} históricas
            </span>
          </div>
        </div>

        {/* Métrica 2: Monto Total Desembolsado */}
        <div
          style={{
            background: 'var(--uc-surface)',
            border: '1px solid var(--uc-border)',
            borderRadius: 10,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--uc-text-muted)' }}>
              Monto total desembolsado en el periodo
            </div>
            <div style={{ marginTop: 4 }}>
              <span
                className="uc-num"
                data-testid="total-disbursed-amount"
                style={{ fontSize: 26, fontWeight: 750, color: 'var(--uc-text)', lineHeight: 1.1 }}
              >
                {money(metrics.totalDisbursed)}
              </span>
              {/* Compatibilidad con testid de mes actual */}
              {preset === 'current_month' && (
                <span
                  data-testid="total-disbursed-current-month"
                  style={{ display: 'none' }}
                >
                  {money(metrics.totalDisbursed)}
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12.5,
              color: 'var(--uc-text-muted)',
            }}
          >
            <div>
              <b className="uc-num" data-testid="disbursed-applications-count" style={{ color: 'var(--uc-text)' }}>
                {fmtInt(metrics.disbursedCount)}
              </b>{' '}
              créditos liquidados
            </div>
            {metrics.disbursedCount > 0 && (
              <div style={{ fontSize: 12, color: 'var(--uc-text-subtle)' }}>
                Ticket prom: <span className="uc-num">{money(metrics.avgDisbursed)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Métrica 3: Efectividad & Ratios de Originación */}
        <div
          style={{
            background: 'var(--uc-surface)',
            border: '1px solid var(--uc-border)',
            borderRadius: 10,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--uc-text-muted)' }}>
              Tasa de aprobación del periodo
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span
                className="uc-num"
                style={{ fontSize: 26, fontWeight: 750, color: 'var(--uc-text)', lineHeight: 1.1 }}
              >
                {metrics.approvalRate}%
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--uc-text-muted)' }}>
                ({metrics.approvedCount} de {metrics.totalProcessed})
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: 'var(--uc-text-subtle)' }}>
              Histórico desembolsado: <b className="uc-num" style={{ color: 'var(--uc-text)' }}>{money(metrics.allDisbursedAmount)}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Pie de tarjeta con accesos rápidos */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 12,
          borderTop: '1px solid color-mix(in srgb, var(--uc-border) 60%, transparent)',
          fontSize: 13,
          color: 'var(--uc-text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="check" size="xs" />
          <span>
            Datos agregados en tiempo real calculados desde <code style={{ fontSize: 12 }}>state.applications</code>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ButtonLink href="/admin/originacion/solicitudes" style={{ padding: '6px 14px', fontSize: 13 }}>
            Ver solicitudes
          </ButtonLink>
          <ButtonLink href="/admin/creditos/desembolso" style={{ padding: '6px 14px', fontSize: 13 }}>
            Ver desembolsos
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
