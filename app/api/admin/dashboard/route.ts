import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import {
  requireMobileAdmin,
  mobileAdminDashboard,
} from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    await requireMobileAdmin(userId)
    const body = ['POST','PUT','PATCH'].includes('GET') ? await req.json().catch(() => ({})) : {}
    return mobileJson(req, await mobileAdminDashboard())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status = /unauthor/i.test(message) || message === 'unauthorized' ? 401 : /No autorizado/i.test(message) ? 403 : 400
    return mobileJson(req, { message }, { status })
  }
}
