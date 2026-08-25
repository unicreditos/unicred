import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { PagarePrintable } from '@/components/documents/pagare-printable'
import { Button } from '@/components/ui/button'
import { documentBackHref } from '@/lib/legal/access'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { loadContractPackForViewer } from '@/lib/legal/loan-pack'
import { requireUserId } from '@/lib/session'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PagarePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const { id } = await params
  const data = await loadContractPackForViewer(userId, String(id ?? '').trim())
  const backHref = await documentBackHref(userId)

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Pagaré no encontrado</h1>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <DocumentPreviewShell
      backHref={backHref}
      meta={`Pagaré PAG-${data.id.slice(0, 8).toUpperCase()}`}
      fileName={documentPdfBaseName('Pagare', shortDocCode(data.id, 'PAG'))}
      extra={<DocumentPackLinks contractId={data.id} />}
    >
      <PagarePrintable contract={data} />
    </DocumentPreviewShell>
  )
}
