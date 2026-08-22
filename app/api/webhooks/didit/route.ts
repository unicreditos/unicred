import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { identityVerification, profile, webhookEvent } from '@/lib/db/schema'

function shortenFloats(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shortenFloats)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, shortenFloats(item)]))
  if (typeof value === 'number' && !Number.isInteger(value) && value % 1 === 0) return Math.trunc(value)
  return value
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.keys(value as object).sort().reduce<Record<string, unknown>>((out, key) => { out[key] = sortKeys((value as Record<string, unknown>)[key]); return out }, {})
  return value
}

export async function POST(request: Request) {
  const raw = await request.text()
  const signature = request.headers.get('x-signature-v2') ?? ''
  const timestamp = Number(request.headers.get('x-timestamp'))
  if (!process.env.DIDIT_WEBHOOK_SECRET || !timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return new NextResponse('stale', { status: 401 })
  let payload: Record<string, any>
  try { payload = JSON.parse(raw) } catch { return new NextResponse('invalid', { status: 400 }) }
  const expected = crypto.createHmac('sha256', process.env.DIDIT_WEBHOOK_SECRET).update(JSON.stringify(sortKeys(shortenFloats(payload))), 'utf8').digest('hex')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return new NextResponse('bad signature', { status: 401 })
  const eventId = String(payload.event_id ?? payload.session_id ?? '')
  if (!eventId) return new NextResponse('missing event', { status: 400 })
  const existing = await db.select({ id: webhookEvent.id }).from(webhookEvent).where(and(eq(webhookEvent.provider, 'didit'), eq(webhookEvent.eventId, eventId))).limit(1)
  if (existing.length) return new NextResponse('ok')
  const webhookId = crypto.randomUUID()
  await db.insert(webhookEvent).values({ id: webhookId, provider: 'didit', eventId, signature, payload })
  const userId = String(payload.vendor_data ?? '')
  const status = String(payload.status ?? 'Not Started').toLowerCase().replaceAll(' ', '_')
  if (userId) {
    await db.insert(identityVerification).values({ id: crypto.randomUUID(), userId, provider: 'didit', providerSessionId: payload.session_id ?? null, status, decision: payload.decision ?? payload }).onConflictDoUpdate({ target: identityVerification.providerSessionId, set: { status, decision: payload.decision ?? payload, updatedAt: new Date() } })
    if (payload.status === 'Approved') await db.update(profile).set({ kycStatus: 'approved', updatedAt: new Date() }).where(eq(profile.userId, userId))
    if (payload.status === 'Declined') await db.update(profile).set({ kycStatus: 'rejected', updatedAt: new Date() }).where(eq(profile.userId, userId))
  }
  await db.update(webhookEvent).set({ processedAt: new Date() }).where(eq(webhookEvent.id, webhookId))
  return new NextResponse('ok')
}
