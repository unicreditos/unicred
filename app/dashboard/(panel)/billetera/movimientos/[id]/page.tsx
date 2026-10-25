import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { PageWidth } from '@/components/wallet/page-width'
import { PrintButton } from '@/components/documents/print-button'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/wallet/copy-button'
import { db } from '@/lib/db'
import { paymentReceipt, user as userTable } from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { requireCustomerId } from '@/lib/session'
import { cleanNoteText, parseMovementNote } from '@/lib/wallet/display'
import { ensureWallet } from '@/lib/wallet/ledger'
import { getMovement, isCredit, movementLabel } from '@/lib/wallet/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Detalle del movimiento' }
export const dynamic = 'force-dynamic'

function Row({ k, children, mono }: { k: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-sm text-muted-foreground">{k}</dt>
      <dd className={cn('text-right text-sm font-medium', mono && 'tnum')}>{children}</dd>
    </div>
  )
}

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCustomerId()
  const { id } = await params
  const wallet = await ensureWallet(userId)
  const m = await getMovement(wallet.id, decodeURIComponent(id))
  if (!m) notFound()

  const credit = isCredit(m.direction)
  const note = parseMovementNote(m.notes)
  const title = movementLabel(m.kind)
  const detail = cleanNoteText(title, note.text)
  const [counterparty] = m.counterpartyUserId ? await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, m.counterpartyUserId)).limit(1) : []
  const [receipt] = m.paymentId ? await db.select({ id: paymentReceipt.id, number: paymentReceipt.receiptNumber }).from(paymentReceipt).where(eq(paymentReceipt.paymentId, m.paymentId)).limit(1) : []

  return (
    <PageWidth width="max-w-2xl">
      <Link href="/dashboard/billetera/movimientos" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline print:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" /> Movimientos
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{credit ? 'Ingreso' : 'Egreso'}</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">{title}</h1>
          </div>
          <Badge variant={note.pending ? 'reviewing' : 'success'}>{note.pending ? 'Pendiente de acreditación' : 'Acreditado'}</Badge>
        </div>
        <p className={cn('tnum mt-6 text-4xl font-semibold tracking-tight', credit && !note.pending ? 'text-success' : '')}>
          {credit ? '+' : '−'} {formatMoney(m.amount)}
        </p>

        <dl className="mt-6 divide-y border-t">
          <Row k="Fecha y hora">{formatDateTime(m.createdAt)}</Row>
          {detail ? <Row k="Detalle">{detail}</Row> : null}
          {counterparty ? <Row k={credit ? 'Enviado por' : 'Enviado a'}>{counterparty.name}</Row> : null}
          {!note.pending ? (
            <Row k="Saldo después del movimiento" mono>
              {formatMoney(m.balanceAfter)}
            </Row>
          ) : null}
          {m.reference ? (
            <Row k="Referencia" mono>
              <span className="inline-flex items-center gap-1">
                {m.reference}
                <CopyButton value={m.reference} label="la referencia" />
              </span>
            </Row>
          ) : null}
          <Row k="N° de operación" mono>
            <span className="inline-flex items-center gap-1 break-all">
              {m.id}
              <CopyButton value={m.id} label="el número de operación" />
            </span>
          </Row>
          <Row k="Cuenta">
            {wallet.alias} · {wallet.holderName ?? ''}
          </Row>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <PrintButton label="Imprimir comprobante" fileName={`Movimiento-${m.id}`} />
          {receipt ? (
            <Link href={`/dashboard/documentos/recibo/${receipt.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <FileText aria-hidden="true" /> Ver recibo {receipt.number}
            </Link>
          ) : null}
        </div>
      </Card>
      <p className="mt-4 text-[13px] text-muted-foreground print:hidden">Guardá este comprobante: el número de operación sirve para cualquier consulta o reclamo.</p>
    </PageWidth>
  )
}
