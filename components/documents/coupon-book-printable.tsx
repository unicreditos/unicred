import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { barcodeSvg, couponCode, formatBarcodeHuman } from '@/lib/coupon'
import { installmentPosPath } from '@/lib/workspace-gate'
import { BRAND, publicBrandWebsite } from '@/lib/brand'
import { docDate, docDateShort, docShortId, installmentStatusLabel } from '@/lib/document-format'
import {
  couponPaymentMissingLabels,
  formatCuit,
  type CouponPaymentData,
} from '@/lib/documents/coupon-payment-data'
import { formatARSDecimal, formatCBU, formatPercent } from '@/lib/finance'
import type { ContractDocData, InstallmentDoc } from '@/lib/legal/types'

const COUPONS_PER_SHEET = 4
const DASH = '—'

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
  return raw || DASH
}

function customerAddress(customer: ContractDocData['customer']) {
  if (!customer) return DASH
  const parts = [customer.address, customer.city, customer.province].map((part) => String(part ?? '').trim()).filter(Boolean)
  return parts.join(', ') || DASH
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

function Pending({ children = 'DATO PENDIENTE DE CONFIRMAR' }: { children?: string }) {
  return <span className="cp-pending">{children}</span>
}

/** Valor o marcador visible (solo aparece cuando falta el dato = modo borrador). */
function PayValue({ value, mono = false }: { value: string | null; mono?: boolean }) {
  if (!value) return <Pending />
  return <span className={mono ? 'cp-mono' : undefined}>{value}</span>
}

/** Bloque "Datos para pagar": cuenta corriente, CBU, alias y QR de transferencia de UNICRÉDITOS. */
function PayDataBlock({ pay, code }: { pay: CouponPaymentData; code: string }) {
  return (
    <section className="cp-paydata" aria-label="Datos para pagar">
      <h3 className="cp-paydata-title">Datos para pagar</h3>
      <div className="cp-paydata-body">
        <dl className="cp-paydata-list">
          <div>
            <dt>Banco</dt>
            <dd>
              <PayValue value={pay.bank} />
              {pay.bank ? ` · ${pay.accountType} $` : null}
            </dd>
          </div>
          <div>
            <dt>Titular</dt>
            <dd>
              <PayValue value={pay.holder} />
            </dd>
          </div>
          <div>
            <dt>CUIT</dt>
            <dd>
              <PayValue value={formatCuit(pay.cuit)} mono />
            </dd>
          </div>
          <div>
            <dt>Cta. Cte. N°</dt>
            <dd>
              <PayValue value={pay.accountNumber} mono />
            </dd>
          </div>
          <div>
            <dt>CBU</dt>
            <dd>
              <PayValue value={pay.cbu ? formatCBU(pay.cbu) : null} mono />
            </dd>
          </div>
          <div>
            <dt>Alias</dt>
            <dd>
              <PayValue value={pay.alias} mono />
            </dd>
          </div>
          <div>
            <dt>Concepto</dt>
            <dd className="cp-mono">{code}</dd>
          </div>
        </dl>
        <figure className="cp-qr">
          {pay.qrSvg ? (
            <div className="cp-qr-img" role="img" aria-label="QR de transferencia a la cuenta de UNICRÉDITOS" dangerouslySetInnerHTML={{ __html: pay.qrSvg }} />
          ) : (
            <div className="cp-qr-img cp-qr-pending">
              <span>QR PENDIENTE DE CONFIRMAR</span>
            </div>
          )}
          <figcaption>QR transferencia</figcaption>
        </figure>
      </div>
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
  payUrl,
  pay,
}: {
  index: number
  total: number
  bookCode: string
  contract: ContractDocData
  row: InstallmentDoc
  code: string
  payUrl: string
  pay: CouponPaymentData
}) {
  const term = contract.loan.term
  const overdue = row.status === 'overdue'
  const quota = `${String(row.number).padStart(2, '0')}/${String(term).padStart(2, '0')}`
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
        <div className="cp-body">
          <div className="cp-code-col">
            <p className="cp-label">Código UNICRÉDITOS</p>
            <div className="cp-barcode">
              <PrintBarcode value={code} height={60} />
            </div>
            <p className="cp-channels">
              <span className="cp-chip">Pago Fácil</span>
              <span className="cp-chip">Rapipago</span>
              <span className="cp-chip">Mercado Pago</span>
            </p>
            <p className="cp-note">
              Pago Fácil / Rapipago: el cupón de red se emite al elegir ese medio (tiene vencimiento).
              {payUrl ? ` Pagá online: ${payUrl.replace(/^https?:\/\//, '')}` : ''}
            </p>
          </div>
          <PayDataBlock pay={pay} code={code} />
        </div>
      </div>
    </article>
  )
}

