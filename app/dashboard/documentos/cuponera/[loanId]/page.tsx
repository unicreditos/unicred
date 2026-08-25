import { CouponBookPrintable } from '@/components/documents/coupon-book-printable'
import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { Button } from '@/components/ui/button'
import { canViewOwnedRecord, documentBackHref, documentBackHrefForLoan } from '@/lib/legal/access'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { loadLoanPackByLoanId } from '@/lib/legal/loan-pack'
import { db } from '@/lib/db'
import { loan } from '@/lib/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CuponeraPage({ params }: { params: Promise<{ loanId: string }> }) {
  const userId = await requireUserId()
  const loanId = String((await params).loanId ?? '').trim()
  const [loanRow] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, loanId)).limit(1)
  const allowed = loanRow ? await canViewOwnedRecord(userId, loanRow.userId) : false
  const data = allowed && loanRow ? await loadLoanPackByLoanId(loanRow.userId, loanId) : null
  const backHref = data ? await documentBackHrefForLoan(userId, loanId) : await documentBackHref(userId)

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Cuponera no encontrada</h1>
          <p className="text-sm text-muted-foreground">El cronograma se emite con el crédito.</p>
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
      meta={`Cuponera · ${loanId}`}
      fileName={documentPdfBaseName('Cuponera', shortDocCode(loanId, 'CUP'))}
      extra={<DocumentPackLinks contractId={data.id} loanId={loanId} />}
    >
      <CouponBookPrintable contract={data} />
    </DocumentPreviewShell>
  )
}
