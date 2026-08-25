import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { diditSession, diditWebhookLog, kycVerification, merchant, profile } from '@/lib/db/schema'
import { newId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { notifyKycDecision } from '@/lib/notify-email'

const DIDIT_API = 'https://verification.didit.me'
const WEBHOOK_MAX_SKEW_SECONDS = 300
const COOKIE_NAME = 'unicred_didit_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export const DIDIT_SESSION_COOKIE = COOKIE_NAME

export type DiditStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Approved'
  | 'Declined'
  | 'In Review'
  | 'Abandoned'
  | 'Resubmitted'
  | 'Kyc Expired'
  | string

export type DiditKycStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export type DiditExpectedDetails = {
  first_name?: string
  last_name?: string
  date_of_birth?: string
  nationality?: string
  identification_number?: string
  gender?: string
  id_country?: string
}

export type DiditContactDetails = {
  email?: string
  phone?: string
}

export type DiditSessionResult = {
  sessionId: string
  url: string
  vendorData: string
  workflowId: string
}

type DiditWorkflow = {
  uuid?: string
  workflow_id?: string
  workflow_label?: string
  is_default?: boolean
  is_archived?: boolean
  status?: string
}

type CreateSessionResponse = {
  session_id?: string
  url?: string
  verification_url?: string
  session_token?: string
  detail?: string
}

export function isDiditConfigured() {
  return Boolean(process.env.DIDIT_API_KEY?.trim())
}

function humanizeDiditApiError(status: number, detail: string) {
  if (/enough credits|top up/i.test(detail)) {
    return 'Didit no tiene créditos disponibles. Recargá en business.didit.me; la verificación se abre dentro de UNICRÉDITOS.'
  }
  return `Didit ${status}: ${detail}`
}

export function diditSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

export function diditCallbackUrl() {
  return `${diditSiteUrl()}/verification/didit`
}

export function diditWebhookUrl() {
  return `${diditSiteUrl()}/api/webhooks/didit`
}

export function diditCookieOptions(sessionId: string) {
  return {
    name: COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  }
}

function apiKey() {
  const key = process.env.DIDIT_API_KEY?.trim()
  if (!key) throw new Error('Falta DIDIT_API_KEY. Cargala en .env.local y en el host.')
  return key
}

async function diditFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DIDIT_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey(),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { detail: text }
  }
  if (!res.ok) {
    const detail =
      json && typeof json === 'object' && 'detail' in json
        ? String((json as { detail: unknown }).detail)
        : text.slice(0, 240)
    throw new Error(humanizeDiditApiError(res.status, detail || 'error de API'))
  }
  return json as T
}

let cachedWorkflowId: string | null = null

export async function resolveDiditWorkflowId() {
  const fromEnv = process.env.DIDIT_WORKFLOW_ID?.trim()
  if (fromEnv) return fromEnv
  if (cachedWorkflowId) return cachedWorkflowId

  const page = await diditFetch<{ results?: DiditWorkflow[] }>('/v3/workflows/?limit=50')
  const published = (page.results ?? []).filter((w) => !w.is_archived && w.status === 'published')
  const chosen = published.find((w) => w.is_default) ?? published[0] ?? page.results?.[0]
  const id = chosen?.workflow_id || chosen?.uuid
  if (!id) throw new Error('No hay un workflow publicado en Didit. Crealo en la consola y cargá DIDIT_WORKFLOW_ID.')
  cachedWorkflowId = id
  return id
}

export function splitPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] }
  return {
    last_name: parts[0],
    first_name: parts.slice(1).join(' '),
  }
}

