import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileMyLoans } from '@/lib/mobile/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const items = await mobileMyLoans(userId)
    return mobileJson(req, items)
  } catch {
    return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
  }
}
