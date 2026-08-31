import { getAccountHref } from '@/lib/session'
import { installmentPosPath } from '@/lib/workspace-gate'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicPagarPage({
  params,
}: {
  params: Promise<{ installmentId: string }>
}) {
  const installmentId = String((await params).installmentId ?? '').trim()
  const dest = installmentPosPath(installmentId)
  const { isLoggedIn } = await getAccountHref()
  if (isLoggedIn) {
    redirect(dest)
  }
  redirect(`/sign-in?next=${encodeURIComponent(dest)}`)
}
