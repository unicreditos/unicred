import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileGetNotifPrefs, mobileSetNotifPrefs } from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    return mobileJson(req, await mobileGetNotifPrefs(userId))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    return mobileJson(req, { message }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const body = await req.json().catch(() => ({}))
    return mobileJson(req, await mobileSetNotifPrefs(userId, body as Record<string, unknown>))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    return mobileJson(req, { message }, { status: 400 })
  }
}
