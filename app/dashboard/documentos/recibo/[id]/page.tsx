import { DocumentPackLinks } from '@/components/documents/document-pack-links'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { PaymentReceiptPrintable } from '@/components/documents/payment-receipt-printable'
import { Button } from '@/components/ui/button'
import { receiptBranding } from '@/lib/brand'
import { db } from '@/lib/db'
import { paymentReceipt, disbursement, profile, user, bankAccount } from '@/lib/db/schema'
import { canViewOwnedRecord, receiptBackHrefForRole } from '@/lib/legal/access'
import { documentPdfBaseName } from '@/lib/document-filename'
import { getRoleForUser, requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const defaultBranding = receiptBranding()

function parseJson(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return { raw: value }
    }
  }
  return value
}

async function getIdentity(userId: string) {
  const rows = await db
    .select({ profile: profile, user: user })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.userId, userId))
    .limit(1)
  return { p: rows[0]?.profile ?? null, u: rows[0]?.user ?? null }
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  const backHref = receiptBackHrefForRole(role)
  const { id: rawId } = await params
  const id = String(rawId ?? '').trim()

  const [receiptRaw] = await db
    .select()
    .from(paymentReceipt)
    .where(eq(paymentReceipt.id, id))
    .limit(1)
  const receipt =
    receiptRaw && (await canViewOwnedRecord(userId, receiptRaw.userId)) ? receiptRaw : null

  let data = null
  let notFound = false

  if (!receipt) {
    const [disbRaw] = await db
      .select()
      .from(disbursement)
      .where(eq(disbursement.id, id))
      .limit(1)
    const disb = disbRaw && (await canViewOwnedRecord(userId, disbRaw.userId)) ? disbRaw : null

    if (disb) {
      const { p, u } = await getIdentity(disb.userId)
      let bank = null
      if (disb.bankAccountId) {
        const [b] = await db
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.id, disb.bankAccountId))
          .limit(1)
        bank = b ?? null
      }
      data = {
        id: disb.id,
        receiptNumber: disb.receiptNumber ?? `ACR-${disb.id.slice(0, 10)}`,
        receiptType: 'disbursement',
        issuedAt: disb.creditedAt ?? disb.createdAt,
        paidAt: disb.creditedAt ?? disb.createdAt,
        amount: disb.amount,
        currency: disb.currency ?? 'ARS',
        method: disb.disbursementMethod,
        referenceNumber: disb.referenceNumber ?? disb.externalId,
        loanSnapshot: {
          id: disb.loanId,
          principal: disb.netAmount ?? disb.amount,
          status: 'disbursed',
        },
        installmentSnapshot: null,
        previousBalance: null,
        newBalance: null,
        pendingInstallments: null,
        totalPaidToDate: null,
        customerSnapshot: {
          name: u?.name ?? null,
          cuil: p?.cuil ?? null,
          dni: p?.dni ?? null,
          email: u?.email ?? null,
          phone: p?.phone ?? null,
          employmentStatus: p?.employmentStatus ?? null,
          province: p?.province ?? null,
          city: p?.city ?? null,
          address: p?.address ?? null,
        },
        bankAccountSnapshot: bank
          ? {
              bankName: bank.bankName,
              accountType: bank.accountType,
              cbu: bank.cbu,
              cvu: bank.cvu,
              alias: bank.alias,
              holderName: bank.holderName,
              holderCuil: bank.holderCuil,
            }
          : null,
        branding: { ...defaultBranding },
      }
    } else {
      notFound = true
    }
  } else {
    const baseCustomer = (parseJson(receipt.customerSnapshot) as Record<string, unknown> | null) ?? {}
    if (!baseCustomer.name || !baseCustomer.email) {
      const { p, u } = await getIdentity(receipt.userId)
      baseCustomer.name = baseCustomer.name ?? u?.name ?? null
      baseCustomer.cuil = baseCustomer.cuil ?? p?.cuil ?? null
      baseCustomer.dni = baseCustomer.dni ?? p?.dni ?? null
      baseCustomer.email = baseCustomer.email ?? u?.email ?? null
      baseCustomer.phone = baseCustomer.phone ?? p?.phone ?? null
      baseCustomer.employmentStatus = baseCustomer.employmentStatus ?? p?.employmentStatus ?? null
      baseCustomer.province = baseCustomer.province ?? p?.province ?? null
      baseCustomer.city = baseCustomer.city ?? p?.city ?? null
      baseCustomer.address = baseCustomer.address ?? p?.address ?? null
    }
    data = {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      receiptType: receipt.receiptType,
      issuedAt: receipt.issuedAt ?? receipt.createdAt,
      paidAt: receipt.paidAt,
      amount: receipt.amount,
      currency: receipt.currency ?? 'ARS',
      method: receipt.method,
      referenceNumber: receipt.referenceNumber,
      loanSnapshot: parseJson(receipt.loanSnapshot) as Record<string, unknown> | null,
      installmentSnapshot: parseJson(receipt.installmentSnapshot) as Record<string, unknown> | null,
      previousBalance: receipt.previousBalance,
      newBalance: receipt.newBalance,
      pendingInstallments: receipt.pendingInstallments,
      totalPaidToDate: receipt.totalPaidToDate,
      customerSnapshot: baseCustomer,
      bankAccountSnapshot: parseJson(receipt.bankAccountSnapshot) as Record<string, unknown> | null,
      branding: (parseJson(receipt.branding) as Record<string, unknown> | null) ?? { ...defaultBranding },
    }
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-bold">Comprobante no encontrado</h1>
          <Link href={backHref}>
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver al panel
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <DocumentPreviewShell
      backHref={backHref}
      meta={`Comprobante ${data.receiptNumber}`}
      fileName={documentPdfBaseName('Comprobante', String(data.receiptNumber))}
      extra={<DocumentPackLinks receiptId={data.id} />}
    >
      <PaymentReceiptPrintable receipt={data} />
    </DocumentPreviewShell>
  )
}
