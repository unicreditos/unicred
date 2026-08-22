import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getMyMerchant, getMerchantSales } from '@/app/actions/merchant'
import { MerchantDashboard } from '@/components/merchant-dashboard'

export default async function MerchantPage() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  const [merchant, sales] = await Promise.all([getMyMerchant(), getMerchantSales()])
  return <MerchantDashboard user={session.user} merchant={merchant} sales={sales} />
}
