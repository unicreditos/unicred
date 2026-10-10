import { adminJson, authFailure, rejectCrossOrigin } from '@/lib/admin-api'
import { resendDiditWebhook } from '@/lib/admin-external'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  let actor: string
  try {
    actor = await requirePermission('kyc.review')
  } catch (err) {
    return authFailure(err)
  }
  const { id } = await params
  try {
    await resendDiditWebhook(id, actor)
    return adminJson({ ok: true })
  } catch (err) {
    console.error('[didit-resend]', (err as Error).message)
    return adminJson({ ok: false, message: 'No se pudo reprocesar el webhook. El detalle quedó en la auditoría.' }, 502)
  }
}