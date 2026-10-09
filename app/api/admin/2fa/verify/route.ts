import { handleVerifyCode } from '@/lib/second-factor-api'
import { assertAdmin } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Valida el código y liga el segundo factor a la sesión actual. */
export async function POST(req: Request) {
  return handleVerifyCode(req, () => assertAdmin({ skipSecondFactor: true }))
}