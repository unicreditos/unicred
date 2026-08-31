import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { barcodeSvg, couponCode, formatBarcodeHuman } from '@/lib/coupon'
import { treasuryForClient } from '@/lib/treasury'
import { installmentPosPath } from '@/lib/workspace-gate'
import { BRAND, publicBrandWebsite } from '@/lib/brand'
import { docDate, docDateShort, docShortId, installmentStatusLabel } from '@/lib/document-format'
import { formatARSDecimal, formatCBU, formatPercent } from '@/lib/finance'
import type { ContractDocData, InstallmentDoc } from '@/lib/legal/types'

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

function CouponTalon({
  index,
  total,
  bookCode,
  contract,
  row,
  code,
  payUrl,
  treasury,
}: {
  index: number
  total: number
  bookCode: string
  contract: ContractDocData
  row: InstallmentDoc
  code: string
  payUrl: string
  treasury: ReturnType<typeof treasuryForClient>
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

      <div className="cuponera-pay-copy">
        <p className="cuponera-kicker">Cómo pagar</p>
        <ol>
          <li>Entrá a tu cuenta UNICRÉDITOS y elegí Pagar cuotas.</li>
          <li>Si pagás con tarjeta, se abre el punto de venta en el panel. No hace falta entrar a Mercado Pago.</li>
          <li>
            Si elegís Pago Fácil o Rapipago, el cupón se emite en ese momento (tiene vencimiento). No se imprimen todos
            juntos.
          </li>
          <li>Por transferencia usá el CBU o alias y el concepto de abajo.</li>
        </ol>
        <p className="cuponera-kicker">Código UNICRÉDITOS</p>
        <PrintBarcode value={code} height={40} />
      </div>

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
        {payUrl ? <p className="cuponera-mono">Pagar en tu cuenta: {payUrl.replace(/^https?:\/\//, '')}</p> : null}
      </footer>
    </article>
  )
}

export function CouponBookPrintable({ contract }: { contract: ContractDocData }) {
  const treasury = treasuryForClient()
  const open = contract.installments.filter((row) => isOpenCoupon(row.status))
  const bookCode = couponBookCode(contract.loanId)
  const site = publicSiteHost()
  const origin = publicBrandWebsite().replace(/\/$/, '')

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

  return (
    <DocumentSheet className="cuponera-book">
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
              Este talonario es el cronograma del crédito. Para pagar con tarjeta, Pago Fácil o Rapipago ingresá a tu
              cuenta UNICRÉDITOS → Créditos → Pagar cuotas. El cupón de red se emite recién cuando elegís ese medio,
              porque tiene fecha de vencimiento. La transferencia a tesorería usa el CBU de abajo y el código UNICRÉDITOS
              de cada talón. Sitio: {site}.
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
                  <td>{row.paidAt ? docDateShort(row.paidAt) : isOpenCoupon(row.status) ? '—' : 'Sin registrar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocumentSection>

        <DocumentFooter
          documentId={bookCode}
          extra={`${BRAND.legalName} · CBU ${formatCBU(treasury.cbu)} · ${treasury.bank}. Pagá desde tu cuenta UNICRÉDITOS. El cupón de Pago Fácil o Rapipago se emite al elegir ese medio. Concepto de transferencia: código UNICRÉDITOS del talón.`}
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
            payUrl={item.payUrl}
            treasury={treasury}
          />
        ))}
      </div>
    </DocumentSheet>
  )
}
