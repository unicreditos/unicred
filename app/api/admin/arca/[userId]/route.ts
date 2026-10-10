import { adminJson, authFailure, rejectCrossOrigin } from '@/lib/admin-api'
import { arcaForUser, refreshArca } from '@/lib/admin-external'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requirePermission('kyc.review')
  } catch (err) {
    return authFailure(err)
  }
  const { userId } = await params
  return adminJson({ ok: true, ...(await arcaForUser(userId)) })
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  let actor: string
  try {
    actor = await requirePermission('kyc.review')
  } catch (err) {
    return authFailure(err)
  }
  const { userId } = await params
  const gate = await consumeRateLimit(`arca-refresh:${userId}`, 5, 60 * 60_000)
  if (!gate.ok) return adminJson({ ok: false, message: 'Demasiadas consultas. Probá más tarde.' }, 429)
  try {
    const r = await refreshArca(userId, actor)
    return adminJson({ ok: true, mismatch: r.mismatch })
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, 400)
  }
}