import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { LiquidacionPrintable } from '@/components/documents/liquidacion-printable'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { paymentReceipt, profile, user } from '@/lib/db/schema'
import { canViewOwnedRecord, receiptBackHrefForRole } from '@/lib/legal/access'
import { documentPdfBaseName } from '@/lib/document-filename'
import { getRoleForUser, requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function parseJson(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

export default async function LiquidacionPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  const backHref = receiptBackHrefForRole(role)
  const id = String((await params).id ?? '').trim()
  const [receiptRaw] = await db
    .select()
    .from(paymentReceipt)
    .where(eq(paymentReceipt.id, id))
    .limit(1)
  const receipt =
    receiptRaw && (await canViewOwnedRecord(userId, receiptRaw.userId)) ? receiptRaw : null

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Liquidación no encontrada</h1>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const loan = (parseJson(receipt.loanSnapshot) as Record<string, unknown> | null) ?? {}
  const inst = (parseJson(receipt.installmentSnapshot) as Record<string, unknown> | null) ?? {}
  let customer = (parseJson(receipt.customerSnapshot) as Record<string, unknown> | null) ?? {}
  if (!customer.name) {
    const rows = await db
      .select({ profile, user })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(eq(profile.userId, receipt.userId))
      .limit(1)
    customer = {
      name: rows[0]?.user.name,
      cuil: rows[0]?.profile.cuil,
      dni: rows[0]?.profile.dni,
      email: rows[0]?.user.email,
    }
  }

  return (
    <DocumentPreviewShell
      backHref={backHref}
      meta={`Liquidación ${receipt.receiptNumber}`}
      fileName={documentPdfBaseName('Liquidacion', String(receipt.receiptNumber))}
      extra={<DocumentPackLinks receiptId={receipt.id} />}
    >
      <LiquidacionPrintable
        data={{
          id: receipt.id,
          number: `LIQ-${receipt.receiptNumber}`,
          issuedAt: receipt.issuedAt ?? receipt.createdAt,
          paidAt: receipt.paidAt,
          amount: receipt.amount,
          method: receipt.method,
          reference: receipt.referenceNumber,
          customer: {
            name: customer.name as string | undefined,
            cuil: customer.cuil as string | undefined,
            dni: customer.dni as string | undefined,
            email: customer.email as string | undefined,
          },
          loan: {
            id: String(loan.id ?? receipt.loanId ?? ''),
            principal: loan.principal as string | number | undefined,
            term: loan.term as number | undefined,
            monthlyRate: loan.monthlyRate as string | number | undefined,
            tna: loan.tna as string | number | undefined,
          },
          installment: {
            number: inst.number as number | undefined,
            dueDate: inst.dueDate as Date | string | undefined,
            amount: inst.amount as string | number | undefined,
          },
        }}
      />
    </DocumentPreviewShell>
  )
}
