import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { PagarePrintable } from '@/components/documents/pagare-printable'
import { Button } from '@/components/ui/button'
import { keepCustomerInDashboard } from '@/lib/documents/keep-customer-in-dashboard'
import { documentBackHref } from '@/lib/legal/access'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { loadContractPackForViewer } from '@/lib/legal/loan-pack'
import { requireUserId } from '@/lib/session'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PagarePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ embed?: string | string[] }>
}) {
  const { id: rawId } = await params
  const id = String(rawId ?? '').trim()
  await keepCustomerInDashboard('pagare', id, searchParams)
  const userId = await requireUserId()
  const data = await loadContractPackForViewer(userId, id)
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
