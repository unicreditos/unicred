import {
  DocumentField,
  DocumentFieldGrid,
  DocumentFooter,
  DocumentLetterhead,
  DocumentSection,
  DocumentSheet,
} from '@/components/documents/document-frame'
import { barcodeSvg, couponCode, installmentPayUrl } from '@/lib/coupon'
import { db } from '@/lib/db'
import { loan } from '@/lib/db/schema'
import { ensureLoanCouponMpQrs } from '@/lib/payments/installment-mp-qr'
import { ensureLoanCouponTickets, type InstallmentCashTicket } from '@/lib/payments/installment-mp-ticket'
import { treasuryForClient } from '@/lib/treasury'
import { BRAND } from '@/lib/brand'
import { docDate, docShortId, installmentStatusLabel } from '@/lib/document-format'
import { formatARSDecimal } from '@/lib/finance'
import type { ContractDocData } from '@/lib/legal/types'
import { eq } from 'drizzle-orm'
import QRCode from 'qrcode'

function isOpenCoupon(status: string) {
  return status !== 'paid' && status !== 'cancelled'
}

function CashCouponFace({
  label,
  ticket,
  barcodeSvgMarkup,
  qr,
}: {
  label: string
  ticket: InstallmentCashTicket | null
  barcodeSvgMarkup: string | null
  qr: string | null
}) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      {barcodeSvgMarkup ? (
        <div className="mt-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: barcodeSvgMarkup }} />
      ) : qr ? (
        <div className="mt-1 flex flex-col items-center">
          <img src={qr} alt={`Cupón ${label}`} className="h-16 w-16" />
          <p className="text-[8px] text-slate-500">Escaneá el ticket oficial</p>
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-slate-500">Cupón no emitido</p>
      )}
      {ticket?.expiresAt ? (
        <p className="mt-1 text-[8px] text-slate-500">Válido hasta {docDate(ticket.expiresAt)}</p>
      ) : null}
    </div>
  )
}

function ticketImage(ticket: InstallmentCashTicket | null) {
  if (!ticket) return { barcode: null as string | null, qr: null as string | null }
  let barcode: string | null = null
  if (ticket.barcode) {
    try {
      barcode = barcodeSvg(ticket.barcode, { height: 34, module: ticket.barcode.length > 24 ? 0.85 : 1.1 })
    } catch {
      barcode = null
    }
  }
  return { barcode, qr: null as string | null }
}

