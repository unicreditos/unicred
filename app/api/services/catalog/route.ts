import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileServicesCatalog } from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  return mobileJson(req, mobileServicesCatalog())
}
