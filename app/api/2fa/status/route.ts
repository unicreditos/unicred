import { handleStatus } from '@/lib/totp-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handleStatus()
}
