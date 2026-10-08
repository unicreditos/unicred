import { redirect } from 'next/navigation'
import { Icon } from '@/components/uc/icons'
import { KpiGrid, PageHead, SectionTitle, TodoList } from '@/components/uc/blocks'
import { loadDesk } from '@/lib/admin-desk/load'
import { daysBetween, fdatetime, fmtInt, money } from '@/lib/uc/format'

export const metadata = { title: 'Vista rápida' }

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

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  if (tab && Object.hasOwn(LEGACY_TABS, tab)) redirect(LEGACY_TABS[tab])

  const { state } = await loadDesk()
  const now = new Date()

  const active = state.credits.filter((c) => c.status === 'active')
  const last30 = active.filter((c) => c.disbursedAt && daysBetween(c.disbursedAt, now) <= 30).length
  const pending = state.applications.filter((a) => a.status === 'pending')
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

  return (
    <>
      <PageHead title="Vista rápida" description={`Resumen de la cartera al ${fdatetime(now)} h`} />
      <KpiGrid
        items={[
          {
            href: '/admin/creditos/otorgados',
            label: 'Préstamos vigentes',
            value: fmtInt(active.length),
            amount: money(sum(active, (c) => c.amount)),
            amountLabel: 'importe total otorgado',
            foot: (
              <>
                <span className="uc-trend-up uc-num">+{last30}</span> otorgados en los últimos 30 días
              </>
            ),
          },
          {
            href: '/admin/originacion/solicitudes',
            label: 'Créditos pendientes de emisión',
            value: pending.length,
            amount: money(sum(pending, (a) => a.amount)),
            amountLabel: 'solicitado',
            foot: (
              <>
                <Icon name="clock" size="xs" /> Sin aprobar · <span className="uc-num">{inFinance}</span> en revisión de Finanzas
              </>
            ),
          },
          {
            href: '/admin/cobranzas/mora',
            label: 'Cartera en mora',
            value: late.length,
            amount: money(sum(late, (c) => c.principalOutstanding)),
            amountLabel: 'saldo en mora',
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
            amountLabel: 'a transferir',
            foot: (
              <>
                <Icon name="clip" size="xs" /> <span className="uc-num">{noCbu}</span> sin CBU/CVU cargado
              </>
            ),
          },
        ]}
      />

      <SectionTitle title="Pendientes de acción" aside="Lo que necesita a alguien del equipo hoy" />
      <TodoList
        items={[
          {
            href: '/admin/originacion/aprobaciones',
            sev: 'var(--uc-warning)',
            count: pending.length,
            txt: 'Solicitudes esperan revisión manual de Finanzas',
            small: 'Las que el scoring no resolvió solo: las decide una persona de Finanzas',
          },
          {
            href: '/admin/cobranzas/comprobantes',
            sev: 'var(--uc-accent)',
            count: transfers,
            txt: 'Transferencias de clientes por conciliar',
            small: 'Verificá el movimiento en el extracto bancario antes de acreditar la cuota',
          },
          {
            href: '/admin/cobranzas/mora',
            sev: 'var(--uc-danger)',
            count: tr[1] + tr[2],
            txt: 'Créditos con más de 30 días de atraso',
            small: 'Derivar a gestión de cobranzas',
          },
          {
            href: '/admin/originacion/kyc',
            sev: 'var(--uc-info)',
            count: kycOpen,
            txt: 'Validaciones de identidad en curso',
            small: 'Esperando el resultado de la verificación biométrica',
          },
        ]}
      />
    </>
  )
}
