import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileSupportList, mobileSupportPost } from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const u = new URL(req.url)
    return mobileJson(
      req,
      await mobileSupportList(
        userId,
        Number(u.searchParams.get('page') || 1),
        Number(u.searchParams.get('limit') || 50),
      ),
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    return mobileJson(req, { message }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const body = await req.json().catch(() => ({}))
    return mobileJson(req, await mobileSupportPost(userId, String((body as { message?: string }).message || '')))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    return mobileJson(req, { message }, { status: 400 })
  }
}
