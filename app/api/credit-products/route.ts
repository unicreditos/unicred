import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileCreditProducts } from '@/lib/mobile/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function GET(req: Request) {
  try {
    const data = await mobileCreditProducts()
    return mobileJson(req, data)
  } catch (err) {
    return mobileJson(req, { message: (err as Error).message }, { status: 500 })
  }
}
