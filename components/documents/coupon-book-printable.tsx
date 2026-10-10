import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { barcodeSvg, formatBarcodeHuman, itfBarcodeSvg } from '@/lib/coupon'
import { BRAND, publicBrandWebsite } from '@/lib/brand'
import { docDate, docDateShort, docShortId, installmentStatusLabel } from '@/lib/document-format'
import {
  isOpenInstallment,
  type CouponBookPay,
  type CouponNetworkCode,
  type CouponTalonPay,
} from '@/lib/documents/coupon-payment-data'
import { formatARSDecimal, formatPercent } from '@/lib/finance'
import type { ContractDocData, InstallmentDoc } from '@/lib/legal/types'

/** Dos talones por hoja A4: con QR y dos códigos de barras, más no entran sin recortarse. */
const COUPONS_PER_SHEET = 2
const DASH = '—'

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
  return raw || DASH
}

function customerAddress(customer: ContractDocData['customer']) {
  if (!customer) return DASH
  const parts = [customer.address, customer.city, customer.province].map((part) => String(part ?? '').trim()).filter(Boolean)
  return parts.join(', ') || DASH
}

/** Los tickets de Mercado Pago usan 2 de 5 intercalado; si el contenido no es par, se dibuja en Code 128. */
function networkBarcodeSvg(digits: string) {
  try {
    return digits.length % 2 === 0
      ? itfBarcodeSvg(digits, { height: 44 })
      : barcodeSvg(digits, { height: 44, module: 1, showText: false, fit: true })
  } catch {
    return null
  }
}

function MpQrBlock({ talon }: { talon: CouponTalonPay | undefined }) {
  return (
    <figure className="cp-mpqr">
      {talon?.qrSvg ? (
        <div className="cp-qr-img" role="img" aria-label="QR de Mercado Pago para pagar esta cuota" dangerouslySetInnerHTML={{ __html: talon.qrSvg }} />
      ) : (
        <div className="cp-qr-img cp-qr-pending">
          <span>QR NO DISPONIBLE</span>
        </div>
      )}
      <figcaption>
        <strong>Pagá con Mercado Pago</strong>
        <span>Escaneá con la cámara: abre esta cuota con el importe exacto (dinero en cuenta, tarjeta o ticket de Pago Fácil / Rapipago).</span>
      </figcaption>
    </figure>
  )
}

