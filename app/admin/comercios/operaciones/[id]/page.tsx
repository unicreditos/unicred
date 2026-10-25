import { CancelOrderForm, DownPaymentReview } from '@/app/admin/comercios/operaciones/_forms'
import { BackLink, Badge, CardHead, Grid, Kv, NoAccess, PageHead, Pad } from '@/components/uc/blocks'
import { loadDeskChrome } from '@/lib/admin-desk/load'
import { DOWN_PAYMENT_LABEL, formatPayDate, ORDER_STAGE_LABEL, type DownPaymentStatus } from '@/lib/merchant-orders/rules'
import { getOrder } from '@/lib/merchant-orders/service'
import { fdate, money } from '@/lib/uc/format'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Operación de comercio' }
export const dynamic = 'force-dynamic'

export default async function OperacionComercioPage({ params }: { params: Promise<{ id: string }> }) {
  const { perms } = await loadDeskChrome()
  if (!perms.has('merchants.read') && !perms.has('payments.read')) return <NoAccess what="las ventas en comercios" />
  const { id } = await params
  const o = await getOrder(id)
  if (!o) notFound()
  const canReconcile = perms.has('payments.reconcile')
  const canCancel = perms.has('merchants.write') && !o.deliveredAt && !o.cancelledAt && o.stage !== 'rechazada'

  return (
    <>
      <BackLink href="/admin/comercios/operaciones">Ventas en comercios</BackLink>
      <PageHead
        title={`Operación ${o.code}`}
        description={`${o.merchantName} · ${o.customerName ?? 'Cliente'} · cargada el ${fdate(o.createdAt)}`}
        actions={<Badge tone={o.stage === 'rechazada' ? 'danger' : o.stage === 'en_revision' ? 'info' : o.stage === 'esperando_cliente' ? 'warning' : 'success'}>{ORDER_STAGE_LABEL[o.stage]}</Badge>}
      />
      <Grid cols="21">
        <div style={{ display: 'grid', gap: 20 }}>
          <Pad>
            <CardHead title="Productos" />
            <table className="uc-dt" style={{ width: '100%' }}>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.productId}>
                    <td>{i.quantity}× {i.name}</td>
                    <td className="uc-num" style={{ textAlign: 'right' }}>{money(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Kv
              rows={[
                ['Precio de contado', money(Number(o.totalAmount))],
                ['Anticipo 30% (cobra UNICRÉDITOS)', money(Number(o.downPaymentAmount))],
                ['Financiado (crédito al cliente)', `${money(Number(o.financedAmount))} · ${o.term} × ${money(o.installmentAmount)}`],
                [`Comisión del comercio (${Number(o.commissionRate).toLocaleString('es-AR')}%)`, money(Number(o.commissionAmount))],
                ['Neto a liquidar al comercio', money(Number(o.netAmount))],
              ]}
            />
          </Pad>
          <Pad>
            <CardHead title="Crédito y entrega" />
            <Kv
              rows={[
                ['Crédito', <a key="l" href={`/admin/originacion/solicitudes/${o.loanId}`}>{o.loanId}</a>],
                ['Estado del crédito', o.loanStatus],
                ['Contrato', o.contractSigned ? 'Firmado' : 'Sin firmar'],
                ['Entrega', o.deliveredAt ? `Entregado el ${fdate(o.deliveredAt)}` : 'Pendiente'],
                ['Liquidación', o.settlementPayDate ? `${formatPayDate(o.settlementPayDate)} · ${o.settlementStatus === 'paid' ? 'pagada' : 'programada'}` : '—'],
                ['Origen', o.origin === 'online' ? 'Pedido online del cliente' : 'Cargada en el local'],
                ...(o.cancelledAt ? ([['Anulada', `${fdate(o.cancelledAt)} · ${o.cancelReason ?? ''}`]] as Array<[string, string]>) : []),
              ]}
            />
          </Pad>
        </div>
        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <Pad>
            <CardHead title="Anticipo" aside={<Badge tone={o.downPaymentStatus === 'confirmed' ? 'success' : o.downPaymentStatus === 'reported' ? 'warning' : 'neutral'}>{DOWN_PAYMENT_LABEL[o.downPaymentStatus as DownPaymentStatus]}</Badge>} />
            <Kv
              rows={[
                ['Importe', money(Number(o.downPaymentAmount))],
                ['Medio', o.downPaymentMethod === 'mp_qr' ? 'QR Mercado Pago' : o.downPaymentMethod === 'transferencia' ? 'Transferencia' : '—'],
                ['Referencia', o.downPaymentReference ?? '—'],
                ['Informado', o.downPaymentReportedAt ? fdate(o.downPaymentReportedAt) : '—'],
                ['Acreditado', o.downPaidAt ? fdate(o.downPaidAt) : '—'],
              ]}
            />
            {o.downPaymentProof ? (
              <p style={{ marginTop: 12 }}>
                <a className="uc-btn uc-sm" href={`/api/admin/merchant-orders/${o.id}/proof`} target="_blank" rel="noreferrer">Ver comprobante</a>
              </p>
            ) : null}
            {o.downPaymentStatus === 'reported' && canReconcile && !o.cancelledAt ? (
              <div style={{ marginTop: 16 }}>
                <DownPaymentReview orderId={o.id} amount={money(Number(o.downPaymentAmount))} />
              </div>
            ) : null}
          </Pad>
          {canCancel ? (
            <Pad>
              <CardHead title="Anular operación" />
              <CancelOrderForm orderId={o.id} refundNeeded={o.downPaymentStatus === 'confirmed'} />
            </Pad>
          ) : null}
        </div>
      </Grid>
    </>
  )
}
