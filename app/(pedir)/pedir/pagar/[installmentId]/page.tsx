import { PedirPayClient } from '@/components/pedir/pay-page'
import { db } from '@/lib/db'
import { installment } from '@/lib/db/schema'
import { getSession, requireCustomer } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PedirPagarPage({
  params,
}: {
  params: Promise<{ installmentId: string }>
}) {
  const session = await getSession()
  if (!session?.user?.id) {
    const id = String((await params).installmentId ?? '').trim()
    redirect(`/pedir/ingresar?callbackUrl=${encodeURIComponent(`/pedir/pagar/${id}`)}`)
  }

  await requireCustomer()
  const installmentId = String((await params).installmentId ?? '').trim()
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
    .where(and(eq(installment.id, installmentId), eq(installment.userId, session.user.id)))
    .limit(1)

  if (!row || row.status === 'paid' || row.status === 'cancelled') {
    redirect('/pedir/cuenta')
  }

  return (
    <PedirPayClient
      email={session.user.email ?? null}
      installment={{
        id: row.id,
        number: row.number,
        amount: row.amount,
        dueDate: row.dueDate,
        loanId: row.loanId,
      }}
    />
  )
}
