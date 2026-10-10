import { handleVerifyCode } from '@/lib/second-factor-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handleVerifyCode(req)
}