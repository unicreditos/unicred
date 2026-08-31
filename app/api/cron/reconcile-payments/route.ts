import { NextRequest, NextResponse } from 'next/server'
import { reconcileOpenDiditSessions } from '@/lib/kyc/reconcile-didit'
import { reconcileOpenMercadoPagoPayments } from '@/lib/payments/settle-mp'
import { expireStalePayments } from '@/lib/payments/expire'

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

  const [payments, kyc] = await Promise.all([
    reconcileOpenMercadoPagoPayments(120),
    reconcileOpenDiditSessions(40),
  ])
  const expired = await expireStalePayments()

  return NextResponse.json({
    ok: true,
    payments: {
      scanned: payments.length,
      credited: payments.filter((r) => r.credited > 0).length,
      expired,
    },
    kyc: {
      scanned: kyc.length,
      applied: kyc.filter((r) => r.applied).length,
      errors: kyc.filter((r) => r.error).length,
    },
  })
}
