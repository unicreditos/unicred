import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { PrintDocButton } from '@/components/merchant-orders/print-doc-button'
import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import { merchant, merchantSettlement } from '@/lib/db/schema'
import { formatARS, formatCBU } from '@/lib/finance'
import { formatPayDate } from '@/lib/merchant-orders/rules'
import { loadOrders } from '@/lib/merchant-orders/service'
import { eq } from 'drizzle-orm'

const fdate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—'

/** Comprobante de liquidación semanal al comercio: lo ve el comercio dueño y el backoffice. */
export async function SettlementDocument({ id, canView }: { id: string; canView: (merchantUserId: string) => boolean }) {
  await ensureMerchantCommerceSchema()
  const [row] = await db
    .select({ s: merchantSettlement, m: merchant })
    .from(merchantSettlement)
    .innerJoin(merchant, eq(merchant.id, merchantSettlement.merchantId))
    .where(eq(merchantSettlement.id, id))
    .limit(1)
  if (!row || !canView(row.m.userId)) return null
  const { s, m } = row
  const orders = await loadOrders({ settlementId: s.id })

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
        <PrintDocButton />
      </div>
      <DocumentSheet>
        <DocumentLetterhead
          kind="liquidacion"
          title="Liquidación a comercio adherido"
          subtitle={`${m.legalName || m.businessName} · CUIT ${m.cuit}`}
          number={s.code}
          issuedAt={fdate(s.createdAt)}
          validUntil={formatPayDate(s.payDate)}
          validUntilLabel="Fecha de pago"
          status={s.status === 'paid' ? 'Pagada' : 'Programada'}
          statusTone={s.status === 'paid' ? 'ok' : 'warn'}
        />
        <DocumentSection number="1" title="Resumen">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Operaciones" value={String(s.orderCount)} mono />
            <DocumentField label="Ventas (precio de contado)" value={formatARS(s.grossAmount)} mono />
            <DocumentField label="Anticipos cobrados por UNICRÉDITOS" value={formatARS(s.downPaymentsAmount)} mono />
            <DocumentField label="Financiado por UNICRÉDITOS" value={formatARS(s.financedAmount)} mono />
            <DocumentField label="Comisión del comercio" value={`− ${formatARS(s.commissionAmount)}`} mono />
            <DocumentField label="Neto a transferir" value={formatARS(s.netAmount)} mono />
          </DocumentFieldGrid>
        </DocumentSection>
        <DocumentSection number="2" title="Cuenta de destino y pago">
          <DocumentFieldGrid cols={2}>
            <DocumentField label="CBU / CVU" value={s.payoutCbu ? formatCBU(s.payoutCbu) : 'A informar por el comercio'} mono />
            <DocumentField label="Titular" value={s.payoutHolder ?? m.legalName ?? m.businessName} />
            <DocumentField label="Estado" value={s.status === 'paid' ? `Transferida el ${fdate(s.paidAt)}` : `Se transfiere el ${formatPayDate(s.payDate)}`} />
            <DocumentField label="N.º de operación bancaria" value={s.transferReference ?? '—'} mono />
          </DocumentFieldGrid>
        </DocumentSection>
        <DocumentSection number="3" title="Detalle de operaciones entregadas">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Operación</th>
                <th>Entrega</th>
                <th>Cliente</th>
                <th className="num">Precio</th>
                <th className="num">Comisión</th>
                <th className="num">Neto</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono">{o.code}</td>
                  <td>{fdate(o.deliveredAt)}</td>
                  <td>{o.customerName ?? '—'}</td>
                  <td className="num">{formatARS(o.totalAmount)}</td>
                  <td className="num">{formatARS(o.commissionAmount)}</td>
                  <td className="num">{formatARS(o.netAmount)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={3}>Total</td>
                <td className="num">{formatARS(s.grossAmount)}</td>
                <td className="num">{formatARS(s.commissionAmount)}</td>
                <td className="num">{formatARS(s.netAmount)}</td>
              </tr>
            </tbody>
          </table>
        </DocumentSection>
        <DocumentFooter
          documentId={s.id}
          extra="Liquidación de ventas financiadas: el anticipo del 30% lo cobra UNICRÉDITOS al cliente y el saldo se financia con un crédito a nombre del cliente. El riesgo de cobro de las cuotas es de UNICRÉDITOS."
        />
      </DocumentSheet>
    </main>
  )
}
