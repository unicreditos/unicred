import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileDashboard } from '@/lib/mobile/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const data = await mobileDashboard(userId)
    return mobileJson(req, data)
  } catch {
    return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
  }
}
