import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

/** Health del puente mobile ↔ unicred (sin auth). */
export async function GET(req: Request) {
  return mobileJson(req, {
    ok: true,
    bridge: 'unicred-mobile',
    time: new Date().toISOString(),
  })
}
