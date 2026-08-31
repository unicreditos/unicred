import { adminClientHref } from '@/lib/admin-nav'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminClientFichaRedirect({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  redirect(adminClientHref(userId))
}
