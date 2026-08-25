import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { barcodeSvg, couponCode, formatBarcodeHuman, formatOperationNumber, installmentPayUrl } from '@/lib/coupon'
import { db } from '@/lib/db'
import { loan } from '@/lib/db/schema'
import { ensureLoanCouponMpQrs } from '@/lib/payments/installment-mp-qr'
import { ensureLoanCouponTickets, type InstallmentCashTicket } from '@/lib/payments/installment-mp-ticket'
import { treasuryForClient } from '@/lib/treasury'
import { BRAND, publicBrandWebsite } from '@/lib/brand'
import { docDate, docDateShort, docShortId, installmentStatusLabel } from '@/lib/document-format'
import { formatARSDecimal, formatCBU, formatPercent } from '@/lib/finance'
import type { ContractDocData, InstallmentDoc } from '@/lib/legal/types'
import { eq } from 'drizzle-orm'
import QRCode from 'qrcode'

function isOpenCoupon(status: string) {
  return status !== 'paid' && status !== 'cancelled'
}

function couponBookCode(loanId: string) {
  return `CUP-${docShortId(String(loanId).replace(/^loan[_-]/i, ''))}`
}

function publicSiteHost() {
  return publicBrandWebsite().replace(/^https?:\/\//, '')
}

function formatPersonId(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
  if (digits.length >= 7 && digits.length <= 8) return Number(digits).toLocaleString('es-AR')
  return raw || '—'
}

function customerAddress(customer: ContractDocData['customer']) {
  if (!customer) return '—'
  const parts = [customer.address, customer.city, customer.province].map((part) => String(part ?? '').trim()).filter(Boolean)
  return parts.join(', ') || '—'
}

function fitBarcode(value: string, height = 52) {
  try {
    return barcodeSvg(value, { height, module: 1, showText: false, fit: true })
  } catch {
    return null
  }
}

function PrintBarcode({ value, height = 52 }: { value: string; height?: number }) {
  const svg = fitBarcode(value, height)
  return (
    <div className="cuponera-barcode">
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="cuponera-missing">No se pudo dibujar el código de barras.</p>}
      <p className="cuponera-barcode-number">{formatBarcodeHuman(value)}</p>
    </div>
  )
}

function NetworkCouponBand({
  label,
  ticket,
  qr,
}: {
  label: string
  ticket: InstallmentCashTicket | null
  qr: string | null
}) {
  const operation = ticket?.operationNumber?.replace(/\s+/g, '') || null
  const barcode = ticket?.barcode?.replace(/\s+/g, '') || null
  const barcodeIsOperation = Boolean(operation && barcode && operation === barcode)
  return (
    <section className="cuponera-network">
      <div className="cuponera-network-head">
        <strong>{label}</strong>
        {ticket?.expiresAt ? <span>Válido hasta {docDateShort(ticket.expiresAt)}</span> : null}
      </div>
      {operation ? (
        <div className="cuponera-op">
          <p className="cuponera-op-label">Nº de operación</p>
          <p className="cuponera-op-number">{formatOperationNumber(operation)}</p>
          <p className="cuponera-op-hint">Dictá este número en la caja. En muchos locales no piden el código de barras.</p>
        </div>
      ) : null}
      {barcode && !barcodeIsOperation ? (
        <>
          <p className="cuponera-kicker">Código de barras</p>
          <PrintBarcode value={barcode} height={48} />
        </>
      ) : null}
      {!operation && !barcode && qr ? (
        <div className="cuponera-network-fallback">
          <img src={qr} alt={`Ticket ${label}`} />
          <p>No hay número de operación. Mostrá este QR en el local.</p>
        </div>
      ) : null}
      {!operation && !barcode && !qr ? (
        <p className="cuponera-missing">
          Cupón no emitido. Reimprimí esta cuponera o pagá en {publicSiteHost()}.
        </p>
      ) : null}
    </section>
  )
}

