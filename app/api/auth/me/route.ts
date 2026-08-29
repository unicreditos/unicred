import { mobileMe, requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const result = await mobileMe(userId)
    return mobileJson(req, result)
  } catch {
    return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
  }
}
