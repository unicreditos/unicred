import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileFullProfile, mobileUpdateProfile } from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    return mobileJson(req, await mobileFullProfile(userId))
  } catch {
    return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const body = await req.json().catch(() => ({}))
    return mobileJson(req, await mobileUpdateProfile(userId, body as Record<string, unknown>))
  } catch (err) {
    return mobileJson(req, { message: (err as Error).message }, { status: 400 })
  }
}
