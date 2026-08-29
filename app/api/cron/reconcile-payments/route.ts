import { NextRequest, NextResponse } from 'next/server'
import { reconcileOpenMercadoPagoPayments } from '@/lib/payments/settle-mp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    // Sin secreto dedicado no se acepta el cron (evita spoof de x-vercel-cron).
    return false
  }
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const results = await reconcileOpenMercadoPagoPayments(120)
  const credited = results.filter((r) => r.credited > 0).length
  return NextResponse.json({ ok: true, scanned: results.length, credited })
}
