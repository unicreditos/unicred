import { SettlementDocument } from '@/components/merchant-orders/settlement-document'
import { NoAccess } from '@/components/uc/blocks'
import { loadDeskChrome } from '@/lib/admin-desk/load'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Liquidación de comercio' }

/** Comprobante de liquidación para tesorería (mismo documento que ve el comercio). */
export default async function AdminSettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { perms } = await loadDeskChrome()
  if (!perms.has('payments.read') && !perms.has('finance.read')) return <NoAccess what="las liquidaciones a comercios" />
  const { id } = await params
  const doc = await SettlementDocument({ id, canView: () => true })
  if (!doc) notFound()
  return doc
}
