import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileListLoans } from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const status = new URL(req.url).searchParams.get('status') || undefined
    return mobileJson(req, await mobileListLoans(userId, status))
  } catch {
    return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
  }
}
