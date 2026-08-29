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
    backend: 'www.unicreditos.com',
    time: new Date().toISOString(),
    auth: 'Bearer JWT (BETTER_AUTH_SECRET)',
    endpoints: [
      'POST /api/auth/login',
      'POST /api/signup',
      'GET /api/auth/me',
      'GET /api/users/dashboard',
      'GET /api/wallet/me',
      'GET /api/loans',
      'GET /api/credit-products',
    ],
  })
}
