import { NextRequest, NextResponse } from 'next/server'
import { runMerchantMaintenance } from '@/lib/merchant-orders/maintenance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  // Sin secreto dedicado no se acepta el cron (evita spoof de x-vercel-cron).
  if (!secret) return false
  return (req.headers.get('authorization') ?? '') === `Bearer ${secret}`
}

/** Todos los días 08:00 (Argentina): plazos del cliente, QR de anticipos, feriados y resumen de tesorería. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const result = await runMerchantMaintenance()
  return NextResponse.json({ ok: true, ...result })
}
