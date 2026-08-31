import { getAdminPaymentCase } from '@/app/actions/admin-cases'
import { AdminCaseShell } from '@/components/admin/admin-case-shell'
import { AdminPaymentCaseView } from '@/components/admin/admin-payment-case'
import { loadAdminPageUser } from '@/lib/admin/load-admin-page'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminPagoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, data] = await Promise.all([loadAdminPageUser(), getAdminPaymentCase(id)])
  if (!data) notFound()

  return (
    <AdminCaseShell
      user={user}
      activeTab="pagos"
      title={`Pago ${data.payment.status}`}
      subtitle={data.customer.name}
    >
      <AdminPaymentCaseView data={data} />
    </AdminCaseShell>
  )
}