export async function createDiditSession(input: {
  vendorData: string
  callback?: string
  language?: string
  expectedDetails?: DiditExpectedDetails
  contactDetails?: DiditContactDetails
  metadata?: Record<string, unknown>
}) {
  const workflowId = await resolveDiditWorkflowId()
  const body: Record<string, unknown> = {
    workflow_id: workflowId,
    callback: input.callback ?? diditCallbackUrl(),
    vendor_data: input.vendorData,
    language: input.language ?? 'es',
  }
  if (input.expectedDetails && Object.values(input.expectedDetails).some(Boolean)) {
    body.expected_details = input.expectedDetails
  }
  if (input.contactDetails && Object.values(input.contactDetails).some(Boolean)) {
    body.contact_details = input.contactDetails
  }
  if (input.metadata) body.metadata = input.metadata

  const session = await diditFetch<CreateSessionResponse>('/v3/session/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const sessionId = session.session_id
  const url = session.url || session.verification_url
  if (!sessionId || !url) {
    throw new Error('Didit no devolvió session_id o url de verificación.')
  }
  return { sessionId, url, workflowId } satisfies Omit<DiditSessionResult, 'vendorData'>
}

export async function getDiditDecision(sessionId: string) {
  return diditFetch<Record<string, unknown>>(`/v3/session/${encodeURIComponent(sessionId)}/decision/`)
}

export const DIDIT_WEBHOOK_EVENTS = [
  'status.updated',
  'data.updated',
  'user.status.updated',
  'user.data.updated',
  'business.status.updated',
  'business.data.updated',
  'activity.created',
  'transaction.created',
  'transaction.status.updated',
] as const

export type DiditWebhookType = (typeof DIDIT_WEBHOOK_EVENTS)[number]

export function mapDiditToKyc(status: string): DiditKycStatus | null {
  switch (status) {
    case 'Approved':
      return 'approved'
    case 'Declined':
      return 'rejected'
    case 'In Review':
    case 'Resubmitted':
    case 'In Progress':
    case 'Awaiting User':
      return 'reviewing'
    case 'Abandoned':
    case 'Not Started':
      return 'pending'
    case 'Expired':
    case 'KYC Expired':
    case 'Kyc Expired':
      return 'pending'
    default:
      return null
  }
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
}

function pickScore(decision: Record<string, unknown> | null | undefined) {
  const matches = asArray(decision?.face_matches)
  const scores = matches
    .map((item) => Number(item.score))
    .filter((n) => Number.isFinite(n))
  if (!scores.length) return null
  return String(Math.max(...scores).toFixed(2))
}

function pickDni(decision: Record<string, unknown> | null | undefined) {
  const ids = asArray(decision?.id_verifications)
  for (const item of ids) {
    const raw =
      item.identification_number ??
      item.document_number ??
      item.id_number ??
      (item.document && typeof item.document === 'object'
        ? (item.document as { number?: unknown }).number
        : null)
    const digits = String(raw ?? '').replace(/\D/g, '')
    if (/^\d{7,8}$/.test(digits)) return digits
  }
  return null
}

const DECISION_FEATURE_KEYS = [
  'id_verifications',
  'nfc_verifications',
  'liveness_checks',
  'face_matches',
  'aml_screenings',
  'poa_verifications',
  'phone_verifications',
  'email_verifications',
  'ip_analyses',
  'database_validations',
  'reviews',
] as const

function collectWarnings(decision: Record<string, unknown> | null | undefined) {
  if (!decision) return []
  return DECISION_FEATURE_KEYS.flatMap((key) =>
    asArray(decision[key]).flatMap((item) => {
      const list = item.warnings
      if (!Array.isArray(list)) return []
      return list.map((w) => (typeof w === 'string' ? w : JSON.stringify(w)))
    }),
  )
}

function featureApproved(decision: Record<string, unknown> | null | undefined, key: string) {
  return asArray(decision?.[key]).some((item) => String(item.status) === 'Approved')
}

function pickRejection(status: string, decision: Record<string, unknown> | null | undefined) {
  if (status !== 'Declined') return null
  const warnings = collectWarnings(decision)
  if (warnings.length) return warnings.slice(0, 6).join(' · ')
  return 'Didit rechazó la verificación de identidad.'
}

export function parseVendorUserId(vendorData: string | null | undefined) {
  const value = String(vendorData ?? '').trim()
  if (!value) return null
  if (value.startsWith('signup:')) return null
  return value
}

export async function upsertDiditSessionRow(input: {
  sessionId: string
  vendorData: string
  userId?: string | null
  workflowId?: string | null
  status?: string
  verificationUrl?: string | null
  decision?: unknown
  webhookEventId?: string | null
}) {
  const now = new Date()
  const [existing] = await db
    .select()
    .from(diditSession)
    .where(eq(diditSession.sessionId, input.sessionId))
    .limit(1)

  if (existing) {
    await db
      .update(diditSession)
      .set({
        vendorData: input.vendorData || existing.vendorData,
        userId: input.userId ?? existing.userId,
        workflowId: input.workflowId ?? existing.workflowId,
        status: input.status ?? existing.status,
        verificationUrl: input.verificationUrl ?? existing.verificationUrl,
        decision: input.decision === undefined ? existing.decision : input.decision,
        webhookEventId: input.webhookEventId ?? existing.webhookEventId,
        updatedAt: now,
      })
      .where(eq(diditSession.id, existing.id))
    return existing.id
  }

  const id = newId('didit')
  await db.insert(diditSession).values({
    id,
    sessionId: input.sessionId,
    vendorData: input.vendorData,
    userId: input.userId ?? null,
    workflowId: input.workflowId ?? null,
    status: input.status ?? 'Not Started',
    verificationUrl: input.verificationUrl ?? null,
    decision: input.decision ?? null,
    webhookEventId: input.webhookEventId ?? null,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function applyDiditDecision(input: {
  sessionId: string
  vendorData?: string | null
  status: string
  decision?: Record<string, unknown> | null
  webhookEventId?: string | null
  userId?: string | null
  resubmitInfo?: unknown
  webhookType?: string | null
}) {
  const [row] = await db
    .select()
    .from(diditSession)
    .where(eq(diditSession.sessionId, input.sessionId))
    .limit(1)

  if (input.webhookEventId && row?.webhookEventId === input.webhookEventId) {
    return { ok: true as const, duplicate: true as const, userId: row.userId }
  }

  const userId = input.userId ?? row?.userId ?? parseVendorUserId(input.vendorData ?? row?.vendorData)
  await upsertDiditSessionRow({
    sessionId: input.sessionId,
    vendorData: input.vendorData ?? row?.vendorData ?? input.sessionId,
    userId,
    status: input.status,
    decision: input.decision ?? row?.decision,
    webhookEventId: input.webhookEventId,
  })

  if (!userId) {
    return { ok: true as const, pendingSignup: true as const, userId: null }
  }

  const kycStatus = mapDiditToKyc(input.status)
  if (!kycStatus) {
    return { ok: true as const, ignored: true as const, userId }
  }

  const [existing] = await db
    .select()
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  const previousKyc = existing?.status

  if (existing?.status === 'approved' && kycStatus === 'pending') {
    return { ok: true as const, keptApproved: true as const, userId }
  }

  const now = new Date()
  const decision = input.decision ?? null
  const expired = input.status === 'Expired' || input.status === 'KYC Expired' || input.status === 'Kyc Expired'
  const previousOcr = ((existing?.ocrData as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
  const previousDidit = (previousOcr.didit as Record<string, unknown> | undefined) ?? {}
  const values = {
    provider: 'didit',
    providerReferenceId: input.sessionId,
    status: kycStatus,
    verificationLevel: kycStatus === 'approved' ? 'biometric' : existing?.verificationLevel || 'biometric',
    faceMatchScore: pickScore(decision) ?? existing?.faceMatchScore ?? null,
    dniNumber: pickDni(decision) ?? existing?.dniNumber ?? null,
    cuilVerified: kycStatus === 'approved' ? true : existing?.cuilVerified ?? false,
    phoneVerified: featureApproved(decision, 'phone_verifications') || existing?.phoneVerified || false,
    emailVerified: featureApproved(decision, 'email_verifications') || existing?.emailVerified || false,
    rejectionReason: pickRejection(input.status, decision),
    reviewedBy: 'didit',
    reviewedAt: kycStatus === 'approved' || kycStatus === 'rejected' ? now : existing?.reviewedAt ?? null,
    expiresAt: expired ? now : existing?.expiresAt ?? null,
    ocrData: {
      ...previousOcr,
      didit: {
        ...previousDidit,
        sessionId: input.sessionId,
        status: input.status,
        eventId: input.webhookEventId ?? null,
        webhookType: input.webhookType ?? previousDidit.webhookType ?? null,
        decision,
        resubmitInfo: input.resubmitInfo ?? previousDidit.resubmitInfo ?? null,
        reminderNeeded: input.status === 'Abandoned',
        warnings: collectWarnings(decision),
        updatedAt: now.toISOString(),
      },
    },
    updatedAt: now,
  }

  if (existing) {
    await db.update(kycVerification).set(values).where(eq(kycVerification.id, existing.id))
  } else {
    await db.insert(kycVerification).values({
      id: newId('kyc'),
      userId,
      createdAt: now,
      ...values,
    })
  }

  await db
    .update(profile)
    .set({ kycStatus, updatedAt: now })
    .where(eq(profile.userId, userId))

  if ((kycStatus === 'approved' || kycStatus === 'rejected') && previousKyc !== kycStatus) {
    await notifyKycDecision({ userId, status: kycStatus })
  }

  return { ok: true as const, userId, kycStatus }
}

export async function attachDiditSessionToUser(sessionId: string, userId: string) {
  const [row] = await db
    .select()
    .from(diditSession)
    .where(eq(diditSession.sessionId, sessionId))
    .limit(1)
  if (!row) return { ok: false as const, error: 'Sesión Didit no encontrada.' }

  await db
    .update(diditSession)
    .set({ userId, vendorData: userId, updatedAt: new Date() })
    .where(eq(diditSession.id, row.id))

  if (row.status && row.status !== 'Not Started') {
    await applyDiditDecision({
      sessionId,
      vendorData: userId,
      status: row.status,
      decision: (row.decision as Record<string, unknown> | null) ?? null,
      userId,
    })
  }

  return { ok: true as const, status: row.status, url: row.verificationUrl }
}

function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats)
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, shortenFloats(value)]))
  }
  if (typeof data === 'number' && Number.isFinite(data) && data % 1 === 0) return Math.trunc(data)
  return data
}

