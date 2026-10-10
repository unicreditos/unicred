import { CouponBookPrintable } from '@/components/documents/coupon-book-printable'
import { loadCouponBookPay } from '@/lib/documents/coupon-book-loader'
import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { Button } from '@/components/ui/button'
import { keepCustomerInDashboard } from '@/lib/documents/keep-customer-in-dashboard'
import { documentPreviewFlags } from '@/lib/documents/preview-flags'
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

export default async function CuponeraPage({
  params,
  searchParams,
}: {
  params: Promise<{ loanId: string }>
  searchParams: Promise<{ embed?: string | string[]; print?: string | string[] }>
}) {
  const userId = await requireUserId()
  const loanId = String((await params).loanId ?? '').trim()
  const sp = await searchParams
  await keepCustomerInDashboard('talonario', loanId, sp)
  const { embed, autoPrint } = documentPreviewFlags(sp)
  const [loanRow] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, loanId)).limit(1)
  const allowed = loanRow ? await canViewOwnedRecord(userId, loanRow.userId) : false
  const data = allowed && loanRow ? await loadLoanPackByLoanId(loanRow.userId, loanId) : null
  const pay = data ? await loadCouponBookPay({ loanId, installments: data.installments }) : null
  const backHref = data ? await documentBackHrefForLoan(userId, loanId) : await documentBackHref(userId)

  if (!data || !pay) {
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
      hint="Vista previa A4. Imprimí o guardá como PDF: cronograma y un talón por cuota abierta con el QR de Mercado Pago y los códigos de Pago Fácil y Rapipago que emite Mercado Pago (las cuotas que vencen en más de 27 días reciben su código al volver a descargar)."
      embed={embed}
      autoPrint={autoPrint}
    >
      <CouponBookPrintable contract={data} pay={pay} />
    </DocumentPreviewShell>
  )
}
