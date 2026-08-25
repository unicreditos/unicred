import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { IntimacionPrintable } from '@/components/documents/intimacion-printable'
import { Button } from '@/components/ui/button'
import { documentBackHref, documentBackHrefForLoan } from '@/lib/legal/access'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { asMoraRows, evaluateIntimation } from '@/lib/legal/mora'
import { loadContractPackForViewer } from '@/lib/legal/loan-pack'
import { requireUserId } from '@/lib/session'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function IntimacionPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const data = await loadContractPackForViewer(userId, String((await params).id ?? '').trim())
  const backHref = data
    ? await documentBackHrefForLoan(userId, data.loanId)
    : await documentBackHref(userId)

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Intimación no encontrada</h1>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const decision = evaluateIntimation(asMoraRows(data.installments), data.lastRefinanceAt)
  const snapshot = data.lastIntimation
  const items = decision.items

  if (!decision.ok || !items.length) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold">No corresponde intimar</h1>
          <p className="text-sm text-muted-foreground">{decision.message}</p>
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
      meta={`${snapshot?.number || 'Intimación'} · CTR-${data.id.slice(0, 8).toUpperCase()}`}
      fileName={documentPdfBaseName(
        'Intimacion',
        snapshot?.number || shortDocCode(data.id, 'INT'),
      )}
      extra={<DocumentPackLinks contractId={data.id} loanId={data.loanId} intimable />}
    >
      <IntimacionPrintable
        contract={data}
        items={items}
        noticeNumber={snapshot?.number}
        issuedAt={snapshot?.at}
      />
    </DocumentPreviewShell>
  )
}
