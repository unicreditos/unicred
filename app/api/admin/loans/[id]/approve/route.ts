import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import {
  requireMobileAdmin,
  mobileAdminApproveLoan,
} from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request,{ params }: { params: Promise<Record<string, string>> }) {
  try {
    const userId = await requireMobileUserId(req)
    await requireMobileAdmin(userId, 'credits.approve')
    const body = await req.json().catch(() => ({})) as { note?: string; comment?: string }
    const id = String((await params).id); return mobileJson(req, await mobileAdminApproveLoan(userId, id, String(body.note || body.comment || '')))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status = /unauthor/i.test(message) || message === 'unauthorized' ? 401 : /No autorizado/i.test(message) ? 403 : 400
    return mobileJson(req, { message }, { status })
  }
}
