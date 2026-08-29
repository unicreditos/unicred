import { and, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { diditSession, kycVerification } from '@/lib/db/schema'
import {
  applyDiditDecision,
  claimDiditWebhookEvent,
  getDiditDecision,
  isDiditConfigured,
  markDiditWebhookProcessed,
} from '@/lib/didit'

export type ReconcileKycResult = {
  sessionId: string
  status: string | null
  applied: boolean
  error?: string
}

/**
 * Reconsulta decisiones Didit para sesiones / KYC abiertos.
 * Cubre el hueco cuando el webhook no llega o falla (p.ej. URL vieja).
 */
export async function reconcileOpenDiditSessions(limit = 40): Promise<ReconcileKycResult[]> {
  if (!isDiditConfigured()) return []

  const openKyc = await db
    .select({
      sessionId: kycVerification.providerReferenceId,
      userId: kycVerification.userId,
    })
    .from(kycVerification)
    .where(
      and(
        eq(kycVerification.provider, 'didit'),
        inArray(kycVerification.status, ['pending', 'reviewing']),
        isNotNull(kycVerification.providerReferenceId),
      ),
    )
    .limit(limit)

  const openSessions = await db
    .select({
      sessionId: diditSession.sessionId,
      userId: diditSession.userId,
      status: diditSession.status,
    })
    .from(diditSession)
    .where(
      or(
        eq(diditSession.status, 'Not Started'),
        eq(diditSession.status, 'In Progress'),
        eq(diditSession.status, 'In Review'),
        eq(diditSession.status, 'Awaiting User'),
        eq(diditSession.status, 'Resubmitted'),
      ),
    )
    .limit(limit)

  const byId = new Map<string, { sessionId: string; userId: string | null }>()
  for (const row of openKyc) {
    const sessionId = String(row.sessionId ?? '').trim()
    if (sessionId) byId.set(sessionId, { sessionId, userId: row.userId })
  }
  for (const row of openSessions) {
    const sessionId = String(row.sessionId ?? '').trim()
    if (!sessionId || byId.has(sessionId)) continue
    if (['Approved', 'Declined', 'Abandoned', 'Expired', 'KYC Expired', 'Kyc Expired'].includes(row.status)) {
      continue
    }
    byId.set(sessionId, { sessionId, userId: row.userId })
  }

  const results: ReconcileKycResult[] = []

  for (const item of [...byId.values()].slice(0, limit)) {
    try {
      const decision = await getDiditDecision(item.sessionId)
      const status = String(decision.status ?? '')
      if (!status) {
        results.push({ sessionId: item.sessionId, status: null, applied: false, error: 'empty_status' })
        continue
      }

      const synthetic = {
        event_id: `reconcile:${item.sessionId}:${status}:${new Date().toISOString().slice(0, 13)}`,
        session_id: item.sessionId,
        status,
        webhook_type: 'status.updated',
        environment: 'reconcile',
        vendor_data: item.userId ? `user:${item.userId}` : undefined,
      } as Record<string, unknown>

      const claim = await claimDiditWebhookEvent(synthetic)
      if (!claim.duplicate) {
        await applyDiditDecision({
          sessionId: item.sessionId,
          vendorData: typeof synthetic.vendor_data === 'string' ? synthetic.vendor_data : null,
          status,
          decision,
          webhookEventId: String(synthetic.event_id),
          userId: item.userId,
          webhookType: 'status.updated',
        })
        await markDiditWebhookProcessed(claim.eventId)
      }

      results.push({ sessionId: item.sessionId, status, applied: !claim.duplicate })
    } catch (err) {
      results.push({
        sessionId: item.sessionId,
        status: null,
        applied: false,
        error: err instanceof Error ? err.message : 'reconcile_error',
      })
    }
  }

  return results
}
