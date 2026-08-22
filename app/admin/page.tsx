import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getAdminStats, getAllLoans, getPendingMerchants, getBcraVariables } from '@/app/actions/admin'
import { AdminDashboard } from '@/components/admin-dashboard'

export default async function AdminPage() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')

  let data
  try {
    data = await Promise.all([getAdminStats(), getAllLoans(), getPendingMerchants(), getBcraVariables()])
  } catch {
    redirect('/dashboard')
  }

  const [stats, loans, merchants, variables] = data
  return <AdminDashboard user={session.user} stats={stats} loans={loans} merchants={merchants} variables={variables} />
}
