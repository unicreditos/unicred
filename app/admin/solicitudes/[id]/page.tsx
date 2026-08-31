import { getAdminLoanCase } from '@/app/actions/admin-cases'
import { AdminCaseShell } from '@/components/admin/admin-case-shell'
import { AdminLoanCaseView } from '@/components/admin/admin-loan-case'
import { loadAdminPageUser } from '@/lib/admin/load-admin-page'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminSolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, data] = await Promise.all([loadAdminPageUser(), getAdminLoanCase(id)])
  if (!data) notFound()

  return (
    <AdminCaseShell
      user={user}
      activeTab="solicitudes"
      title={`Solicitud ${data.customer.name}`}
      subtitle={data.product?.name ?? 'Originación'}
    >
      <AdminLoanCaseView data={data} mode="solicitud" />
    </AdminCaseShell>
  )
}
