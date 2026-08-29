import { NextResponse } from 'next/server'
import {
  ensureWalletAccount,
  payInstallmentsFromWallet,
  reportWalletInbound,
  transferFromWallet,
} from '@/lib/payments/wallet'
import { loadWalletSandbox } from '@/lib/payments/wallet'
import { requireUserId } from '@/lib/session'
import { notifyPaymentReceived } from '@/lib/notify-email'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/wallet — saldo, movimientos y órdenes de egreso. */
export async function GET() {
  try {
    const userId = await requireUserId()
    const wallet = await ensureWalletAccount(userId)
    return NextResponse.json({ ok: true, wallet })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 401 })
  }
}

/**
 * POST /api/wallet
 * body.action:
 *  - deposit | topup_sandbox | transfer | pay_installments
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = await req.json().catch(() => null)
    const action = String(body?.action ?? '').trim()

    if (action === 'topup_sandbox') {
      const wallet = await loadWalletSandbox(userId, Number(body?.amount) || 0)
      revalidatePath('/dashboard')
      return NextResponse.json({ ok: true, wallet })
    }

    if (action === 'deposit') {
      const wallet = await reportWalletInbound(
        userId,
        Number(body?.amount) || 0,
        String(body?.origin ?? ''),
      )
      revalidatePath('/dashboard')
      return NextResponse.json({ ok: true, wallet })
    }

    if (action === 'transfer') {
      const wallet = await transferFromWallet(
        userId,
        Number(body?.amount) || 0,
        String(body?.destination ?? ''),
        body?.concept ? String(body.concept) : undefined,
      )
      revalidatePath('/dashboard')
      return NextResponse.json({
        ok: true,
        wallet,
        mode:
          wallet.movements[0]?.kind === 'p2p_out'
            ? 'internal_p2p'
            : wallet.movements[0]?.kind === 'treasury_payout'
              ? 'treasury_payout'
              : 'transfer',
      })
    }

    if (action === 'pay_installments') {
      const ids = Array.isArray(body?.installmentIds)
        ? body.installmentIds.map((id: unknown) => String(id))
        : []
      const result = await payInstallmentsFromWallet(userId, ids)
      if (result.credited > 0) {
        await notifyPaymentReceived({
          userId,
          amount: result.amount,
          receiptId: result.receiptId,
        })
      }
      revalidatePath('/dashboard')
      return NextResponse.json({ ok: true, result })
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Acción inválida. Usá: topup_sandbox | deposit | transfer | pay_installments',
      },
      { status: 400 },
    )
  } catch (err) {
    const message = (err as Error).message || 'Error'
    const status = /sesión|ingres/i.test(message) ? 401 : 400
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
