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
      'PUT /api/users/profile',
      'POST /api/loans/apply',
      'GET /api/loans/:id/contract',
      'POST /api/loans/:id/sign',
      'GET /api/wallet/me',
      'POST /api/wallet/topup|transfer|payout|pay-installments',
      'POST /api/payments/create',
      'GET /api/services/*',
      'GET /api/admin/dashboard',
    ],
  })
}
