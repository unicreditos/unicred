import { InstallmentCashTicketPrintable } from '@/components/documents/installment-cash-ticket-printable'
import { DocumentPreviewShell } from '@/components/documents/document-preview-shell'
import { Button } from '@/components/ui/button'
import { documentPreviewFlags } from '@/lib/documents/preview-flags'
import { documentPdfBaseName } from '@/lib/document-filename'
import { db } from '@/lib/db'
import { installment, profile, user as userTable } from '@/lib/db/schema'
import { ensureInstallmentNetworkTicket } from '@/lib/payments/installment-mp-ticket'
import type { MpOfflineTicketNetwork } from '@/lib/mercadopago'
import { MP_CONFIG } from '@/lib/mercadopago'
import { requireCustomer } from '@/lib/session'
import { solRef } from '@/lib/customer/view'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function parseNetwork(raw: string | undefined): MpOfflineTicketNetwork {
  return raw === 'rapipago' ? 'rapipago' : 'pagofacil'
}

export default async function CuponRedPage({
  params,
  searchParams,
}: {
  params: Promise<{ installmentId: string }>
  searchParams: Promise<{ network?: string; embed?: string; print?: string }>
}) {
  const userId = await requireCustomer()
  const installmentId = String((await params).installmentId ?? '').trim()
  const sp = await searchParams
  const network = parseNetwork(sp.network)
  const { embed, autoPrint } = documentPreviewFlags(sp)

  const [row] = await db
    .select({
      id: installment.id,
      number: installment.number,
      amount: installment.amount,
      dueDate: installment.dueDate,
      status: installment.status,
      loanId: installment.loanId,
    })
    .from(installment)
    .where(and(eq(installment.id, installmentId), eq(installment.userId, userId)))
    .limit(1)

  if (!row || row.status === 'paid' || row.status === 'cancelled') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-bold">Cupón no disponible</h1>
          <p className="text-sm text-muted-foreground">La cuota no está abierta o no te pertenece.</p>
          <Link href="/dashboard/pagos">
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Volver a pagos
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!MP_CONFIG.accessTokenSet) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">Mercado Pago no está disponible. Probá más tarde.</p>
      </div>
    )
  }

  const [payer] = await db
    .select({ email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  const [prof] = await db.select({ dni: profile.dni, cuil: profile.cuil }).from(profile).where(eq(profile.userId, userId)).limit(1)
  const email = payer?.email?.trim()
  if (!email) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">Falta el correo de tu cuenta para emitir el cupón.</p>
      </div>
    )
  }

  const payerFirst = payer?.name?.split(' ')[0]
  const payerLast = payer?.name?.split(' ').slice(1).join(' ') || undefined
  const identificationNumber = (prof?.cuil || prof?.dni || '').replace(/\D/g, '') || undefined
  const identificationType = identificationNumber
    ? identificationNumber.length === 11
      ? 'CUIT'
      : 'DNI'
    : undefined

  let ticket
  try {
    ticket = await ensureInstallmentNetworkTicket({
      userId,
      loanId: row.loanId,
      installmentId: row.id,
      number: row.number,
      amount: Number(row.amount),
      dueDate: row.dueDate,
      network,
      payerEmail: email,
      payerFirstName: payerFirst,
      payerLastName: payerLast,
      identificationType,
      identificationNumber,
    })
  } catch (err) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-bold">No se pudo emitir el cupón</h1>
          <p className="text-sm text-muted-foreground">{(err as Error).message}</p>
          <Link href="/dashboard/pagos">
            <Button variant="outline">Volver a pagos</Button>
          </Link>
        </div>
      </div>
    )
  }

  const label = network === 'rapipago' ? 'Rapipago' : 'Pago Fácil'
  const fileName = documentPdfBaseName(`Cupón ${label}`, `CUO-${row.number}`)

  return (
    <DocumentPreviewShell
      backHref="/dashboard/pagos"
      meta={`Cupón ${label} · cuota ${row.number}`}
      fileName={fileName}
      embed={embed}
      autoPrint={autoPrint}
      hint="Cupón emitido por Mercado Pago. Imprimilo o guardalo como PDF y presentalo en la red antes del vencimiento."
    >
      <InstallmentCashTicketPrintable
        ticket={ticket}
        holderName={payer?.name ?? 'Titular'}
        cuotaLabel={`${String(row.number).padStart(2, '0')}`}
        loanRef={solRef(row.loanId)}
        amount={Number(row.amount)}
        dueDate={row.dueDate}
      />
    </DocumentPreviewShell>
  )
}
