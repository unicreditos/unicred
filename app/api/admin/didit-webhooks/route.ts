import { adminJson, authErrorStatus } from '@/lib/admin-api'
import { listDiditWebhooks } from '@/lib/admin-external'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Webhooks de Didit recibidos. ?failed=1 devuelve solo los que no se procesaron. */
export async function GET(req: Request) {
  try {
    await requirePermission('kyc.review')
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, authErrorStatus(err))
  }
  const failed = new URL(req.url).searchParams.get('failed') === '1'
  try {
    return adminJson({ ok: true, items: await listDiditWebhooks({ onlyFailed: failed }) })
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, 500)
  }
}