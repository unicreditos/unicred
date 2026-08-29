import { NextResponse } from 'next/server'
import { listQueuedPayouts, markTreasuryPayoutExecuted } from '@/lib/payments/wallet'
import { requireAdmin } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/wallet/payouts — cola de egresos (admin). */
export async function GET() {
  try {
    await requireAdmin()
    const payouts = await listQueuedPayouts(100)
    return NextResponse.json({ ok: true, payouts })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 401 })
  }
}

/** POST /api/wallet/payouts — confirmar ejecución desde tesorería RM. */
export async function POST(req: Request) {
  try {
    const adminId = await requireAdmin()
    const body = await req.json().catch(() => null)
    const payoutId = String(body?.payoutId ?? '').trim()
    if (!payoutId) {
      return NextResponse.json({ ok: false, error: 'Falta payoutId.' }, { status: 400 })
    }
    const result = await markTreasuryPayoutExecuted(payoutId, adminId)
    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return NextResponse.json({ ok: true, already: result.already })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 })
  }
}
