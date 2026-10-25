import type { Metadata } from 'next'
import Link from 'next/link'
import { PageTitle } from '@/components/wallet/page-width'
import { QrReconcileButton } from '@/components/admin/qr-reconcile-button'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MP_METHOD_LABELS, QR_MATCH_LABELS, QR_PAYMENT_STATUS_BADGE, QR_PAYMENT_STATUS_LABELS, label } from '@/lib/credit/labels'
import { formatDateTime } from '@/lib/format'
import { mpConfigured } from '@/lib/mercadopago/client'
import { getQrAdminOverview } from '@/lib/mercadopago/admin'
import { formatMoney } from '@/lib/money'
import { getAdminPermissions, requirePagePermission } from '@/lib/rbac'

export const metadata: Metadata = { title: 'Cobros QR' }
export const dynamic = 'force-dynamic'

export default async function AdminQrPage() {
  const adminId = await requirePagePermission('finance.read')
  const perms = await getAdminPermissions(adminId)
  const { kpi, payments, boxes } = await getQrAdminOverview()
  const enabled = mpConfigured()

  const cards = [
    { l: 'Cajas activas', v: `${kpi.posActive} de ${kpi.posTotal}`, sub: 'Una por persona, en Mercado Pago' },
    { l: 'Cobrado por QR', v: formatMoney(kpi.collected), sub: `${kpi.credited} pagos · devuelto ${formatMoney(kpi.reversed)}` },
    { l: 'Comisión de Mercado Pago', v: formatMoney(kpi.fees), sub: 'Costo de los pagos acreditados' },
    { l: 'Para revisar', v: String(kpi.unmatched + kpi.reversalPending), sub: `${kpi.unmatched} sin asignar · ${kpi.reversalPending} devoluciones pendientes`, href: '/admin/conciliacion' },
    { l: 'QR esperando pago', v: String(kpi.openOrders), sub: `${kpi.pending} pagos en proceso` },
  ]

  return (
    <>
      <PageTitle
        eyebrow="Tesorería"
        title="Cobros QR"
        description="Cada persona cobra con su propia caja en Mercado Pago. Lo que le pagan se acredita en su billetera cuando Mercado Pago lo confirma."
        actions={perms.has('payments.reconcile') && enabled ? <QrReconcileButton /> : undefined}
      />

      {!enabled ? (
        <Alert variant="warning" className="mb-6">
          Mercado Pago no está configurado en este entorno (faltan <code>MERCADO_PAGO_ACCESS_TOKEN</code> y <code>MERCADO_PAGO_USER_ID</code>). Las personas no pueden abrir cajas ni generar QR.
        </Alert>
      ) : null}

      <dl className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.l} className="p-4">
            <dt className="text-[13px] text-muted-foreground">{c.l}</dt>
            <dd className="tnum mt-1 text-lg font-semibold">
              {c.href ? <Link href={c.href} className="hover:underline">{c.v}</Link> : c.v}
            </dd>
            <dd className="mt-0.5 text-[13px] text-muted-foreground">{c.sub}</dd>
          </Card>
        ))}
      </dl>

      <section aria-labelledby="pagos" className="mb-8">
        <h2 id="pagos" className="mb-3 text-lg font-semibold">Pagos recibidos</h2>
        <Card className="overflow-x-auto">
          <table className="data-table min-w-[52rem]">
            <caption className="sr-only">Últimos pagos recibidos por QR</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Persona</th>
                <th scope="col">Pago en Mercado Pago</th>
                <th scope="col" className="num">Pagado</th>
                <th scope="col" className="num">Acreditado</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground">Todavía no hay pagos.</td></tr>
              ) : (
                payments.map(({ p, name, email }) => (
                  <tr key={p.mpPaymentId}>
                    <td className="text-muted-foreground">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                    <td>
                      {p.userId ? <Link href={`/admin/billeteras/${p.userId}`} className="font-medium text-primary hover:underline">{name}</Link> : <span className="text-warning">Sin asignar</span>}
                      <div className="text-muted-foreground">{email ?? p.posExternalId ?? ''}</div>
                    </td>
                    <td className="tnum">
                      {p.mpPaymentId}
                      <div className="text-muted-foreground">{p.paymentMethod ? label(MP_METHOD_LABELS, p.paymentMethod) : ''}{p.matchedBy ? ` · asignado ${label(QR_MATCH_LABELS, p.matchedBy)}` : ''}</div>
                    </td>
                    <td className="tnum text-right">{formatMoney(p.amount)}</td>
                    <td className="tnum text-right font-semibold">
                      {p.creditedAmount ? formatMoney(p.creditedAmount) : '—'}
                      {Number(p.reversedAmount) > 0 ? <div className="text-xs font-normal text-destructive">− {formatMoney(p.reversedAmount)}</div> : null}
                    </td>
                    <td>
                      <Badge variant={QR_PAYMENT_STATUS_BADGE[p.status] ?? 'secondary'}>{label(QR_PAYMENT_STATUS_LABELS, p.status)}</Badge>
                      {p.note ? <div className="mt-1 max-w-64 text-xs text-muted-foreground">{p.note}</div> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="cajas">
        <h2 id="cajas" className="mb-3 text-lg font-semibold">Cajas de cobro</h2>
        <Card className="overflow-x-auto">
          <table className="data-table min-w-[44rem]">
            <caption className="sr-only">Cajas de cobro por persona</caption>
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Caja</th>
                <th scope="col">Código en Mercado Pago</th>
                <th scope="col" className="num">QR con importe</th>
                <th scope="col" className="num">Cobrado</th>
                <th scope="col">Alta</th>
              </tr>
            </thead>
            <tbody>
              {boxes.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground">Nadie activó su caja todavía.</td></tr>
              ) : (
                boxes.map(({ pos, name, collected, orders }) => (
                  <tr key={pos.id}>
                    <td><Link href={`/admin/billeteras/${pos.userId}`} className="font-medium text-primary hover:underline">{name}</Link></td>
                    <td>{pos.name} {pos.status !== 'active' ? <Badge variant="destructive">Suspendida</Badge> : null}</td>
                    <td className="tnum text-muted-foreground">{pos.externalId}</td>
                    <td className="tnum text-right">{orders}</td>
                    <td className="tnum text-right font-semibold">{formatMoney(collected)}</td>
                    <td className="text-muted-foreground">{formatDateTime(pos.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </>
  )
}
