import { redirect } from 'next/navigation'
import { customerDashboardDocUrl } from '@/lib/documents/customer-view'
import { getRoleForUser, requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function MyArcaConstanciaPage() {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role === 'customer') {
    redirect(customerDashboardDocUrl('arca', userId))
  }
  redirect(`/dashboard/documentos/constancia-arca/${userId}?print=1`)
}
