import { getAdminMerchantCase } from '@/app/actions/admin-cases'
import { AdminCaseShell } from '@/components/admin/admin-case-shell'
import { AdminMerchantCaseView } from '@/components/admin/admin-merchant-case'
import { loadAdminPageUser } from '@/lib/admin/load-admin-page'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminComercioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, data] = await Promise.all([loadAdminPageUser(), getAdminMerchantCase(id)])
  if (!data) notFound()

  return (
    <AdminCaseShell
      user={user}
      activeTab="comercios"
      title={data.merchant.businessName}
      subtitle={data.merchant.legalName || 'Adhesión comercial'}
    >
      <AdminMerchantCaseView data={data} />
    </AdminCaseShell>
  )
}
