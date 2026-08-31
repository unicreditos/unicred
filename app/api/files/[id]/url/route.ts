import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import {
  mobileFileUrl,
} from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request,{ params }: { params: Promise<Record<string, string>> }) {
  try {
    const userId = await requireMobileUserId(req)
    
    const body = ['POST','PUT','PATCH'].includes('GET') ? await req.json().catch(() => ({})) : {}
    const id = String((await params).id); return mobileJson(req, await mobileFileUrl(userId, id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status = /unauthor/i.test(message) || message === 'unauthorized' ? 401 : /No autorizado/i.test(message) ? 403 : 400
    return mobileJson(req, { message }, { status })
  }
}