export async function CouponBookPrintable({ contract }: { contract: ContractDocData }) {
  const treasury = treasuryForClient()
  const open = contract.installments.filter((row) => isOpenCoupon(row.status))
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
    contract.installments.map(async (row) => {
      const code = couponCode({
        loanId: contract.loanId,
        number: row.number,
        dueDate: row.dueDate,
        amount: row.amount,
      })
      const openRow = isOpenCoupon(row.status)
      const payUrl = row.id ? installmentPayUrl(row.id) : ''
      const qrData = row.id ? payloads[row.id]?.qrData : null
      const cash = row.id ? tickets[row.id] : null
      const qr =
        openRow && qrData
          ? await QRCode.toDataURL(qrData, { margin: 1, width: 220, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      const pagoFacil = openRow ? ticketImage(cash?.pagoFacil ?? null) : { barcode: null, qr: null }
      const rapipago = openRow ? ticketImage(cash?.rapipago ?? null) : { barcode: null, qr: null }
      const ticketQr =
        openRow && !pagoFacil.barcode && cash?.pagoFacil?.ticketUrl
          ? await QRCode.toDataURL(cash.pagoFacil.ticketUrl, { margin: 1, width: 140, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      const rapipagoQr =
        openRow && !rapipago.barcode && cash?.rapipago?.ticketUrl
          ? await QRCode.toDataURL(cash.rapipago.ticketUrl, { margin: 1, width: 140, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      return {
        row,
        code,
        qr,
        payUrl,
        qrData: Boolean(qrData),
        cash,
        pagoFacil: { barcode: pagoFacil.barcode, qr: ticketQr },
        rapipago: { barcode: rapipago.barcode, qr: rapipagoQr },
      }
    }),
  )

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="estado"
        title="Cuponera de cuotas"
        subtitle="Talonario operativo: QR Mercado Pago, cupón Pago Fácil y cupón Rapipago con el importe de cada cuota"
        number={`CUP-${docShortId(contract.loanId)}`}
        issuedAt={docDate(new Date())}
        status={open.length ? 'Vigente' : 'Cancelada'}
        statusTone={open.length ? 'warn' : 'ok'}
      />

      <DocumentSection number="01" title="Titular y crédito">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Deudor" value={contract.customer?.name ?? '—'} />
          <DocumentField label="DNI" value={contract.customer?.dni ?? '—'} mono />
          <DocumentField label="Préstamo" value={contract.loanId} mono />
          <DocumentField label="Contrato" value={`CTR-${docShortId(contract.id)}`} mono />
          <DocumentField label="Capital" value={formatARSDecimal(contract.loan.principal)} mono />
          <DocumentField label="Cuotas" value={String(contract.loan.term)} />
        </DocumentFieldGrid>
      </DocumentSection>

      <DocumentSection number="02" title="Medios de pago reales">
        <DocumentFieldGrid cols={3}>
          <DocumentField label="Titular transferencia" value={treasury.holder} />
          <DocumentField label="CUIT" value={treasury.cuit} mono />
          <DocumentField label="Banco" value={treasury.bank} />
          <DocumentField label="CBU" value={treasury.cbu} mono />
          <DocumentField label="N° cuenta" value={treasury.accountNumber} mono />
          <DocumentField label="Alias" value={treasury.alias ?? 'No informado'} mono />
        </DocumentFieldGrid>
        <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
          Cada talón abierto lleva tres medios reales de Mercado Pago: el QR EMV (app o billetera),
          el cupón de Pago Fácil y el cupón de Rapipago, con el importe de esa cuota. Mostrá el
          código de barras en el local. El cobro se acredita cuando Mercado Pago confirma el dinero.
          También podés transferir a esta cuenta Brubank. Los cupones de red vencen a los 30 días:
          si se vencieron, imprimí de nuevo o entrá a {BRAND.website.replace(/^https?:\/\//, '')}/pagar/…
        </p>
        {qrError ? (
          <p className="mt-2 text-[12px] font-medium text-red-700">{qrError}</p>
        ) : null}
        {ticketError ? (
          <p className="mt-2 text-[12px] font-medium text-red-700">{ticketError}</p>
        ) : null}
      </DocumentSection>

      <DocumentSection number="03" title="Talonario">
        <div className="space-y-4">
          {coupons.map(({ row, code, qr, payUrl, cash, pagoFacil, rapipago }) => {
            const closed = !isOpenCoupon(row.status)
            return (
              <div key={row.number} className="doc-coupon-ticket break-inside-avoid rounded border border-slate-200 p-3">
                <div className="doc-coupon-meta mb-2 text-[12px]">
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Cuota</p>
                    <p className="font-semibold">{String(row.number).padStart(2, '0')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Vencimiento</p>
                    <p>{docDate(row.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Importe</p>
                    <p className="font-mono">{formatARSDecimal(row.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Estado</p>
                    <p>{installmentStatusLabel(row.status)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Fecha de pago</p>
                    <p>{row.paidAt ? docDate(row.paidAt) : closed ? 'Sin registrar' : '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-0 flex-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: barcodeSvg(code, { height: 42, module: 1.35 }) }} />
                  {qr ? (
                    <div className="flex w-[148px] shrink-0 flex-col items-center">
                      <img src={qr} alt={`QR Mercado Pago de la cuota ${row.number}`} className="h-[120px] w-[120px]" />
                      <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        QR Mercado Pago
                      </p>
                    </div>
                  ) : (
                    <p className="w-[148px] text-center text-[11px] text-slate-500">
                      {row.status === 'cancelled'
                        ? 'Talón anulado'
                        : row.status === 'paid'
                          ? 'Talón saldado'
                          : qrError || 'QR Mercado Pago no emitido'}
                    </p>
                  )}
                </div>
                {!closed ? (
                  <div className="doc-coupon-cash mt-3 grid gap-3 sm:grid-cols-2">
                    <CashCouponFace
                      label="Pago Fácil"
                      ticket={cash?.pagoFacil ?? null}
                      barcodeSvgMarkup={pagoFacil.barcode}
                      qr={pagoFacil.qr}
                    />
                    <CashCouponFace
                      label="Rapipago"
                      ticket={cash?.rapipago ?? null}
                      barcodeSvgMarkup={rapipago.barcode}
                      qr={rapipago.qr}
                    />
                  </div>
                ) : null}
                <p className="mt-2 text-[10px] leading-snug text-slate-600">
                  CBU {treasury.cbu}
                  {treasury.alias ? ` · Alias ${treasury.alias}` : ''}
                  {payUrl ? (
                    <>
                      <br />
                      <span className="font-mono text-[9px] break-all">{payUrl}</span>
                    </>
                  ) : null}
                </p>
              </div>
            )
          })}
        </div>
      </DocumentSection>

      <DocumentFooter
        documentId={`CUP-${contract.loanId}`}
        extra={`${BRAND.legalName} · CBU ${treasury.cbu} · ${treasury.bank}. El QR es Mercado Pago. Los códigos de Pago Fácil y Rapipago son el cupón de esa cuota; mostralos en el local.`}
      />
    </DocumentSheet>
  )
}
