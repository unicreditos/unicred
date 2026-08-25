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

export async function CouponBookPrintable({ contract }: { contract: ContractDocData }) {
  const treasury = treasuryForClient()
  const open = contract.installments.filter((row) => isOpenCoupon(row.status))
  let qrError: string | null = null
  let payloads: Awaited<ReturnType<typeof ensureLoanCouponMpQrs>> = {}
  try {
    const [loanRow] = await db
      .select({ userId: loan.userId })
      .from(loan)
      .where(eq(loan.id, contract.loanId))
      .limit(1)
    if (loanRow) payloads = await ensureLoanCouponMpQrs(contract.loanId, loanRow.userId)
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
      const qr =
        openRow && qrData
          ? await QRCode.toDataURL(qrData, { margin: 1, width: 220, color: { dark: '#0f172a', light: '#ffffff' } })
          : null
      return { row, code, qr, payUrl, qrData: Boolean(qrData) }
    }),
  )

  return (
    <DocumentSheet>
      <DocumentLetterhead
        kind="estado"
        title="Cuponera de cuotas"
        subtitle="Talonario operativo: el QR impreso es el código EMV de Mercado Pago con el importe de la cuota"
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
          Cada talón abierto lleva el QR dinámico de Mercado Pago (estándar EMVCo) con el importe
          de esa cuota. Escanealo con la app Mercado Pago u otra billetera interoperable. El cobro
          se acredita cuando Mercado Pago confirma el dinero. También podés entrar a
          {' '}{BRAND.website.replace(/^https?:\/\//, '')}/pagar/… para tarjeta, Pago Fácil,
          Rapipago o transferencia a esta cuenta Brubank. El código de barras identifica el talón.
        </p>
        {qrError ? (
          <p className="mt-2 text-[12px] font-medium text-red-700">{qrError}</p>
        ) : null}
      </DocumentSection>

      <DocumentSection number="03" title="Talonario">
        <div className="space-y-4">
          {coupons.map(({ row, code, qr, payUrl }) => {
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
                      <img src={qr} alt={`QR para pagar la cuota ${row.number}`} className="h-[120px] w-[120px]" />
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
                <p className="mt-2 text-[10px] leading-snug text-slate-600">
                  MP web/app · Pago Fácil · Rapipago · CBU {treasury.cbu}
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
        extra={`${BRAND.legalName} · CBU ${treasury.cbu} · ${treasury.bank}. El QR es el código EMV de Mercado Pago con el importe de esa cuota. El código de barras no sustituye la acreditación.`}
      />
    </DocumentSheet>
  )
}
