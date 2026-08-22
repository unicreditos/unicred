import { redirect } from 'next/navigation'
import { getSession, getOrCreateProfile } from '@/lib/session'
import { getLoanProducts, getMyLoans } from '@/app/actions/loans'
import { CustomerDashboard } from '@/components/customer-dashboard'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  const [profile, loans, products] = await Promise.all([getOrCreateProfile(), getMyLoans(), getLoanProducts()])
  if (!profile) redirect('/sign-in')
  return <CustomerDashboard user={session.user} profile={profile} loans={loans} products={products} />
}
