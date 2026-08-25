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
import { formatARSDecimal, formatCBU, formatCVU, formatPercent } from '@/lib/finance'

export type ReceiptDocData = {
  id: string
  receiptNumber: string
  receiptType: 'payment' | 'disbursement' | 'loan_approved' | 'partial_payment' | string
  issuedAt: Date | string
  paidAt?: Date | string | null
  amount: string | number
  currency: string
  method: string | null
  referenceNumber: string | null
  loanSnapshot?: Record<string, unknown> | null
  installmentSnapshot?: Record<string, unknown> | null
  previousBalance?: string | number | null
  newBalance?: string | number | null
  pendingInstallments?: number | null
  totalPaidToDate?: string | number | null
  customerSnapshot?: Record<string, unknown> | null
  bankAccountSnapshot?: Record<string, unknown> | null
  branding?: {
    company?: string
    cuit?: string | null
    address?: string
    website?: string
  }
}

function typeMeta(type: string) {
  if (type === 'disbursement') {
    return {
      title: 'Comprobante de acreditación',
      subtitle: 'Constancia de desembolso en cuenta declarada',
      amountLabel: 'Importe acreditado',
      note: 'El prestamista registró la acreditación del capital. Este comprobante no implica transferencia automática desde UNICRÉDITOS.',
    }
  }
  if (type === 'loan_approved') {
    return {
      title: 'Constancia de aprobación',
      subtitle: 'Crédito aprobado — sin movimiento de fondos',
      amountLabel: 'Capital aprobado',
      note: 'Documento informativo. El desembolso se acredita cuando tesorería confirma la cuenta del titular.',
    }
  }
  if (type === 'partial_payment') {
    return {
      title: 'Recibo de pago parcial',
      subtitle: 'Imputación a cuota o saldo',
      amountLabel: 'Importe imputado',
      note: 'El saldo pendiente se actualiza según este pago.',
    }
  }
  return {
    title: 'Recibo de pago',
    subtitle: 'Cuota o cancelación registrada',
    amountLabel: 'Importe percibido',
    note: 'Pago registrado en UNICRÉDITOS. Conservá este comprobante.',
  }
}

function asText(value: unknown) {
  if (value == null || value === '') return '—'
  return String(value)
}

function money(value: unknown) {
  if (value == null || value === '') return formatARSDecimal(0)
  return formatARSDecimal(value as string | number)
}

