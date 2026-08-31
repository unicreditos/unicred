'use client'

import { loadCustomerDocument } from '@/app/actions/customer-documents'
import { ArcaConstanciaPrintable } from '@/components/documents/arca-constancia-printable'
import { BCRAReportPrintable, type BCRAReportData } from '@/components/documents/bcra-report-printable'
import { CertificatePrintable } from '@/components/documents/certificate-printable'
import { CouponBookPrintable } from '@/components/documents/coupon-book-printable'
import { EstadoDeudaPrintable } from '@/components/documents/estado-deuda-printable'
import { IntimacionPrintable } from '@/components/documents/intimacion-printable'
import { LiquidacionPrintable, type LiquidacionData } from '@/components/documents/liquidacion-printable'
import { LoanContractPrintable } from '@/components/documents/loan-contract-printable'
import { PagarePrintable } from '@/components/documents/pagare-printable'
import {
  PaymentReceiptPrintable,
  type ReceiptDocData,
} from '@/components/documents/payment-receipt-printable'
import { PrintButton, DocumentPrintTitle } from '@/components/documents/print-button'
import { ServicePaymentTicketPrintable } from '@/components/documents/service-payment-ticket'
import { documentKindTitle, type CustomerDocKind } from '@/lib/documents/customer-view'
import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'

export function InAppDocumentPanel({
  kind,
  id,
}: {
  kind: CustomerDocKind
  id: string
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof loadCustomerDocument>> | null>(null)

  useEffect(() => {
    let cancelled = false
    // Carga el documento apenas cambia kind/id; no hay valor derivable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading')
    setError('')
    void loadCustomerDocument(kind, id).then((result) => {
      if (cancelled) return
      setPayload(result)
      if (!result.ok) {
        setError(result.error)
        setState('error')
        return
      }
      setState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [kind, id])

  if (state === 'loading') {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <p className="text-sm font-semibold text-brand-navy-900">{documentKindTitle(kind)}</p>
        </div>
        <div className="flex min-h-[420px] items-center justify-center bg-slate-100">
          <p className="text-sm text-slate-500">Abriendo documento…</p>
        </div>
      </div>
    )
  }

  if (state === 'error' || !payload || !payload.ok) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <FileText className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-brand-navy-900">{documentKindTitle(kind)}</p>
          <p className="max-w-md text-sm text-slate-500">{error || 'No se pudo abrir el documento.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="in-app-doc-stage overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <DocumentPrintTitle fileName={payload.fileName} />
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="text-sm font-semibold text-brand-navy-900">{payload.title}</p>
        <PrintButton fileName={payload.fileName} />
      </div>
      <div className="in-app-doc-canvas max-h-[min(78vh,920px)] overflow-auto bg-slate-100 px-3 py-5 sm:px-6">
        <DocumentBody payload={payload} />
      </div>
    </div>
  )
}

function DocumentBody({
  payload,
}: {
  payload: Extract<Awaited<ReturnType<typeof loadCustomerDocument>>, { ok: true }>
}) {
  switch (payload.kind) {
    case 'contrato':
      return <LoanContractPrintable contract={payload.contract} />
    case 'pagare':
      return <PagarePrintable contract={payload.contract} />
    case 'talonario':
      return <CouponBookPrintable contract={payload.contract} />
    case 'estado-deuda':
      return <EstadoDeudaPrintable contract={payload.contract} />
    case 'intimacion':
      return (
        <IntimacionPrintable
          contract={payload.contract}
          items={payload.items}
          noticeNumber={payload.noticeNumber}
          issuedAt={payload.issuedAt}
        />
      )
    case 'arca':
      return <ArcaConstanciaPrintable snapshot={payload.snapshot} holderName={payload.holderName} />
    case 'bcra':
      return (
        <BCRAReportPrintable
          report={payload.report as BCRAReportData}
          extract={payload.extract}
        />
      )
    case 'recibo': {
      const receipt = payload.receipt as ReceiptDocData
      if (receipt.receiptType === 'service_payment') {
        return <ServicePaymentTicketPrintable receipt={receipt} />
      }
      return <PaymentReceiptPrintable receipt={receipt} />
    }
    case 'liquidacion':
      return <LiquidacionPrintable data={payload.data as LiquidacionData} />
    case 'solvencia':
    case 'libre-deuda':
    case 'cancelacion':
      return <CertificatePrintable data={payload.certificate} />
  }
}
