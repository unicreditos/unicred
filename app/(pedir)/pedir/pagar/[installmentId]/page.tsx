import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PedirPagarPage({
  params,
}: {
  params: Promise<{ installmentId: string }>
}) {
  const installmentId = String((await params).installmentId ?? '').trim()
  redirect(`/pagar/${installmentId}`)
}
