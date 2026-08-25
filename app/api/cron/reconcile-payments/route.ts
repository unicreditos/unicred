import { NextRequest, NextResponse } from 'next/server'
import { reconcileOpenMercadoPagoPayments } from '@/lib/payments/settle-mp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) return true
  if (req.headers.get('x-vercel-cron') === '1') return true
  return false
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const results = await reconcileOpenMercadoPagoPayments(120)
  const credited = results.filter((r) => r.credited > 0).length
  return NextResponse.json({ ok: true, scanned: results.length, credited })
}
