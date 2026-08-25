import { NextRequest, NextResponse } from 'next/server'
import { validateWebhookSecret, validateWebhookSignature } from '@/lib/mercadopago'
import { findLocalPaymentId, settleMercadoPagoPayment } from '@/lib/payments/settle-mp'
import { notifyPaymentReceived, notifyPaymentRejected } from '@/lib/notify-email'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (!validateWebhookSecret(secret ?? undefined)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    webhook: 'active',
    time: new Date().toISOString(),
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const body = await req.json().catch(() => null)

  const sigOk = validateWebhookSignature({
    headers: {
      'x-signature': req.headers.get('x-signature') ?? undefined,
      'x-request-id': req.headers.get('x-request-id') ?? undefined,
    },
    queryDataId: searchParams.get('data.id'),
    body,
    toleranceSeconds: 60 * 15,
  })
  const secretOk = validateWebhookSecret(searchParams.get('secret') ?? undefined)
  const production = process.env.NODE_ENV === 'production'
  if (production ? !sigOk : !sigOk && !secretOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    let mpPaymentId: string | null = null
    if (body?.data?.id) mpPaymentId = String(body.data.id)
    else if (body?.id) mpPaymentId = String(body.id)
    if (!mpPaymentId) {
      return NextResponse.json({ ok: true, matched: false, reason: 'sin_id_mp' })
    }

    const meta = (body?.data?.metadata ?? body?.metadata ?? {}) as Record<string, unknown>
    const localPaymentId = await findLocalPaymentId({
      mpPaymentId,
      preferenceId: body?.data?.preference_id ?? body?.preference_id ?? null,
      externalReference: body?.data?.external_reference ?? body?.external_reference ?? null,
      metadataPaymentId: meta.local_payment_id ? String(meta.local_payment_id) : null,
    })

    const result = await settleMercadoPagoPayment({
      mpPaymentId,
      localPaymentId,
      webhookBody: body,
    })

    if (result.matched && result.credited > 0 && result.userId) {
      try {
        revalidatePath('/dashboard')
      } catch (e) {
        console.warn('[mp-webhook] revalidatePath omitido:', e)
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

    return NextResponse.json({ ok: true, mpPaymentId, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error'
    console.error('[mp-webhook] Error fatal:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
