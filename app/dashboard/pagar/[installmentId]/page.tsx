import { db } from '@/lib/db'
import { installment } from '@/lib/db/schema'
import { requireCustomer } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PagarCuotaPage({
  params,
}: {
  params: Promise<{ installmentId: string }>
}) {
  const userId = await requireCustomer()
  const installmentId = String((await params).installmentId ?? '').trim()
  const [row] = await db
    .select({ id: installment.id, status: installment.status, loanId: installment.loanId })
    .from(installment)
    .where(and(eq(installment.id, installmentId), eq(installment.userId, userId)))
    .limit(1)

  if (!row || row.status === 'paid' || row.status === 'cancelled') {
    redirect('/dashboard?tab=cuotas')
  }

  redirect(`/dashboard?tab=pagos&cuota=${encodeURIComponent(row.id)}`)
}
