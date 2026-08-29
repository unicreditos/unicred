import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileWalletMovements } from '@/lib/mobile/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const url = new URL(req.url)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20)))
    const data = await mobileWalletMovements(userId, limit)
    return mobileJson(req, data)
  } catch {
    return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
  }
}
