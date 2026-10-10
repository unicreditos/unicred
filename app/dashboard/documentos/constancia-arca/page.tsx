import { redirect } from 'next/navigation'
import { customerDashboardDocUrl } from '@/lib/documents/customer-view'
import { getRoleForUser, requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function MyArcaConstanciaPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>
}) {
  const userId = await requireUserId()
  const role = await getRoleForUser(userId)
  if (role === 'customer') {
    redirect(customerDashboardDocUrl('arca', userId))
  }
  const { embed } = await searchParams
  redirect(`/dashboard/documentos/constancia-arca/${userId}${embed === '1' ? '?embed=1' : ''}`)
}
