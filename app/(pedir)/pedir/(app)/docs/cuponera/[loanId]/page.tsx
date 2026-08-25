import { PedirDocMissing, PedirDocViewer } from '@/components/pedir/doc-viewer'
import { CouponBookPrintable } from '@/components/documents/coupon-book-printable'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { canViewOwnedRecord } from '@/lib/legal/access'
import { loadLoanPackByLoanId } from '@/lib/legal/loan-pack'
import { db } from '@/lib/db'
import { loan } from '@/lib/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function PedirCuponeraPage({ params }: { params: Promise<{ loanId: string }> }) {
  const userId = await requireUserId()
  const loanId = String((await params).loanId ?? '').trim()
  const [loanRow] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, loanId)).limit(1)
  const allowed = loanRow ? await canViewOwnedRecord(userId, loanRow.userId) : false
  const data = allowed && loanRow ? await loadLoanPackByLoanId(loanRow.userId, loanId) : null

  if (!data) {
    return (
      <PedirDocMissing
        title="Cuponera no encontrada"
        hint="El cronograma se emite con el crédito aprobado."
      />
    )
  }

  return (
    <PedirDocViewer
      title="Cuponera"
      meta={`Crédito · ${loanId.slice(-10)}`}
      fileName={documentPdfBaseName('Cuponera', shortDocCode(loanId, 'CUP'))}
      contractId={data.id}
      loanId={loanId}
    >
      <CouponBookPrintable contract={data} />
    </PedirDocViewer>
  )
}