function sortKeys(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(sortKeys)
  if (data !== null && typeof data === 'object') {
    return Object.keys(data as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((data as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return data
}

function safeEqualHex(expected: string, provided: string) {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function timestampFresh(timestamp: string) {
  const ts = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(ts)) return false
  return Math.abs(Math.floor(Date.now() / 1000) - ts) <= WEBHOOK_MAX_SKEW_SECONDS
}

export function verifyDiditWebhook(input: {
  rawBody: string
  signatureV2?: string | null
  signature?: string | null
  signatureSimple?: string | null
  timestamp?: string | null
}): { ok: true; method: 'v2' | 'raw' | 'simple' } | { ok: false; reason: string } {
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'missing_secret' }
    }
    console.warn('[didit] DIDIT_WEBHOOK_SECRET vacío: se acepta el webhook solo en desarrollo')
    return { ok: true, method: 'simple' }
  }
  if (!input.timestamp) return { ok: false, reason: 'missing_timestamp' }
  if (!timestampFresh(input.timestamp)) return { ok: false, reason: 'stale_timestamp' }

  if (input.signatureV2) {
    try {
      const canonical = JSON.stringify(sortKeys(shortenFloats(JSON.parse(input.rawBody))))
      const expected = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')
      if (safeEqualHex(expected, input.signatureV2)) return { ok: true, method: 'v2' }
    } catch {
      // Se prueba X-Signature sobre los bytes crudos.
    }
  }

  if (input.signature) {
    const expected = createHmac('sha256', secret).update(input.rawBody, 'utf8').digest('hex')
    if (safeEqualHex(expected, input.signature)) return { ok: true, method: 'raw' }
  }

  if (input.signatureSimple) {
    try {
      const body = JSON.parse(input.rawBody) as Record<string, unknown>
      const canonical = [body.timestamp ?? '', body.session_id ?? '', body.status ?? '', body.webhook_type ?? ''].join(
        ':',
      )
      const expected = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex')
      if (safeEqualHex(expected, input.signatureSimple)) return { ok: true, method: 'simple' }
    } catch {
      return { ok: false, reason: 'invalid_simple_payload' }
    }
  }

  return { ok: false, reason: 'invalid_signature' }
}

function webhookDedupeKey(body: Record<string, unknown>) {
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : ''
  if (eventId) return { eventId, dedupeKey: null as string | null }
  const sessionId = String(body.session_id ?? body.business_session_id ?? '').trim()
  const status = String(body.status ?? '')
  const type = String(body.webhook_type ?? '')
  return {
    eventId: `fallback:${sessionId}:${status}:${type}:${body.timestamp ?? ''}`,
    dedupeKey: `${sessionId}:${status}:${type}`,
  }
}

export async function claimDiditWebhookEvent(body: Record<string, unknown>) {
  const { eventId, dedupeKey } = webhookDedupeKey(body)
  const [existing] = await db.select().from(diditWebhookLog).where(eq(diditWebhookLog.eventId, eventId)).limit(1)
  if (existing?.processed) {
    return { eventId, duplicate: true as const, logId: existing.id }
  }

  if (!existing) {
    try {
      const id = newId('didithook')
      await db.insert(diditWebhookLog).values({
        id,
        eventId,
        dedupeKey,
        webhookType: String(body.webhook_type ?? 'unknown'),
        sessionId: String(body.session_id ?? body.business_session_id ?? '') || null,
        status: typeof body.status === 'string' ? body.status : null,
        environment: typeof body.environment === 'string' ? body.environment : null,
        processed: false,
        payload: body,
        createdAt: new Date(),
      })
      return { eventId, duplicate: false as const, logId: id }
    } catch {
      const [race] = await db.select().from(diditWebhookLog).where(eq(diditWebhookLog.eventId, eventId)).limit(1)
      if (race?.processed) return { eventId, duplicate: true as const, logId: race.id }
      if (dedupeKey) {
        const [same] = await db.select().from(diditWebhookLog).where(eq(diditWebhookLog.dedupeKey, dedupeKey)).limit(1)
        if (same?.processed) return { eventId: same.eventId, duplicate: true as const, logId: same.id }
      }
      return { eventId, duplicate: false as const, logId: race?.id ?? null }
    }
  }

  return { eventId, duplicate: false as const, logId: existing.id }
}

export async function markDiditWebhookProcessed(eventId: string) {
  await db
    .update(diditWebhookLog)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(diditWebhookLog.eventId, eventId))
}

