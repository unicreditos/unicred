import { adminUrl, parseAdminSection } from '@/lib/admin-nav'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  redirect(adminUrl(parseAdminSection(section)))
}
