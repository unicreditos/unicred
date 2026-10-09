import { adminJson, authErrorStatus } from '@/lib/admin-api'
import { resendDiditWebhook } from '@/lib/admin-external'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor: string
  try {
    actor = await requirePermission('kyc.review')
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, authErrorStatus(err))
  }
  const { id } = await params
  try {
    await resendDiditWebhook(id, actor)
    return adminJson({ ok: true })
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, 400)
  }
}