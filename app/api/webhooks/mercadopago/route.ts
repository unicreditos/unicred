import { NextRequest, NextResponse } from 'next/server'
import { validateWebhookSignature } from '@/lib/mercadopago'
import { getMercadoPagoQrOrder, paymentIdsFromQrOrder } from '@/lib/mercadopago-qr'
import { findLocalPaymentId, settleMercadoPagoPayment } from '@/lib/payments/settle-mp'
import { notifyPaymentReceived, notifyPaymentRejected } from '@/lib/notify-email'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Healthcheck público: no revela secretos ni acepta liquidaciones. */
export async function GET() {
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
  // Solo HMAC (x-signature). No aceptar secretos en query string.
  if (!sigOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    let mpPaymentId: string | null = null
    if (body?.data?.id) mpPaymentId = String(body.data.id)
    else if (body?.id) mpPaymentId = String(body.id)
    if (!mpPaymentId) {
      return NextResponse.json({ ok: true, matched: false, reason: 'sin_id_mp' })
    }

    const topic = String(body?.type ?? body?.topic ?? body?.action ?? '')
    const looksLikeOrder =
      mpPaymentId.startsWith('ORD') ||
      /order/i.test(topic) ||
      String(body?.action ?? '').startsWith('order.')

    const paymentIds: string[] = []
    let orderExternalRef: string | null = body?.data?.external_reference ?? body?.external_reference ?? null
    const orderId: string | null = looksLikeOrder ? mpPaymentId : null

    if (looksLikeOrder) {
      const order = await getMercadoPagoQrOrder(mpPaymentId)
      orderExternalRef =
        (order?.external_reference ? String(order.external_reference) : null) ?? orderExternalRef
      for (const id of paymentIdsFromQrOrder(order)) {
        if (!id.startsWith('ORD')) paymentIds.push(id)
      }
      if (!paymentIds.length) {
        const localPaymentId = await findLocalPaymentId({
          orderId: mpPaymentId,
          externalReference: orderExternalRef,
        })
        return NextResponse.json({
          ok: true,
          matched: Boolean(localPaymentId),
          reason: 'orden_qr_sin_pago_final',
          orderId: mpPaymentId,
        })
      }
    } else {
      paymentIds.push(mpPaymentId)
    }

    const results = []
    for (const id of paymentIds) {
      const meta = (body?.data?.metadata ?? body?.metadata ?? {}) as Record<string, unknown>
      const localPaymentId = await findLocalPaymentId({
        mpPaymentId: id,
        preferenceId: body?.data?.preference_id ?? body?.preference_id ?? null,
        externalReference: orderExternalRef,
        metadataPaymentId: meta.local_payment_id ? String(meta.local_payment_id) : null,
        orderId,
      })
      const result = await settleMercadoPagoPayment({
        mpPaymentId: id,
        localPaymentId,
        webhookBody: body,
      })
      results.push({ mpPaymentId: id, ...result })

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
    }

    const credited = results.reduce((sum, row) => sum + (row.credited ?? 0), 0)
    return NextResponse.json({ ok: true, results, credited })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error'
    console.error('[mp-webhook] Error fatal:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
