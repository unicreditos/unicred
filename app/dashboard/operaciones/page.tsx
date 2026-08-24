import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { OperationsDashboard } from '@/components/operations-dashboard'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { document, installment, loan, payment } from '@/lib/db/schema'

export default async function OperationsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const userId = session.user.id
  const [loans, installments, payments, documents] = await Promise.all([
    db.select().from(loan).where(eq(loan.userId, userId)).orderBy(desc(loan.createdAt)),
    db.select().from(installment).where(eq(installment.userId, userId)).orderBy(installment.number),
    db.select().from(payment).where(eq(payment.userId, userId)).orderBy(desc(payment.createdAt)),
    db.select().from(document).where(eq(document.userId, userId)).orderBy(desc(document.createdAt)),
  ])
  return <OperationsDashboard loans={loans} installments={installments} payments={payments} documents={documents} />
}
