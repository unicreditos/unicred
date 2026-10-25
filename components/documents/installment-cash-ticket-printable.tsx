import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { barcodeSvg, formatBarcodeHuman, itfBarcodeSvg } from '@/lib/coupon'
import { publicBrandWebsite } from '@/lib/brand'
import { docDateShort, docDateTime } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import type { InstallmentCashTicket } from '@/lib/payments/installment-mp-ticket'

function networkBarcodeSvg(digits: string) {
  try {
    return digits.length % 2 === 0
      ? itfBarcodeSvg(digits, { height: 52 })
      : barcodeSvg(digits, { height: 52, module: 1, showText: false, fit: true })
  } catch {
    return null
  }
}

export function InstallmentCashTicketPrintable({
  ticket,
  holderName,
  cuotaLabel,
  loanRef,
  amount,
  dueDate,
}: {
  ticket: InstallmentCashTicket
  holderName: string
  cuotaLabel: string
  loanRef: string
  amount: number
  dueDate: Date | string
}) {
  const svg = ticket.barcode ? networkBarcodeSvg(ticket.barcode) : null
  const site = publicBrandWebsite().replace(/^https?:\/\//, '')

  return (
    <DocumentSheet className="print-page">
      <DocumentLetterhead
        kind="recibo"
        title={`Cupón ${ticket.label}`}
        subtitle="Presentá este cupón en la red antes del vencimiento. El pago se acredita cuando Mercado Pago confirma el cobro."
        number={ticket.operationNumber ?? ticket.paymentId.slice(-12)}
        issuedAt={docDateTime(new Date())}
        status={`Vence ${docDateShort(ticket.expiresAt)}`}
        statusTone="warn"
      />

      <DocumentSection number="01" title="Cuota">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Titular" value={holderName} />
          <DocumentField label="Crédito" value={loanRef} mono />
          <DocumentField label="Cuota" value={cuotaLabel} />
          <DocumentField label="Vencimiento cuota" value={docDateShort(dueDate)} />
          <DocumentField label="Importe a pagar" value={formatARSDecimal(amount)} mono />
          <DocumentField label="Red de cobro" value={ticket.label} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Cupón de pago">
        <div className="rounded-lg border-2 border-brand-navy-800 bg-white p-4">
          <p className="text-center text-sm font-bold uppercase tracking-wide text-brand-navy-800">{ticket.label}</p>
          {svg ? (
            <div
              className="mx-auto mt-3 max-w-md"
              dangerouslySetInnerHTML={{ __html: svg }}
              aria-label={`Código de barras ${ticket.label}`}
            />
          ) : null}
          {ticket.barcode ? (
            <p className="mt-2 break-all text-center font-mono text-[11px] leading-snug text-slate-800">
              {ticket.barcode}
            </p>
          ) : null}
          {ticket.operationNumber ? (
            <p className="mt-3 text-center text-sm text-slate-700">
              Nº de pago{' '}
              <span className="font-mono text-base font-bold text-brand-navy-900">
                {formatBarcodeHuman(ticket.operationNumber)}
              </span>
            </p>
          ) : null}
          <p className="mt-3 text-center text-xs text-slate-600">
            Válido hasta <strong>{docDateShort(ticket.expiresAt)}</strong>
          </p>
        </div>
      </DocumentSection>

      <DocumentFooter
        documentId={ticket.paymentId}
        extra={`Cobro procesado por Mercado Pago (${ticket.label}). ${site}`}
      />
    </DocumentSheet>
  )
}
