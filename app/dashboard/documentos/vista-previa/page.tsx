import { BCRAReportPrintable } from '@/components/documents/bcra-report-printable'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { EstadoDeudaPrintable } from '@/components/documents/estado-deuda-printable'
import { IntimacionPrintable } from '@/components/documents/intimacion-printable'
import { asMoraRows, evaluateIntimation } from '@/lib/legal/mora'
import { LoanContractPrintable, type ContractDocData } from '@/components/documents/loan-contract-printable'
import { PagarePrintable } from '@/components/documents/pagare-printable'
import { PaymentReceiptPrintable, type ReceiptDocData } from '@/components/documents/payment-receipt-printable'
import { receiptBranding } from '@/lib/brand'
import { documentPdfBaseName } from '@/lib/document-filename'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const issued = new Date('2026-08-15T14:30:00-03:00')

const contract: ContractDocData = {
  id: 'ctr-prev-001',
  loanId: 'loan-prev-001',
  version: '2.0',
  templateName: 'prestamo_personal_ars',
  createdAt: issued,
  expirationDate: new Date('2026-09-14T14:30:00-03:00'),
  acceptedAt: issued,
  status: 'accepted',
  signerName: 'Ana Cliente Demo',
  signerCuil: '27-30111222-3',
  signatureType: 'clickwrap',
  acceptedIp: '181.10.0.12',
  loan: {
    id: 'loan-prev-001',
    principal: 450000,
    term: 6,
    monthlyRate: 7.5,
    tna: 90,
    installmentAmount: 95782.15,
    totalAmount: 574692.9,
    cft: 131.22,
    purpose: 'Capital de trabajo',
    createdAt: issued,
    type: 'personal',
  },
  customer: {
    name: 'Ana Cliente Demo',
    cuil: '27-30111222-3',
    dni: '30111222',
    email: 'demo.cliente@unicred.test',
    phone: '1140000000',
    city: 'CABA',
    province: 'CABA',
    address: 'Av. Corrientes 1234, 3° B',
    employmentStatus: 'Relación de dependencia',
  },
  bankAccount: {
    bankName: 'Banco Nación',
    accountType: 'cbu',
    cbu: '0110012345678901234567',
    alias: 'ana.unicred.demo',
    holderName: 'Ana Cliente Demo',
    holderCuil: '27-30111222-3',
  },
  installments: Array.from({ length: 6 }, (_, i) => ({
    number: i + 1,
    amount: 95782.15,
    dueDate: new Date(2026, 8 + i, 15),
    status: i === 0 ? 'paid' : 'pending',
  })),
}

const receipt: ReceiptDocData = {
  id: 'rec-prev-001',
  receiptNumber: 'REC-20260815-01',
  receiptType: 'payment',
  issuedAt: issued,
  paidAt: issued,
  amount: 95782.15,
  currency: 'ARS',
  method: 'mercado_pago',
  referenceNumber: 'MP-99887766',
  loanSnapshot: {
    id: 'loan-prev-001',
    principal: 450000,
    term: 6,
    tna: 90,
    totalAmount: 574692.9,
  },
  installmentSnapshot: {
    number: 1,
    amount: 95782.15,
    dueDate: new Date('2026-09-15T00:00:00-03:00'),
  },
  previousBalance: 574692.9,
  newBalance: 478910.75,
  pendingInstallments: 5,
  totalPaidToDate: 95782.15,
  customerSnapshot: {
    name: 'Ana Cliente Demo',
    cuil: '27-30111222-3',
    dni: '30111222',
    email: 'demo.cliente@unicred.test',
    phone: '1140000000',
    city: 'CABA',
    province: 'CABA',
    address: 'Av. Corrientes 1234, 3° B',
  },
  branding: receiptBranding(),
}

export default async function DocumentPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  if (process.env.NODE_ENV === 'production') redirect('/dashboard')
  const { tipo } = await searchParams
  const kind = ['recibo', 'informe', 'pagare', 'estado', 'intimacion'].includes(tipo ?? '')
    ? tipo!
    : 'contrato'

  return (
    <DocumentPreviewShell
      backHref="/dashboard?tab=documentos"
      meta={`Vista previa · ${kind} · datos de ejemplo (solo desarrollo)`}
      fileName={documentPdfBaseName('Vista-previa', kind)}
    >
      {kind === 'recibo' ? <PaymentReceiptPrintable receipt={receipt} /> : null}
      {kind === 'informe' ? (
        <BCRAReportPrintable
          report={{
            id: 'inf-prev-001',
            reportNumber: 'INF-BCRA-20260815',
            scoreAtGeneration: 712,
            worstSituation: 1,
            totalDebt: 125000,
            entitiesCount: 2,
            hasRejectedChecks: false,
            createdAt: issued,
            expiresAt: new Date('2026-09-14T14:30:00-03:00'),
            branding: receiptBranding(),
            customer: {
              name: 'Ana Cliente Demo',
              cuil: '27-30111222-3',
              dni: '30111222',
              email: 'demo.cliente@unicred.test',
              city: 'CABA',
              province: 'CABA',
            },
            fullReportData: {
              consultedAt: issued.toISOString(),
              deudas: {
                denominacion: 'Ana Cliente Demo',
                periodo: '202607',
                entidades: [
                  {
                    entidad: 'Banco de la Nación Argentina — sucursal Casa Central',
                    situacion: 1,
                    monto: 80000,
                    diasAtrasoPago: 0,
                    fechaSit1: '2024-03-01',
                  },
                  {
                    entidad: 'Banco de la Provincia de Buenos Aires',
                    situacion: 1,
                    monto: 45000,
                    diasAtrasoPago: 0,
                    refinanciaciones: true,
                  },
                ],
              },
              historicas: {
                periodos: [
                  {
                    periodo: '202606',
                    worstSituation: 1,
                    totalDebt: 118000,
                    entidades: [
                      { entidad: 'Banco de la Nación Argentina — sucursal Casa Central', situacion: 1, monto: 78000 },
                    ],
                  },
                ],
              },
              chequesRechazados: { cheques: [] },
            },
          }}
        />
      ) : null}
      {kind === 'contrato' ? <LoanContractPrintable contract={contract} /> : null}
      {kind === 'pagare' ? <PagarePrintable contract={contract} /> : null}
      {kind === 'estado' ? <EstadoDeudaPrintable contract={contract} /> : null}
      {kind === 'intimacion' ? (
        <IntimacionPrintable
          contract={contract}
          items={evaluateIntimation(
            asMoraRows(
              contract.installments.map((row, index) => ({
                ...row,
                status: index === 1 ? 'overdue' : row.status,
                dueDate: index === 1 ? new Date(2026, 5, 15) : row.dueDate,
              })),
            ),
            null,
            new Date('2026-08-22T12:00:00-03:00'),
          ).items}
        />
      ) : null}
    </DocumentPreviewShell>
  )
}