function NetworkBlock({
  label,
  code,
  barcodesFrom,
}: {
  label: CouponNetworkCode['label']
  code: CouponNetworkCode | null
  barcodesFrom: string | null
}) {
  const svg = code?.barcode ? networkBarcodeSvg(code.barcode) : null
  return (
    <section className="cp-net" aria-label={`Pagar en ${label}`}>
      <p className="cp-net-head">
        <span className="cp-chip">{label}</span>
        {code ? <span className="cp-net-exp">Ticket válido hasta {docDateShort(code.expiresAt)}</span> : null}
      </p>
      {code ? (
        <>
          {svg ? <div className="cp-net-bars" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
          {code.barcode ? <p className="cp-net-digits">{code.barcode}</p> : null}
          {code.paymentCode ? (
            <p className="cp-net-code">
              Código de pago <span className="cp-mono">{formatBarcodeHuman(code.paymentCode)}</span>
            </p>
          ) : null}
        </>
      ) : barcodesFrom ? (
        <p className="cp-net-later">
          Mercado Pago emite este código desde el <strong>{docDateShort(barcodesFrom)}</strong>. Antes, escaneá el QR o
          volvé a descargar la cuponera desde esa fecha.
        </p>
      ) : (
        <p className="cp-net-later">
          <span className="cp-pending">NO EMITIDO POR MERCADO PAGO</span>
        </p>
      )}
    </section>
  )
}

function CouponTalon({
  index,
  total,
  bookCode,
  contract,
  row,
  talon,
}: {
  index: number
  total: number
  bookCode: string
  contract: ContractDocData
  row: InstallmentDoc
  talon: CouponTalonPay | undefined
}) {
  const term = contract.loan.term
  const overdue = row.status === 'overdue'
  const quota = `${String(row.number).padStart(2, '0')}/${String(term).padStart(2, '0')}`
  const barcodesFrom = talon?.barcodesFrom ?? null
  return (
    <article className={`cp${overdue ? ' is-overdue' : ''}`}>
      <aside className="cp-stub" aria-label="Talón para el cliente">
        <p className="cp-stub-tag">Talón · conservar</p>
        <p className="cp-stub-quota">Cuota {quota}</p>
        <dl className="cp-stub-list">
          <div>
            <dt>Vence</dt>
            <dd>{docDateShort(row.dueDate)}</dd>
          </div>
          <div>
            <dt>Importe</dt>
            <dd className="cp-strong">{formatARSDecimal(row.amount)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{installmentStatusLabel(row.status)}</dd>
          </div>
        </dl>
        <p className="cp-stub-ref">
          {bookCode}
          <br />
          Talón {index} de {total}
        </p>
      </aside>
      <div className="cp-cut" aria-hidden="true">
        <span>✂</span>
      </div>
      <div className="cp-main">
        <header className="cp-head">
          <p className="cp-brand">UNICRÉDITOS</p>
          <p className="cp-holder">
            {contract.customer?.name ?? 'Titular no informado'}
            {contract.customer?.cuil ? ` · CUIL ${formatPersonId(contract.customer.cuil)}` : ''}
          </p>
          <p className="cp-quota">
            Cuota <strong>{quota}</strong>
          </p>
        </header>
        <div className="cp-figures">
          <div>
            <p className="cp-label">Vencimiento</p>
            <p className="cp-value">{docDateShort(row.dueDate)}</p>
          </div>
          <div>
            <p className="cp-label">Importe a pagar</p>
            <p className="cp-value cp-amount">{formatARSDecimal(row.amount)}</p>
          </div>
          <div>
            <p className="cp-label">Estado</p>
            <p className={`cp-value${overdue ? ' cp-overdue' : ''}`}>{installmentStatusLabel(row.status)}</p>
          </div>
        </div>
        <div className="cp-body cp-body-mp">
          <MpQrBlock talon={talon} />
          <div className="cp-nets">
            <NetworkBlock label="Pago Fácil" code={talon?.pagoFacil ?? null} barcodesFrom={barcodesFrom} />
            <NetworkBlock label="Rapipago" code={talon?.rapipago ?? null} barcodesFrom={barcodesFrom} />
          </div>
        </div>
      </div>
    </article>
  )
}

export function CouponBookPrintable({ contract, pay }: { contract: ContractDocData; pay: CouponBookPay }) {
  const open = contract.installments.filter((row) => isOpenInstallment(row.status))
  const bookCode = couponBookCode(contract.loanId)
  const site = publicSiteHost()

  const sheets: InstallmentDoc[][] = []
  for (let i = 0; i < open.length; i += COUPONS_PER_SHEET) sheets.push(open.slice(i, i + COUPONS_PER_SHEET))
  const problemsText = pay.problems.join(' ')

  return (
    <DocumentSheet className="cuponera-book">
    <div className="cp-root" data-final={pay.final ? 'true' : 'false'}>
      {!pay.final ? (
        <div className="cp-draft-banner" role="status">
          <strong>BORRADOR — NO EMITIBLE COMO DEFINITIVA</strong>
          <span>{problemsText} La impresión está bloqueada hasta que Mercado Pago entregue todos los códigos.</span>
        </div>
      ) : null}

      <div className="cp-print-block" role="alert">
        <strong>Cuponera no emitible</strong>
        <span>{problemsText} Volvé a descargarla en unos minutos.</span>
      </div>

      <div className="cuponera-cover">
        <DocumentLetterhead
          kind="cuponera"
          title="Cuponera de cuotas"
          subtitle="Cada talón trae el QR de Mercado Pago y los códigos de Pago Fácil y Rapipago que emite Mercado Pago."
          number={bookCode}
          issuedAt={docDate(new Date())}
          status={open.length ? `${open.length} talón${open.length === 1 ? '' : 'es'} pendiente${open.length === 1 ? '' : 's'}` : 'Cancelada'}
          statusTone={open.length ? 'warn' : 'ok'}
        />

        <DocumentSection number="01" title="Titular">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Deudor" value={contract.customer?.name ?? DASH} />
            <DocumentField label="DNI" value={formatPersonId(contract.customer?.dni)} mono />
            <DocumentField label="CUIL" value={formatPersonId(contract.customer?.cuil)} mono />
            <DocumentField label="Correo" value={contract.customer?.email ?? DASH} />
            <DocumentField label="Teléfono" value={contract.customer?.phone ?? DASH} />
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
            <DocumentField label="TNA" value={contract.loan.tna != null ? formatPercent(contract.loan.tna) : DASH} mono />
            <DocumentField label="CFT" value={contract.loan.cft != null ? formatPercent(contract.loan.cft) : DASH} mono />
          </DocumentFieldGrid>
        </DocumentSection>

        <DocumentSection number="03" title="Cómo pagar">
          <div className="cuponera-howto">
            <p>
              Todos los cobros se procesan por Mercado Pago. Escaneá el QR del talón: abre el pago de esa cuota con el
              importe exacto y, si la cuota ya está paga, te avisa para que no pagues dos veces. En Pago Fácil o
              Rapipago mostrá el código de barras del talón. Mercado Pago emite esos códigos con un vencimiento máximo de
              30 días, por eso solo aparecen en las cuotas próximas a vencer: para las siguientes, volvé a descargar la
              cuponera o generá el ticket desde el QR. Sitio: {site}.
            </p>
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
                <tr key={row.number} className={!isOpenInstallment(row.status) ? 'is-closed' : undefined}>
                  <td>{String(row.number).padStart(2, '0')}</td>
                  <td>{docDateShort(row.dueDate)}</td>
                  <td className="num">{formatARSDecimal(row.amount)}</td>
                  <td>{installmentStatusLabel(row.status)}</td>
                  <td>{row.paidAt ? docDateShort(row.paidAt) : isOpenInstallment(row.status) ? DASH : 'Sin registrar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocumentSection>

        <DocumentFooter
          documentId={bookCode}
          extra={`${BRAND.legalName}. Cobros procesados por Mercado Pago: QR del talón o códigos de Pago Fácil y Rapipago emitidos por Mercado Pago.`}
        />
      </div>

      <div className="cuponera-coupons">
        {sheets.map((sheet, sheetIndex) => (
          <section className="cp-sheet" key={sheetIndex} aria-label={`Hoja ${sheetIndex + 1} de ${sheets.length}`}>
            {sheet.map((row) => (
              <CouponTalon
                key={row.number}
                index={open.indexOf(row) + 1}
                total={open.length}
                bookCode={bookCode}
                contract={contract}
                row={row}
                talon={row.id ? pay.talons[row.id] : undefined}
              />
            ))}
            <p className="cp-sheet-foot">
              {bookCode} · Hoja {sheetIndex + 1} de {sheets.length} · {BRAND.legalName}
              {pay.final ? '' : ' · BORRADOR'}
            </p>
          </section>
        ))}
      </div>
    </div>
    </DocumentSheet>
  )
}
