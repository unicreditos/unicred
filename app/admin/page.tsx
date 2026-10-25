import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/uc/icons'
import { Badge, ButtonLink, CardHead, Grid, KpiGrid, PageHead, Pad, SectionTitle, TodoList } from '@/components/uc/blocks'
import { AdminSummaryCard } from '@/components/admin/admin-summary-card'
import { calculateSummaryMetrics, resolveDateRange, type PeriodPreset } from '@/lib/admin-desk/date-filter'
import { loadDesk } from '@/lib/admin-desk/load'
import { clientIndex, fullName } from '@/lib/uc/admin'
import { daysBetween, fdate, fdatetime, fmtInt, money } from '@/lib/uc/format'

export const metadata = { title: 'Centro de Control' }

/** Enlaces viejos del tipo /admin?tab=creditos que siguen en notificaciones y mails. */
const LEGACY_TABS: Record<string, string> = {
  creditos: '/admin/originacion/solicitudes',
  kyc: '/admin/originacion/kyc',
  desembolsos: '/admin/creditos/desembolso',
  cartera_activa: '/admin/creditos/otorgados',
  logs_auditoria: '/admin/sistema/auditoria',
  clientes: '/admin/clientes/planilla',
  pagos: '/admin/cobranzas/pagos',
  comercios: '/admin/comercios',
  reclamos: '/admin/sistema/soporte',
}

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    period?: string
    from?: string
    to?: string
  }>
}) {
  const { tab, period, from, to } = await searchParams
  if (tab && Object.hasOwn(LEGACY_TABS, tab)) redirect(LEGACY_TABS[tab])

  const { state, degraded } = await loadDesk()
  const now = new Date()
  const idx = clientIndex(state)

  if (degraded) {
    return (
      <PageHead
        title="Centro de Control · Backoffice"
        description="No se pudo leer la cartera en la base de datos. Recargá la página: no se muestran ceros en lugar de los créditos reales."
      />
    )
  }

  const active = state.credits.filter((c) => c.status === 'active')
  const last30 = active.filter((c) => c.disbursedAt && daysBetween(c.disbursedAt, now) <= 30).length
  const pending = state.applications.filter((a) => a.status === 'pending')

  // Rango activo y métricas para el resumen de solicitudes y desembolsos
  const initialPreset = (period as PeriodPreset) || 'current_month'
  const activeRange = resolveDateRange(initialPreset, from, to, now)
  const summaryMetrics = calculateSummaryMetrics(
    state.applications,
    state.credits,
    state.disbursements,
    activeRange,
  )

  const kycOk = new Set(state.clients.filter((c) => c.kycStatus === 'verified').map((c) => c.id))
  const inFinance = pending.filter((a) => kycOk.has(a.clientId)).length
  const late = active.filter((c) => c.bucket !== 'al_dia')
  const tr = [
    late.filter((c) => c.bucket === '1_30').length,
    late.filter((c) => c.bucket === '31_60').length,
    late.filter((c) => c.bucket === '61_90' || c.bucket === '90_plus').length,
  ]
  const colors = ['var(--uc-warning)', 'color-mix(in srgb,var(--uc-warning) 45%,var(--uc-danger))', 'var(--uc-danger)']
  const queued = state.disbursements.filter((d) => d.status === 'queued' || d.status === 'processing')
  const noCbu = queued.filter((d) => !d.cbu).length
  const transfers = state.payments.filter((p) => p.status === 'pending' && p.channel === 'transferencia').length
  const kycOpen = state.kyc.filter((k) => k.status === 'pending' || k.status === 'in_review').length
  const pct = (n: number) => (late.length ? ((n / late.length) * 100).toFixed(1) : '0')

  // Actividad reciente de cartera (pagos acreditados y solicitudes)
  const recentPayments = state.payments
    .slice(0, 6)
    .map((p) => {
      const client = idx.get(p.clientId)
      return {
        id: p.id,
        at: p.paidAt,
        clientName: fullName(client),
        detail: p.channel === 'mercadopago' ? 'Cobranza Mercado Pago' : 'Transferencia bancaria',
        amount: p.amount,
        status: p.status === 'reconciled' || p.status === 'matched' ? 'Acreditado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
        tone: p.status === 'reconciled' || p.status === 'matched' ? 'success' as const : p.status === 'pending' ? 'info' as const : 'danger' as const,
      }
    })

  return (
    <>
      <PageHead
        title="Centro de Control · Backoffice"
        description={`Cartera activa y operaciones al ${fdatetime(now)} h`}
        actions={
          <div className="uc-cta-row" style={{ gap: 10 }}>
            <ButtonLink href="/admin/panel-control">Panel Ejecutivo</ButtonLink>
            <ButtonLink href="/admin/clientes/planilla">Planilla de clientes</ButtonLink>
            <ButtonLink href="/admin/finanzas/resumen">Balance y tesorería</ButtonLink>
            <ButtonLink primary href="/admin/originacion/solicitudes">Ver solicitudes</ButtonLink>
          </div>
        }
      />

      <KpiGrid
        items={[
          {
            href: '/admin/creditos/otorgados',
            label: 'Préstamos vigentes',
            value: fmtInt(active.length),
            amount: money(sum(active, (c) => c.amount)),
            amountLabel: 'importe total colocado',
            foot: (
              <>
                <span className="uc-trend-up uc-num">+{last30}</span> otorgados en últimos 30 días
              </>
            ),
          },
          {
            href: '/admin/originacion/solicitudes',
            label: 'Solicitudes en revisión',
            value: pending.length,
            amount: money(sum(pending, (a) => a.amount)),
            amountLabel: 'solicitado en cartera',
            foot: (
              <>
                <Icon name="clock" size="xs" /> <span className="uc-num">{inFinance}</span> listas para decisión de Finanzas
              </>
            ),
          },
          {
            href: '/admin/originacion/solicitudes',
            label: 'Solicitudes procesadas',
            value: fmtInt(summaryMetrics.totalProcessed),
            amount: money(summaryMetrics.totalDisbursed),
            amountLabel: initialPreset === 'current_month' ? 'desembolsado este mes' : `desembolsado (${activeRange.label})`,
            testId: 'summary-card-processed-applications',
            ariaLabel: `Solicitudes procesadas: ${summaryMetrics.totalProcessed}. Desembolsado: ${money(summaryMetrics.totalDisbursed)}`,
            foot: (
              <>
                <span className="uc-trend-up uc-num">+{summaryMetrics.totalProcessed}</span> en periodo · <span className="uc-num">{summaryMetrics.disbursedCount}</span> desembolsadas
              </>
            ),
          },
          {
            href: '/admin/cobranzas/mora',
            label: 'Cartera en mora',
            value: late.length,
            amount: money(sum(state.collections, (c) => c.overdueAmount)),
            amountLabel: 'vencido a recuperar',
            extra: (
              <div className="uc-buckets" aria-label="Mora por tramo de días de atraso">
                <div className="uc-bucket-bar">
                  {tr.map((n, i) => (
                    <i key={i} style={{ width: `${pct(n)}%`, background: colors[i] }} />
                  ))}
                </div>
                <div className="uc-bucket-legend uc-num">
                  {['hasta 30', '31–60', 'más de 60'].map((l, i) => (
                    <span key={l}>
                      <b>{tr[i]}</b> {l} d
                    </span>
                  ))}
                </div>
              </div>
            ),
          },
          {
            href: '/admin/creditos/desembolso',
            label: 'Desembolsos pendientes',
            money: true,
            value: money(sum(queued, (d) => d.amount)),
            amount: `${queued.length} créditos`,
            amountLabel: 'en cola bancaria',
            foot: (
              <>
                <Icon name="clip" size="xs" /> <span className="uc-num">{noCbu}</span> sin CBU validado
              </>
            ),
          },
        ]}
      />

      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 rounded-xl text-white flex flex-wrap items-center justify-between gap-4 shadow-xs border border-slate-700 my-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Panel Ejecutivo de cartera
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Visualización avanzada de métricas clave en tiempo real
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl">
            Gráficos interactivos de volumen de préstamos colocados por mes, tasa de morosidad en tiempo real, distribución de cartera por comercio y sección de Alertas Críticas (&gt;15% mora) con mapa de calor.
          </p>
        </div>
        <Link
          href="/admin/panel-control"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md"
        >
          <Icon name="chart" size="xs" />
          Abrir Panel Ejecutivo &rarr;
        </Link>
      </div>

      <AdminSummaryCard
        applications={state.applications}
        credits={state.credits}
        disbursements={state.disbursements}
        initialPreset={initialPreset}
        initialFrom={from || ''}
        initialTo={to || ''}
      />

      <div className="uc-section-gap" />

      <Grid cols="21">
        <div>
          <SectionTitle title="Bandeja de decisiones operativas" aside="Acciones que requieren intervención del equipo" />
          <TodoList
            items={[
              {
                href: '/admin/originacion/aprobaciones',
                sev: 'var(--uc-warning)',
                count: pending.length,
                txt: 'Solicitudes listas para decisión de Finanzas',
                small: 'Casos que requieren aprobación o rechazo manual fundado',
              },
              {
                href: '/admin/cobranzas/comprobantes',
                sev: 'var(--uc-accent)',
                count: transfers,
                txt: 'Comprobantes de transferencia por conciliar',
                small: 'Cotejar extracto bancario antes de acreditar la cuota en sistema',
              },
              {
                href: '/admin/cobranzas/mora',
                sev: 'var(--uc-danger)',
                count: tr[1] + tr[2],
                txt: 'Créditos con más de 30 días de atraso',
                small: 'Gestión de cobranza activa y aviso prejudicial',
              },
              {
                href: '/admin/originacion/kyc',
                sev: 'var(--uc-info)',
                count: kycOpen,
                txt: 'Validaciones biométricas en revisión',
                small: 'Verificaciones de identidad Didit pendientes de confirmar',
              },
            ]}
          />
        </div>

        <div>
          <SectionTitle title="Monitoreo de cobranzas recientes" aside="Últimas operaciones" />
          <Pad>
            <CardHead title="Movimientos acreditados" aside={<Link href="/admin/cobranzas/pagos">Ver todos</Link>} />
            {recentPayments.length > 0 ? (
              <ul className="uc-feed">
                {recentPayments.map((p) => (
                  <li key={p.id}>
                    <span className="uc-fi">
                      <Icon name="check" size="sm" />
                    </span>
                    <span className="uc-ft">
                      <b>{p.clientName}</b>
                      <small>
                        {p.detail} {p.at ? `· ${fdate(p.at)}` : ''}
                      </small>
                    </span>
                    <span className="uc-fa">
                      <b className="uc-num">{money(p.amount)}</b>
                      <span style={{ display: 'block', marginTop: 2 }}>
                        <Badge tone={p.tone}>{p.status}</Badge>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="uc-note">No se registran movimientos recientes.</p>
            )}
          </Pad>
        </div>
      </Grid>

      <SectionTitle title="Accesos directos de gestión" aside="Navegación rápida por módulo" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        {[
          { title: 'Originación', desc: `${state.applications.length} solicitudes`, href: '/admin/originacion/solicitudes', icon: 'origin' as const },
          { title: 'Aprobaciones', desc: `${pending.length} pendientes`, href: '/admin/originacion/aprobaciones', icon: 'check' as const },
          { title: 'Identidad KYC', desc: `${state.kyc.length} validaciones`, href: '/admin/originacion/kyc', icon: 'user' as const },
          { title: 'Créditos Activos', desc: `${active.length} vigentes`, href: '/admin/creditos/otorgados', icon: 'credit' as const },
          { title: 'Desembolsos', desc: `${queued.length} en cola`, href: '/admin/creditos/desembolso', icon: 'clip' as const },
          { title: 'Contratos', desc: `${state.contracts.length} emitidos`, href: '/admin/creditos/contratos', icon: 'file' as const },
          { title: 'Cobranzas & Mora', desc: `${late.length} en atraso`, href: '/admin/cobranzas/mora', icon: 'wallet' as const },
          { title: 'Planilla Clientes', desc: `${state.clients.length} usuarios`, href: '/admin/clientes/planilla', icon: 'users' as const },
          { title: 'Auditoría Legal', desc: 'Registro inmutable', href: '/admin/sistema/auditoria', icon: 'lock' as const },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="uc-card"
            style={{
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ color: 'var(--uc-text)', fontSize: 14 }}>{item.title}</b>
              <Icon name={item.icon} size="xs" style={{ color: 'var(--uc-accent)' }} />
            </div>
            <span className="uc-num" style={{ fontSize: 12, color: 'var(--uc-text-muted)' }}>
              {item.desc}
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
