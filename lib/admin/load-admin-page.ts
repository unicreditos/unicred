import { requireAdmin } from '@/app/actions/admin'
import { getDashboardUrlByRole, getRoleForUser, getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export type AdminPageUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

export async function loadAdminPageUser(): Promise<AdminPageUser> {
  const userId = await requireAdmin()
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  const role = await getRoleForUser(userId)
  if (role !== 'admin') redirect(getDashboardUrlByRole(role))
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  }
}
