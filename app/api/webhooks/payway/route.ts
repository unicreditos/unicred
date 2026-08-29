import { NextRequest, NextResponse } from 'next/server'
import { notifyPaymentReceived, notifyPaymentRejected } from '@/lib/notify-email'
import { validatePaywayWebhook } from '@/lib/payway'
import { creditWallet } from '@/lib/payments/wallet'
import { settlePaywayPayment } from '@/lib/payments/settle-payway'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest) {
  return validatePaywayWebhook({
    secretHeader: req.headers.get('x-payway-secret') ?? req.headers.get('x-webhook-secret'),
    querySecret: req.nextUrl.searchParams.get('secret'),
    authorization: req.headers.get('authorization'),
  })
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    webhook: 'payway',
    time: new Date().toISOString(),
    mode: process.env.PAYWAY_ENV === 'production' ? 'production' : 'sandbox',
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const nested = body?.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : {}
  const meta = body?.metadata && typeof body.metadata === 'object' ? (body.metadata as Record<string, unknown>) : {}
  const paywayId = String(body?.id ?? body?.payment_id ?? nested.id ?? '')
  const localPaymentId = String(body?.local_payment_id ?? meta.local_payment_id ?? '')
  const status = String(body?.status ?? nested.status ?? '')
  const amount = Number(body?.amount ?? nested.amount ?? 0)
  const method = body?.method ? String(body.method) : null
  const eventType = String(body?.type ?? body?.event ?? nested.type ?? nested.event ?? '').toLowerCase()
  const cvu = String(body?.cvu ?? nested.cvu ?? meta.cvu ?? '').replace(/\D/g, '')
  const alias = String(body?.alias ?? nested.alias ?? meta.alias ?? '')
    .replace(/^@/, '')
    .toLowerCase()
  const walletEvent =
    eventType.includes('wallet') ||
    eventType.includes('virtual') ||
    eventType.includes('cvu') ||
    Boolean(cvu && !localPaymentId && !paywayId)

  if (walletEvent && amount > 0 && (cvu || alias)) {
    const credited = await creditWallet({
      cvu: cvu || undefined,
      alias: alias || undefined,
      amount,
      kind: 'inbound_transfer',
      externalId: paywayId || `wh-${cvu || alias}-${amount}`,
      reference: String(body?.reference ?? nested.reference ?? paywayId ?? ''),
      notes: 'Acreditación Payway / cuenta virtual',
    })
    if (credited.matched) {
      try {
        revalidatePath('/dashboard')
      } catch (e) {
        console.warn('[payway-webhook] revalidatePath omitido:', e)
      }
    }
    return NextResponse.json({ ok: true, wallet: credited })
  }

  if (!status || (!paywayId && !localPaymentId)) {
    return NextResponse.json({ ok: true, matched: false, reason: 'sin_id_payway' })
  }

  const result = await settlePaywayPayment({
    status,
    amount,
    paywayId: paywayId || null,
    localPaymentId: localPaymentId || null,
    externalReference: body?.external_reference ? String(body.external_reference) : null,
    method,
    gatewayPayload: body,
  })

  if (result.matched && result.credited > 0 && result.userId) {
    try {
      revalidatePath('/dashboard')
    } catch (e) {
      console.warn('[payway-webhook] revalidatePath omitido:', e)
    }
    await notifyPaymentReceived({
      userId: result.userId,
      amount: result.amount ?? 0,
      installmentNumber: result.installmentNumber,
      receiptId: result.receiptId,
    })
  } else if (result.matched && result.rejected && result.userId) {
    await notifyPaymentRejected({
      userId: result.userId,
      amount: result.amount ?? 0,
      reason: result.reason,
    })
  }

  return NextResponse.json({ ok: true, ...result })
}
