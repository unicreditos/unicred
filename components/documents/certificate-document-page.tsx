import { CertificatePrintable } from '@/components/documents/certificate-printable'
import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { Button } from '@/components/ui/button'
import { documentBackHref, documentBackHrefForLoan } from '@/lib/legal/access'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { loadLoanCertificateForViewer, type LoanCertificateKind } from '@/lib/legal/loan-pack'
import { requireUserId } from '@/lib/session'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const META: Record<LoanCertificateKind, { title: string; blocked: string }> = {
  solvencia: {
    title: 'Certificado de solvencia',
    blocked: 'Hay mora. La solvencia se emite cuando el crédito está al día.',
  },
  libre_deuda: {
    title: 'Constancia de libre deuda',
    blocked: 'Todavía hay saldo. Se emite cuando el crédito está cancelado.',
  },
  cancelacion: {
    title: 'Liquidación de cancelación anticipada',
    blocked: 'No hay cuotas pendientes para liquidar un prepago.',
  },
}

export async function CertificateDocumentPage({
  kind,
  loanId: rawId,
}: {
  kind: LoanCertificateKind
  loanId: string
}) {
  const userId = await requireUserId()
  const loanId = String(rawId ?? '').trim()
  const data = await loadLoanCertificateForViewer(userId, loanId, kind)
  const backHref = data ? await documentBackHrefForLoan(userId, loanId) : await documentBackHref(userId)
  const copy = META[kind]

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">No corresponde emitir {copy.title.toLowerCase()}</h1>
          <p className="text-sm text-muted-foreground">{copy.blocked}</p>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const kindLabel =
    kind === 'solvencia' ? 'Solvencia' : kind === 'libre_deuda' ? 'Libre-deuda' : 'Cancelacion'

  return (
    <DocumentPreviewShell
      backHref={backHref}
      meta={`${copy.title} · ${loanId.slice(0, 10)}`}
      fileName={documentPdfBaseName(kindLabel, shortDocCode(loanId, 'LOAN'))}
      extra={<DocumentPackLinks contractId={data.contractId} loanId={data.loanId} />}
    >
      <CertificatePrintable data={data} />
    </DocumentPreviewShell>
  )
}