function CouponTalon({
  index,
  total,
  bookCode,
  contract,
  row,
  code,
  qr,
  payUrl,
  cash,
  pagoFacilQr,
  rapipagoQr,
  treasury,
  qrError,
}: {
  index: number
  total: number
  bookCode: string
  contract: ContractDocData
  row: InstallmentDoc
  code: string
  qr: string | null
  payUrl: string
  cash: { pagoFacil: InstallmentCashTicket | null; rapipago: InstallmentCashTicket | null } | null
  pagoFacilQr: string | null
  rapipagoQr: string | null
  treasury: ReturnType<typeof treasuryForClient>
  qrError: string | null
}) {
  const term = contract.loan.term
  const overdue = row.status === 'overdue'
  return (
    <article className={`cuponera-coupon${overdue ? ' is-overdue' : ''}`}>
      <header className="cuponera-coupon-head">
        <div>
          <p className="cuponera-brand">UNICRÉDITOS</p>
          <p className="cuponera-book">{bookCode}</p>
        </div>
        <div className="cuponera-coupon-head-meta">
          <p className="cuponera-talon-index">
            Talón {index} de {total}
          </p>
          <p className="cuponera-quota">
            Cuota {String(row.number).padStart(2, '0')} / {String(term).padStart(2, '0')}
          </p>
        </div>
      </header>

      <p className="cuponera-holder">
        {contract.customer?.name ?? 'Titular no informado'}
        {contract.customer?.dni ? ` · DNI ${formatPersonId(contract.customer.dni)}` : ''}
        {contract.customer?.cuil ? ` · CUIL ${formatPersonId(contract.customer.cuil)}` : ''}
      </p>

      <div className="cuponera-amount-row">
        <div>
          <p className="cuponera-kicker">Importe de esta cuota</p>
          <p className="cuponera-amount">{formatARSDecimal(row.amount)}</p>
        </div>
        <div className="cuponera-due">
          <p className="cuponera-kicker">Vencimiento</p>
          <p className="cuponera-due-date">{docDateShort(row.dueDate)}</p>
          <p className={`cuponera-status${overdue ? ' is-overdue' : ''}`}>{installmentStatusLabel(row.status)}</p>
        </div>
      </div>

      <div className="cuponera-pay-grid">
        <div className="cuponera-qr-col">
          {qr ? (
            <>
              <img src={qr} alt={`QR Mercado Pago de la cuota ${row.number}`} className="cuponera-qr" />
              <p className="cuponera-qr-caption">QR Mercado Pago</p>
            </>
          ) : (
            <p className="cuponera-missing">{qrError || 'QR Mercado Pago no emitido'}</p>
          )}
        </div>
        <div className="cuponera-pay-copy">
          <p className="cuponera-kicker">Cómo pagar</p>
          <ol>
            <li>Escaneá el QR con Mercado Pago u otra billetera.</li>
            <li>En Pago Fácil o Rapipago dictá el Nº de operación o mostrá el código de barras.</li>
            <li>Por transferencia usá el CBU o alias y el concepto de abajo.</li>
          </ol>
          <p className="cuponera-kicker">Código UNICRÉDITOS</p>
          <PrintBarcode value={code} height={40} />
        </div>
      </div>

      <NetworkCouponBand label="Pago Fácil" ticket={cash?.pagoFacil ?? null} qr={pagoFacilQr} />
      <NetworkCouponBand label="Rapipago" ticket={cash?.rapipago ?? null} qr={rapipagoQr} />

      <footer className="cuponera-coupon-foot">
        <p>
          <strong>Transferencia {treasury.bank}</strong>
          {' · '}
          {treasury.holder} · CUIT {treasury.cuit}
        </p>
        <p className="cuponera-mono">
          CBU {formatCBU(treasury.cbu)}
          {treasury.alias ? ` · Alias ${treasury.alias}` : ''}
          {' · '}N° {treasury.accountNumber}
        </p>
        <p className="cuponera-mono">Concepto / referencia: {code}</p>
        {payUrl ? <p className="cuponera-mono">Pagar en la web: {payUrl.replace(/^https?:\/\//, '')}</p> : null}
      </footer>
    </article>
  )
}

export async function CouponBookPrintable({ contract }: { contract: ContractDocData }) {
  const treasury = treasuryForClient()
  const open = contract.installments.filter((row) => isOpenCoupon(row.status))
  const bookCode = couponBookCode(contract.loanId)
  let qrError: string | null = null
  let ticketError: string | null = null
  let payloads: Awaited<ReturnType<typeof ensureLoanCouponMpQrs>> = {}
  let tickets: Awaited<ReturnType<typeof ensureLoanCouponTickets>> = {}
  try {
    const [loanRow] = await db
      .select({ userId: loan.userId })
      .from(loan)
      .where(eq(loan.id, contract.loanId))
      .limit(1)
    if (loanRow) {
      const [qrResult, ticketResult] = await Promise.all([
        ensureLoanCouponMpQrs(contract.loanId, loanRow.userId),
        ensureLoanCouponTickets(contract.loanId, loanRow.userId).catch((err) => {
          ticketError = err instanceof Error ? err.message : 'No se emitieron los cupones de Pago Fácil / Rapipago.'
          return {} as Awaited<ReturnType<typeof ensureLoanCouponTickets>>
        }),
      ])
      payloads = qrResult
      tickets = ticketResult
    }
  } catch (err) {
    qrError = err instanceof Error ? err.message : 'Mercado Pago no emitió el QR de las cuotas.'
  }

  const coupons = await Promise.all(
    open.map(async (row) => {
      const code = couponCode({
        loanId: contract.loanId,
        number: row.number,
        dueDate: row.dueDate,
        amount: row.amount,
      })
      const payUrl = row.id ? installmentPayUrl(row.id) : ''
      const qrData = row.id ? payloads[row.id]?.qrData : null
      const cash = row.id ? tickets[row.id] : null
      const qr =
        qrData
          ? await QRCode.toDataURL(qrData, { margin: 1, width: 280, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      const pagoFacilQr =
        !cash?.pagoFacil?.operationNumber && !cash?.pagoFacil?.barcode && cash?.pagoFacil?.ticketUrl
          ? await QRCode.toDataURL(cash.pagoFacil.ticketUrl, { margin: 1, width: 160, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      const rapipagoQr =
        !cash?.rapipago?.operationNumber && !cash?.rapipago?.barcode && cash?.rapipago?.ticketUrl
          ? await QRCode.toDataURL(cash.rapipago.ticketUrl, { margin: 1, width: 160, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      return { row, code, qr, payUrl, cash, pagoFacilQr, rapipagoQr }
    }),
  )

  const site = publicSiteHost()

  return (
    <DocumentSheet className="cuponera-book">
      <div className="cuponera-cover">
        <DocumentLetterhead
          kind="estado"
          title="Cuponera de cuotas"
          subtitle="Chequera de pago: cada talón trae QR Mercado Pago, Pago Fácil, Rapipago y los datos de transferencia, con el importe exacto de esa cuota."
          number={bookCode}
          issuedAt={docDate(new Date())}
          status={open.length ? `${open.length} talón${open.length === 1 ? '' : 'es'} pendiente${open.length === 1 ? '' : 's'}` : 'Cancelada'}
          statusTone={open.length ? 'warn' : 'ok'}
        />

        <DocumentSection number="01" title="Titular">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Deudor" value={contract.customer?.name ?? '—'} />
            <DocumentField label="DNI" value={formatPersonId(contract.customer?.dni)} mono />
            <DocumentField label="CUIL" value={formatPersonId(contract.customer?.cuil)} mono />
            <DocumentField label="Correo" value={contract.customer?.email ?? '—'} />
            <DocumentField label="Teléfono" value={contract.customer?.phone ?? '—'} />
            <DocumentField label="Domicilio" value={customerAddress(contract.customer)} />
          </DocumentFieldGrid>
        </DocumentSection>

        <DocumentSection number="02" title="Crédito">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Préstamo" value={contract.loanId} mono />
            <DocumentField label="Contrato" value={`CTR-${docShortId(contract.id)}`} mono />
            <DocumentField label="Capital" value={formatARSDecimal(contract.loan.principal)} mono />
            <DocumentField label="Cuota mensual" value={formatARSDecimal(contract.loan.installmentAmount)} mono />
            <DocumentField label="Plazo" value={`${contract.loan.term} cuotas`} />
            <DocumentField label="Total a devolver" value={formatARSDecimal(contract.loan.totalAmount)} mono />
            <DocumentField label="Tasa mensual" value={formatPercent(contract.loan.monthlyRate)} mono />
            <DocumentField label="TNA" value={contract.loan.tna != null ? formatPercent(contract.loan.tna) : '—'} mono />
            <DocumentField label="CFT" value={contract.loan.cft != null ? formatPercent(contract.loan.cft) : '—'} mono />
          </DocumentFieldGrid>
        </DocumentSection>

        <DocumentSection number="03" title="Cuenta para transferir">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Titular" value={treasury.holder} />
            <DocumentField label="CUIT" value={treasury.cuit} mono />
            <DocumentField label="Banco" value={treasury.bank} />
            <DocumentField label="CBU" value={formatCBU(treasury.cbu)} mono />
            <DocumentField label="N° de cuenta" value={treasury.accountNumber} mono />
            <DocumentField label="Alias" value={treasury.alias ?? 'No informado'} mono />
          </DocumentFieldGrid>
          <div className="cuponera-howto">
            <p>
              Cada talón abierto es autónomo: llevá esa hoja al local o escaneala desde el celular.
              En Pago Fácil y Rapipago dictá el Nº de operación; si te piden escanear, mostrá el
              código de barras. El cobro se acredita cuando Mercado Pago o la transferencia
              confirman el dinero. Los cupones de red vencen a los 30 días; si se vencieron, volvé
              a imprimir esta cuponera o entrá a {site}/pagar/…
            </p>
            {qrError ? <p className="cuponera-alert">{qrError}</p> : null}
            {ticketError ? <p className="cuponera-alert">{ticketError}</p> : null}
          </div>
        </DocumentSection>

        <DocumentSection number="04" title="Cronograma">
          <table className="doc-table cuponera-schedule">
            <thead>
              <tr>
                <th>Cuota</th>
                <th>Vencimiento</th>
                <th className="num">Importe</th>
                <th>Estado</th>
                <th>Pagada el</th>
              </tr>
            </thead>
            <tbody>
              {contract.installments.map((row) => (
                <tr key={row.number} className={!isOpenCoupon(row.status) ? 'is-closed' : undefined}>
                  <td>{String(row.number).padStart(2, '0')}</td>
                  <td>{docDateShort(row.dueDate)}</td>
                  <td className="num">{formatARSDecimal(row.amount)}</td>
                  <td>{installmentStatusLabel(row.status)}</td>
                  <td>{row.paidAt ? docDateShort(row.paidAt) : isOpenCoupon(row.status) ? '—' : 'Sin registrar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocumentSection>

        <DocumentFooter
          documentId={bookCode}
          extra={`${BRAND.legalName} · CBU ${formatCBU(treasury.cbu)} · ${treasury.bank}. El QR es Mercado Pago. En Pago Fácil y Rapipago el dato principal es el Nº de operación; el código de barras es para escanear. Concepto de transferencia: código UNICRÉDITOS del talón.`}
        />
      </div>

      <div className="cuponera-coupons">
        {coupons.map((item, index) => (
          <CouponTalon
            key={item.row.number}
            index={index + 1}
            total={coupons.length}
            bookCode={bookCode}
            contract={contract}
            row={item.row}
            code={item.code}
            qr={item.qr}
            payUrl={item.payUrl}
            cash={item.cash ?? null}
            pagoFacilQr={item.pagoFacilQr}
            rapipagoQr={item.rapipagoQr}
            treasury={treasury}
            qrError={qrError}
          />
        ))}
      </div>
    </DocumentSheet>
  )
}
