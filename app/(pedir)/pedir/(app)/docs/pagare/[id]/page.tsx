import { PedirDocMissing, PedirDocViewer } from '@/components/pedir/doc-viewer'
import { PagarePrintable } from '@/components/documents/pagare-printable'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { loadContractPackForViewer } from '@/lib/legal/loan-pack'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function PedirPagarePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const { id } = await params
  const data = await loadContractPackForViewer(userId, String(id ?? '').trim())

  if (!data) {
    return <PedirDocMissing title="Pagaré no encontrado" />
  }

  return (
    <PedirDocViewer
      title="Pagaré"
      meta={`PAG-${data.id.slice(0, 8).toUpperCase()}`}
      fileName={documentPdfBaseName('Pagare', shortDocCode(data.id, 'PAG'))}
      contractId={data.id}
      loanId={data.loanId}
    >
      <PagarePrintable contract={data} />
    </PedirDocViewer>
  )
}
