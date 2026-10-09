import { verifyAdminOtp } from '@/lib/admin-otp'
import { adminJson, authErrorStatus, requestMeta } from '@/lib/admin-api'
import { requirePermission } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE = {
  none: 'No hay un c\u00f3digo vigente. Ped\u00ed uno nuevo.',
  expired: 'El c\u00f3digo venci\u00f3. Ped\u00ed uno nuevo.',
  locked: 'Demasiados intentos. Ped\u00ed un c\u00f3digo nuevo.',
  invalid: 'C\u00f3digo incorrecto.',
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