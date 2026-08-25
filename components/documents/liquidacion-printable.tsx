import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { BRAND, legalCuitLabel } from '@/lib/brand'
import { docDate, docDateTime, paymentMethodLabel } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import { frenchInstallmentSplit } from '@/lib/legal/money-words'

export type LiquidacionData = {
  id: string
  number: string
  issuedAt: Date | string
  paidAt?: Date | string | null
  amount: string | number
  method?: string | null
  reference?: string | null
  customer: { name?: string | null; cuil?: string | null; dni?: string | null; email?: string | null }
  loan: {
    id?: string
    principal?: string | number
    term?: number
    monthlyRate?: string | number
    tna?: string | number
  }
  installment?: { number?: number; dueDate?: Date | string; amount?: string | number } | null
}

export function LiquidacionPrintable({ data }: { data: LiquidacionData }) {
  const amount = Number(data.amount) || 0
  const principal = Number(data.loan.principal) || 0
  const term = Number(data.loan.term) || 0
  const rate = Number(data.loan.monthlyRate) || 0
  const n = Number(data.installment?.number) || 1
  const split =
    principal && term && rate
      ? frenchInstallmentSplit(principal, rate, term, n)
      : { installment: amount, interest: 0, capital: amount, balance: 0 }

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="liquidacion"
        title="Liquidación de cuota"
        subtitle="Comprobante interno del acreedor · no es factura electrónica AFIP"
        number={data.number}
        issuedAt={docDateTime(data.issuedAt)}
        status="Original"
        statusTone="ok"
      />

      <DocumentSection number="01" title="Titular y operación">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Deudor" value={data.customer.name ?? '—'} />
          <DocumentField label="CUIL" value={data.customer.cuil ?? '—'} mono />
          <DocumentField label="DNI" value={data.customer.dni ?? '—'} mono />
          <DocumentField label="Préstamo" value={data.loan.id ?? '—'} mono />
          <DocumentField label="Cuota" value={data.installment?.number != null ? `${data.installment.number} / ${term || '—'}` : '—'} />
          <DocumentField label="Vencimiento" value={docDate(data.installment?.dueDate)} />
          <DocumentField label="Medio" value={paymentMethodLabel(data.method)} />
          <DocumentField label="Referencia" value={data.reference ?? '—'} mono />
          <DocumentField label="Acreditación" value={docDateTime(data.paidAt ?? data.issuedAt)} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Discriminación">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th className="num">Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Amortización de capital (devolución del préstamo/mutuo, no gravada como venta)</td>
              <td className="num">{formatARSDecimal(split.capital)}</td>
            </tr>
            <tr>
              <td>Interés compensatorio del período (sistema francés)</td>
              <td className="num">{formatARSDecimal(split.interest)}</td>
            </tr>
            <tr className="total">
              <td>Total imputado en esta liquidación</td>
              <td className="num">{formatARSDecimal(amount)}</td>
            </tr>
            <tr>
              <td>Saldo de capital estimado después de esta cuota</td>
              <td className="num">{formatARSDecimal(split.balance)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {BRAND.legalName} (CUIT {legalCuitLabel()}, {BRAND.iva}) liquida esta cuota como
          acreedor del préstamo (mutuo). <strong>Este documento no es factura electrónica ni tiene CAE.</strong>{' '}
          Si corresponde emitir factura de intereses u otro comprobante fiscal, se hace por el
          controlador o webservice AFIP, con CAE propio. Conservá este instrumento junto al
          recibo de pago.
        </p>
      </DocumentSection>

      <DocumentFooter
        documentId={data.id}
        extra={`TNA informada ${data.loan.tna ?? '—'}%. La imputación sigue el orden del contrato: costas, punitorios, intereses, capital.`}
      />
    </DocumentSheet>
  )
}