export function PaymentReceiptPrintable({ receipt }: { receipt: ReceiptDocData }) {
  const meta = typeMeta(receipt.receiptType)
  const loan = receipt.loanSnapshot ?? {}
  const inst = receipt.installmentSnapshot ?? {}
  const customer = receipt.customerSnapshot ?? {}
  const bank = receipt.bankAccountSnapshot
  const isPayment = receipt.receiptType === 'payment' || receipt.receiptType === 'partial_payment'
  const branding = receipt.branding ?? {}

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="recibo"
        title={meta.title}
        subtitle={meta.subtitle}
        number={receipt.receiptNumber}
        issuedAt={docDateTime(receipt.issuedAt)}
        status="Original"
        statusTone="ok"
      />

      <DocumentSection number="01" title="Importe y operación">
        <div className="border border-slate-200 bg-slate-50 px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {meta.amountLabel} · {receipt.currency || 'ARS'}
          </p>
          <p className="doc-amount mt-1 font-mono font-semibold tracking-tight text-slate-900">
            {money(receipt.amount)}
          </p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-600">{meta.note}</p>
        </div>
        <div className="mt-3">
          <DocumentFieldGrid cols={3}>
            {receipt.receiptType !== 'loan_approved' ? (
              <DocumentField
                label="Fecha de acreditación"
                value={docDateTime(receipt.paidAt ?? receipt.issuedAt)}
              />
            ) : null}
            <DocumentField label="Medio" value={paymentMethodLabel(receipt.method)} />
            <DocumentField label="Referencia" value={receipt.referenceNumber ?? '—'} mono />
            {loan.id ? <DocumentField label="Préstamo" value={asText(loan.id)} mono /> : null}
            {isPayment && inst.number != null ? (
              <DocumentField
                label="Cuota"
                value={`${asText(inst.number)} de ${asText(loan.term ?? '—')}`}
              />
            ) : null}
            {receipt.pendingInstallments != null ? (
              <DocumentField
                label="Cuotas pendientes"
                value={String(receipt.pendingInstallments)}
              />
            ) : null}
          </DocumentFieldGrid>
        </div>
      </DocumentSection>

      <DocumentSection number="02" title="Titular">
        <DocumentFieldGrid>
          <DocumentField label="Nombre" value={asText(customer.name)} />
          <DocumentField label="CUIL" value={asText(customer.cuil)} mono />
          <DocumentField label="DNI" value={asText(customer.dni)} mono />
          <DocumentField label="Correo" value={asText(customer.email)} />
          <DocumentField
            label="Domicilio"
            value={[customer.address, customer.city, customer.province].filter(Boolean).join(', ') || '—'}
          />
          <DocumentField label="Teléfono" value={asText(customer.phone)} />
        </DocumentFieldGrid>
      </DocumentSection>

      {isPayment && (loan.principal != null || inst.amount != null) ? (
        <DocumentSection number="03" title="Préstamo e imputación">
          <div className="doc-split gap-4">
            <table className="doc-table">
              <thead>
                <tr>
                  <th colSpan={2}>Préstamo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Capital</td>
                  <td className="num">{money(loan.principal)}</td>
                </tr>
                <tr>
                  <td>Plazo</td>
                  <td className="num">{asText(loan.term)} cuotas</td>
                </tr>
                <tr>
                  <td>TNA</td>
                  <td className="num">{loan.tna != null ? formatPercent(loan.tna as string | number) : '—'}</td>
                </tr>
                <tr className="total">
                  <td>Total del préstamo</td>
                  <td className="num">{money(loan.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
            <table className="doc-table">
              <thead>
                <tr>
                  <th colSpan={2}>Este pago</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cuota</td>
                  <td className="num">
                    {asText(inst.number)} / {asText(loan.term)}
                  </td>
                </tr>
                <tr>
                  <td>Vencimiento</td>
                  <td className="num">{docDate(inst.dueDate as Date | string | undefined)}</td>
                </tr>
                <tr>
                  <td>Importe de cuota</td>
                  <td className="num">{money(inst.amount ?? receipt.amount)}</td>
                </tr>
                <tr>
                  <td>Saldo antes</td>
                  <td className="num">{money(receipt.previousBalance ?? 0)}</td>
                </tr>
                <tr className="total">
                  <td>Saldo después</td>
                  <td className="num">{money(receipt.newBalance ?? 0)}</td>
                </tr>
                <tr>
                  <td>Pagado a la fecha</td>
                  <td className="num">{money(receipt.totalPaidToDate ?? receipt.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </DocumentSection>
      ) : null}

      {receipt.receiptType === 'disbursement' && bank ? (
        <DocumentSection number="03" title="Cuenta de destino">
          <DocumentFieldGrid>
            <DocumentField label="Entidad" value={asText(bank.bankName)} />
            <DocumentField label="Tipo" value={asText(bank.accountType).toUpperCase()} />
            {bank.cbu ? <DocumentField label="CBU" value={formatCBU(String(bank.cbu))} mono /> : null}
            {bank.cvu ? <DocumentField label="CVU" value={formatCVU(String(bank.cvu))} mono /> : null}
            {bank.alias ? <DocumentField label="Alias" value={asText(bank.alias)} mono /> : null}
            <DocumentField label="Titular" value={asText(bank.holderName)} />
            <DocumentField label="CUIL titular" value={asText(bank.holderCuil)} mono />
          </DocumentFieldGrid>
        </DocumentSection>
      ) : null}

      <DocumentFooter
        documentId={receipt.id}
        extra={`${branding.company ?? BRAND.company} · CUIT ${branding.cuit ?? legalCuitLabel()}. Recibo interno del acreedor. La discriminación de capital e interés está en la liquidación de cuota.`}
      />
    </DocumentSheet>
  )
}
