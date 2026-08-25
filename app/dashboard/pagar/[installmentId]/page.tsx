import { installmentPosPath } from '@/lib/workspace-gate'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PagarCuotaPage({
  params,
}: {
  params: Promise<{ installmentId: string }>
}) {
  const installmentId = String((await params).installmentId ?? '').trim()
  redirect(installmentPosPath(installmentId))
}
