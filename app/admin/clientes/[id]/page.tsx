import { getAdminClientFicha } from '@/app/actions/admin-ficha'
import { ClientFicha } from '@/components/admin/client-ficha'
import { AdminCaseShell } from '@/components/admin/admin-case-shell'
import { loadAdminPageUser } from '@/lib/admin/load-admin-page'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await loadAdminPageUser()
  let ficha
  try {
    ficha = await getAdminClientFicha(id)
  } catch {
    notFound()
  }
  if (!ficha) notFound()

  return (
    <AdminCaseShell
      user={user}
      activeTab="usuarios"
      title={ficha.user.name}
      subtitle="Cuenta, cobranzas, recibos y expediente"
    >
      <ClientFicha ficha={ficha} />
    </AdminCaseShell>
  )
}
