import { verifyAdminOtp } from '@/lib/admin-otp'
import { adminJson, authErrorStatus, requestMeta } from '@/lib/admin-api'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE = {
  none: 'No hay un código vigente. Pedí uno nuevo.',
  expired: 'El código venció. Pedí uno nuevo.',
  locked: 'Demasiados intentos. Pedí un código nuevo.',
  invalid: 'Código incorrecto.',
} as const

export async function POST(req: Request) {
  let userId: string
  try {
    userId = await requirePermission('kyc.review')
  } catch (err) {
    return adminJson({ ok: false, message: (err as Error).message }, authErrorStatus(err))
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown }
  const { ip } = requestMeta(req)
  const res = await verifyAdminOtp({ userId, code: String(body.code ?? ''), ip })
  if (!res.ok) return adminJson({ ok: false, reason: res.reason, message: MESSAGE[res.reason] }, 400)
  return adminJson({ ok: true })
}