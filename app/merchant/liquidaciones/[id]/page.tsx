import { SettlementDocument } from '@/components/merchant-orders/settlement-document'
import { requireUserId } from '@/lib/session'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Liquidación de comercio', robots: { index: false, follow: false } }

/** Comprobante de liquidación para el comercio dueño. */
export default async function MerchantSettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await requireUserId()
  const doc = await SettlementDocument({ id, canView: (owner) => owner === userId })
  if (!doc) notFound()
  return doc
}
