import { PedirDocMissing, PedirDocViewer } from '@/components/pedir/doc-viewer'
import { LoanContractPrintable } from '@/components/documents/loan-contract-printable'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { loadContractPackForViewer } from '@/lib/legal/loan-pack'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function PedirContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const { id: rawId } = await params
  const data = await loadContractPackForViewer(userId, String(rawId ?? '').trim())

  if (!data) {
    return <PedirDocMissing title="Contrato no encontrado" />
  }

  return (
    <PedirDocViewer
      title="Contrato"
      meta={`CTR-${data.id.slice(0, 8).toUpperCase()} · v${data.version}`}
      fileName={documentPdfBaseName('Contrato', shortDocCode(data.id, 'CTR'))}
      contractId={data.id}
      loanId={data.loanId}
    >
      <LoanContractPrintable contract={data} />
    </PedirDocViewer>
  )
}
