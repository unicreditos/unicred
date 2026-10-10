import { handleDisable } from '@/lib/totp-api'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handleDisable(req)
}
