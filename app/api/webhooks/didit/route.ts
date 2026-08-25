import { after, NextRequest, NextResponse } from 'next/server'
import {
  applyDiditDecision,
  claimDiditWebhookEvent,
  getDiditDecision,
  isDiditConfigured,
  markDiditWebhookProcessed,
  processDiditWebhook,
  verifyDiditWebhook,
} from '@/lib/didit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function logSignatureFailure(reason: string, rawBody: string, req: NextRequest) {
  // Sin preview del body: puede contener PII/KYC.
  console.warn('[didit-webhook] firma rechazada', {
    reason,
    timestamp: req.headers.get('x-timestamp'),
    hasV2: Boolean(req.headers.get('x-signature-v2')),
    hasRaw: Boolean(req.headers.get('x-signature')),
    hasSimple: Boolean(req.headers.get('x-signature-simple')),
    bytes: rawBody.length,
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhook: 'didit',
    configured: isDiditConfigured(),
    time: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const verified = verifyDiditWebhook({
    rawBody,
    signatureV2: req.headers.get('x-signature-v2'),
    signature: req.headers.get('x-signature'),
    signatureSimple: req.headers.get('x-signature-simple'),
    timestamp: req.headers.get('x-timestamp'),
  })

  if (!verified.ok) {
    logSignatureFailure(verified.reason, rawBody, req)
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  try {
    const claim = await claimDiditWebhookEvent(body)
    if (claim.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, eventId: claim.eventId })
    }

    const result = await processDiditWebhook(body)
    await markDiditWebhookProcessed(claim.eventId)

    const sessionId = String(body.session_id ?? body.business_session_id ?? '')
    const webhookType = String(body.webhook_type ?? '')
    if (
      isDiditConfigured() &&
      sessionId &&
      (webhookType === 'status.updated' || webhookType === 'data.updated') &&
      verified.method === 'simple'
    ) {
      after(async () => {
        try {
          const decision = await getDiditDecision(sessionId)
          const status = String(decision.status ?? body.status ?? '')
          if (!status) return
          await applyDiditDecision({
            sessionId,
            vendorData: typeof body.vendor_data === 'string' ? body.vendor_data : null,
            status,
            decision,
            webhookEventId: typeof body.event_id === 'string' ? `${body.event_id}:decision` : null,
            webhookType,
          })
        } catch (err) {
          console.warn('[didit-webhook] recálculo de decisión omitido:', (err as Error).message)
        }
      })
    }

    return NextResponse.json({ ...result, eventId: claim.eventId, method: verified.method })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error'
    console.error('[didit-webhook] error al procesar:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
