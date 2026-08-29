import { NextRequest, NextResponse } from 'next/server'
import { reconcileOpenDiditSessions } from '@/lib/kyc/reconcile-didit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const results = await reconcileOpenDiditSessions(40)
  return NextResponse.json({
    ok: true,
    scanned: results.length,
    applied: results.filter((r) => r.applied).length,
    errors: results.filter((r) => r.error).length,
  })
}
