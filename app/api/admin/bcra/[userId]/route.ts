import { adminJson, authFailure, rejectCrossOrigin } from '@/lib/admin-api'
import { bcraHistory, refreshBcra } from '@/lib/admin-external'
import { consumeRateLimit } from '@/lib/rate-limit'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Historial completo de consultas BCRA de un cliente. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requirePermission('risk.read')
  } catch (err) {
    return authFailure(err)
  }
  const { userId } = await params
  return adminJson({ ok: true, items: await bcraHistory(userId) })
}

/** Nueva consulta BCRA (máximo 5 por hora y cliente). */
export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const cross = rejectCrossOrigin(req)
  if (cross) return cross
  let actor: string
  try {
    actor = await requirePermission('risk.score.write')
  } catch (err) {
    return authFailure(err)
  }
  const { userId } = await params
  const gate = await consumeRateLimit(`bcra-refresh:${userId}`, 5, 60 * 60_000)
  if (!gate.ok) return adminJson({ ok: false, message: 'Demasiadas consultas. Probá más tarde.' }, 429)
  try {
    const r = await refreshBcra(userId, actor)
    return adminJson({ ok: true, checkId: r.checkId })
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, 400)
  }
}