export function CouponBookPrintable({ contract, pay }: { contract: ContractDocData; pay: CouponPaymentData }) {
  const open = contract.installments.filter((row) => isOpenCoupon(row.status))
  const bookCode = couponBookCode(contract.loanId)
  const site = publicSiteHost()
  const origin = publicBrandWebsite().replace(/\/$/, '')
  const missingLabels = couponPaymentMissingLabels(pay)

  const coupons = open.map((row) => {
    const code = couponCode({
      loanId: contract.loanId,
      number: row.number,
      dueDate: row.dueDate,
      amount: row.amount,
    })
    const payUrl = row.id ? `${origin}${installmentPosPath(row.id)}` : ''
    return { row, code, payUrl }
  })

  const sheets: (typeof coupons)[] = []
  for (let i = 0; i < coupons.length; i += COUPONS_PER_SHEET) sheets.push(coupons.slice(i, i + COUPONS_PER_SHEET))

  return (
    <DocumentSheet className="cuponera-book">
    <div className="cp-root" data-final={pay.final ? 'true' : 'false'}>
      {!pay.final ? (
        <div className="cp-draft-banner" role="status">
          <strong>{pay.example ? 'EJEMPLO — datos ficticios' : 'BORRADOR — NO EMITIBLE COMO DEFINITIVA'}</strong>
          <span>
            {pay.example
              ? 'Estos datos de cuenta son de demostración. No usar para pagar ni para imprimir.'
              : `Faltan datos de la cuenta de cobro de UNICRÉDITOS por confirmar: ${missingLabels.join(', ')}. La impresión está bloqueada hasta cargarlos.`}
          </span>
        </div>
      ) : null}

      <div className="cp-print-block" role="alert">
        <strong>Cuponera no emitible</strong>
        <span>
          {pay.example
            ? 'Esta vista es un ejemplo con datos ficticios.'
            : `Faltan datos de la cuenta de cobro por confirmar (${missingLabels.join(', ')}). Cargalos en la configuración del servidor y volvé a imprimir.`}
        </span>
      </div>

      <div className="cuponera-cover">
        <DocumentLetterhead
          kind="estado"
          title="Cuponera de cuotas"
          subtitle="Cronograma de cuotas. Pagá desde tu cuenta UNICRÉDITOS. El cupón de Pago Fácil o Rapipago se emite al elegir ese medio, porque vence."
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

        <DocumentSection number="03" title="Cuenta para transferir">
          <DocumentFieldGrid cols={3}>
            <DocumentField label="Titular" value={pay.holder ?? 'DATO PENDIENTE DE CONFIRMAR'} />
            <DocumentField label="CUIT" value={formatCuit(pay.cuit) ?? 'DATO PENDIENTE DE CONFIRMAR'} mono />
            <DocumentField label="Banco" value={pay.bank ?? 'DATO PENDIENTE DE CONFIRMAR'} />
            <DocumentField label="CBU" value={pay.cbu ? formatCBU(pay.cbu) : 'DATO PENDIENTE DE CONFIRMAR'} mono />
            <DocumentField label="N° de cuenta" value={pay.accountNumber ?? 'DATO PENDIENTE DE CONFIRMAR'} mono />
            <DocumentField label="Alias" value={pay.alias ?? 'DATO PENDIENTE DE CONFIRMAR'} mono />
          </DocumentFieldGrid>
          <div className="cuponera-howto">
            <p>
              Este talonario es el cronograma del crédito. Para pagar con tarjeta, Pago Fácil o Rapipago ingresá a tu
              cuenta UNICRÉDITOS → Créditos → Pagar cuotas. El cupón de red se emite recién cuando elegís ese medio,
              porque tiene fecha de vencimiento. La transferencia usa los datos de cada talón (CBU, alias o QR) y el
              código UNICRÉDITOS como concepto. Sitio: {site}.
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
                <tr key={row.number} className={!isOpenCoupon(row.status) ? 'is-closed' : undefined}>
                  <td>{String(row.number).padStart(2, '0')}</td>
                  <td>{docDateShort(row.dueDate)}</td>
                  <td className="num">{formatARSDecimal(row.amount)}</td>
                  <td>{installmentStatusLabel(row.status)}</td>
                  <td>{row.paidAt ? docDateShort(row.paidAt) : isOpenCoupon(row.status) ? DASH : 'Sin registrar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocumentSection>

        <DocumentFooter
          documentId={bookCode}
          extra={`${BRAND.legalName}. Pagá desde tu cuenta UNICRÉDITOS. El cupón de Pago Fácil o Rapipago se emite al elegir ese medio. Concepto de transferencia: código UNICRÉDITOS del talón.`}
        />
      </div>

      <div className="cuponera-coupons">
        {sheets.map((sheet, sheetIndex) => (
          <section className="cp-sheet" key={sheetIndex} aria-label={`Hoja ${sheetIndex + 1} de ${sheets.length}`}>
            {sheet.map((item) => (
              <CouponTalon
                key={item.row.number}
                index={coupons.indexOf(item) + 1}
                total={coupons.length}
                bookCode={bookCode}
                contract={contract}
                row={item.row}
                code={item.code}
                payUrl={item.payUrl}
                pay={pay}
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