async function applyEntityEvent(body: Record<string, unknown>) {
  const vendorData = typeof body.vendor_data === 'string' ? body.vendor_data : null
  const userId = parseVendorUserId(vendorData)
  const entityStatus = String(body.status ?? '')
  const now = new Date()

  if (userId && (entityStatus === 'FLAGGED' || entityStatus === 'BLOCKED')) {
    const [existing] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
    const previous = ((existing?.ocrData as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
    const values = {
      status: entityStatus === 'BLOCKED' ? ('rejected' as const) : ('reviewing' as const),
      rejectionReason:
        entityStatus === 'BLOCKED'
          ? 'Didit bloqueó la entidad de identidad.'
          : 'Didit marcó la entidad para revisión.',
      ocrData: {
        ...previous,
        diditEntity: {
          status: entityStatus,
          previousStatus: body.previous_status ?? null,
          eventId: body.event_id ?? null,
          updatedAt: now.toISOString(),
        },
      },
      updatedAt: now,
    }
    if (existing) {
      await db.update(kycVerification).set(values).where(eq(kycVerification.id, existing.id))
    }
    await db
      .update(profile)
      .set({ kycStatus: values.status, updatedAt: now })
      .where(eq(profile.userId, userId))
  }

  const vendorBusinessId = typeof body.vendor_business_id === 'string' ? body.vendor_business_id : null
  if (vendorBusinessId) {
    const [row] = await db.select({ id: merchant.id }).from(merchant).where(eq(merchant.id, vendorBusinessId)).limit(1)
    if (row && (entityStatus === 'FLAGGED' || entityStatus === 'BLOCKED')) {
      await db
        .update(merchant)
        .set({
          status: entityStatus === 'BLOCKED' ? 'rejected' : 'pending',
          updatedAt: now,
        })
        .where(eq(merchant.id, row.id))
    }
  }
}

export async function processDiditWebhook(body: Record<string, unknown>) {
  const webhookType = String(body.webhook_type ?? '')
  const sessionId = String(body.session_id ?? body.business_session_id ?? '').trim()
  const status = String(body.status ?? (body.decision && typeof body.decision === 'object'
    ? (body.decision as { status?: unknown }).status
    : '') ?? '')

  switch (webhookType) {
    case 'status.updated':
    case 'data.updated': {
      if (!sessionId) return { ok: true as const, ignored: 'sin_sesion' }
      if (!status) return { ok: true as const, ignored: 'sin_estado' }
      const decision =
        body.decision && typeof body.decision === 'object' ? (body.decision as Record<string, unknown>) : null
      return applyDiditDecision({
        sessionId,
        vendorData: typeof body.vendor_data === 'string' ? body.vendor_data : null,
        status,
        decision,
        webhookEventId: typeof body.event_id === 'string' ? body.event_id : null,
        resubmitInfo: body.resubmit_info ?? null,
        webhookType,
      })
    }
    case 'user.status.updated':
    case 'user.data.updated':
    case 'business.status.updated':
    case 'business.data.updated':
      await applyEntityEvent(body)
      return { ok: true as const, entity: webhookType, status }
    case 'activity.created':
      return { ok: true as const, activity: true as const }
    case 'transaction.created':
    case 'transaction.status.updated':
      return {
        ok: true as const,
        transaction: true as const,
        transactionId: body.transaction_id ?? body.txn_id ?? null,
        status,
      }
    default:
      return { ok: true as const, ignored: webhookType || 'unknown' }
  }
}

export function listDiditWorkflows() {
  return diditFetch<{ results?: DiditWorkflow[] }>('/v3/workflows/?limit=50')
}

export async function createDiditWebhookDestination(webhookUrl: string) {
  return diditFetch<{
    id?: string
    secret_shared_key?: string
    webhook_url?: string
  }>('/v3/webhook/destinations/', {
    method: 'POST',
    body: JSON.stringify({
      webhook_url: webhookUrl,
      webhook_version: 'v3',
      subscribed_events: [...DIDIT_WEBHOOK_EVENTS],
    }),
  })
}
