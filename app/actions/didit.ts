'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq, desc } from 'drizzle-orm'
import { consumeRateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { diditSession, kycVerification, profile } from '@/lib/db/schema'
import {
  applyDiditDecision,
  attachDiditSessionToUser,
  createDiditSession,
  diditApprovedForUser,
  diditCookieOptions,
  DIDIT_SESSION_COOKIE,
  getDiditDecision,
  isDiditConfigured,
  upsertDiditSessionRow,
} from '@/lib/didit'
import { diditPersonExpectedDetails } from '@/lib/didit-expected'
import { getRoleForUser, getSession, newId, requireUserId } from '@/lib/session'

export async function getDiditPublicConfig() {
  return { configured: isDiditConfigured() }
}

export async function getMyDiditApproved() {
  const session = await getSession()
  if (!session?.user?.id) return false
  return diditApprovedForUser(session.user.id)
}

function signupVendorData() {
  return `signup:${crypto.randomUUID()}`
}

async function expectedFromProfile(userId: string) {
  const [row] = await db
    .select({
      dni: profile.dni,
      birthDate: profile.birthDate,
      phone: profile.phone,
    })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1)

  const [kyc] = await db
    .select({ dniNumber: kycVerification.dniNumber, ocrData: kycVerification.ocrData })
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)

  const ocr = (kyc?.ocrData as { nameConfirmed?: string } | null) ?? null
  return {
    dni: row?.dni ?? kyc?.dniNumber ?? undefined,
    birthDate: row?.birthDate ?? undefined,
    phone: row?.phone ?? undefined,
    fullName: ocr?.nameConfirmed ?? undefined,
  }
}

export async function startDiditVerification(input?: {
  fullName?: string
  dni?: string
  birthDate?: string
  phone?: string
  email?: string
}) {
  if (!isDiditConfigured()) {
    return { ok: false as const, error: 'Didit no está configurado. Falta DIDIT_API_KEY.' }
  }

  const userId = await requireUserId()
  const limit = await consumeRateLimit(`didit:${userId}`, 6, 10 * 60 * 1000)
  if (!limit.ok) {
    return { ok: false as const, error: 'Demasiados intentos de verificación. Esperá unos minutos.' }
  }

  const fromProfile = await expectedFromProfile(userId)
  const fullName = input?.fullName?.trim() || fromProfile.fullName || ''
  const session = await getSession()
  let created
  try {
    created = await createDiditSession({
    vendorData: userId,
    expectedDetails: diditPersonExpectedDetails({
      fullName,
      dni: input?.dni || fromProfile.dni,
      birthDate: input?.birthDate || fromProfile.birthDate,
    }),
    contactDetails: {
      email: input?.email || session?.user?.email || undefined,
      phone: input?.phone || fromProfile.phone || undefined,
    },
    metadata: { source: 'dashboard' },
    })
  } catch (err) {
    return { ok: false as const, error: (err as Error).message || 'No se pudo abrir la verificación Didit.' }
  }

  await upsertDiditSessionRow({
    sessionId: created.sessionId,
    vendorData: userId,
    userId,
    workflowId: created.workflowId,
    status: 'Not Started',
    verificationUrl: created.url,
  })

  const now = new Date()
  const [existing] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const reviewing = {
    provider: 'didit',
    providerReferenceId: created.sessionId,
    status: 'reviewing' as const,
    verificationLevel: existing?.verificationLevel === 'enhanced' ? 'enhanced' : 'biometric',
    updatedAt: now,
  }
  if (existing) {
    await db.update(kycVerification).set(reviewing).where(eq(kycVerification.id, existing.id))
  } else {
    await db.insert(kycVerification).values({
      id: newId('kyc'),
      userId,
      createdAt: now,
      ...reviewing,
    })
  }
  await db.update(profile).set({ kycStatus: 'reviewing', updatedAt: now }).where(eq(profile.userId, userId))

  const jar = await cookies()
  jar.set(diditCookieOptions(created.sessionId))

  revalidatePath('/dashboard')
  revalidatePath('/merchant')
  return { ok: true as const, url: created.url, sessionId: created.sessionId }
}

export async function startDiditSignupVerification(input: {
  fullName?: string
  dni?: string
  birthDate?: string
  phone?: string
  email?: string
}) {
  if (!isDiditConfigured()) {
    return { ok: false as const, error: 'Didit no está configurado. Falta DIDIT_API_KEY.' }
  }

  const limit = await consumeRateLimit(`didit-signup:${input.dni || input.phone || 'anon'}`, 6, 10 * 60 * 1000)
  if (!limit.ok) {
    return { ok: false as const, error: 'Demasiados intentos de verificación. Esperá unos minutos.' }
  }

  const vendorData = signupVendorData()
  let created
  try {
    created = await createDiditSession({
    vendorData,
    expectedDetails: diditPersonExpectedDetails({
      fullName: input.fullName,
      dni: input.dni,
      birthDate: input.birthDate,
    }),
    contactDetails: {
      email: input.email || undefined,
      phone: input.phone || undefined,
    },
    metadata: { source: 'signup' },
    })
  } catch (err) {
    return { ok: false as const, error: (err as Error).message || 'No se pudo abrir la verificación Didit.' }
  }

  await upsertDiditSessionRow({
    sessionId: created.sessionId,
    vendorData,
    workflowId: created.workflowId,
    status: 'Not Started',
    verificationUrl: created.url,
  })

  const jar = await cookies()
  jar.set(diditCookieOptions(created.sessionId))
  return { ok: true as const, url: created.url, sessionId: created.sessionId }
}

export async function syncDiditSession(sessionId?: string) {
  if (!isDiditConfigured()) {
    return { ok: false as const, error: 'Didit no está configurado.' }
  }

  const jar = await cookies()
  const id = sessionId?.trim() || jar.get(DIDIT_SESSION_COOKIE)?.value
  if (!id) return { ok: false as const, error: 'No hay una sesión Didit para sincronizar.' }

  const decision = await getDiditDecision(id)
  const status = String(decision.status ?? '')
  if (!status) return { ok: false as const, error: 'Didit todavía no tiene un resultado.' }

  const session = await getSession()
  const result = await applyDiditDecision({
    sessionId: id,
    vendorData: typeof decision.vendor_data === 'string' ? decision.vendor_data : session?.user?.id,
    status,
    decision,
    userId: session?.user?.id ?? null,
  })

  if (session?.user?.id) {
    revalidatePath('/dashboard')
    revalidatePath('/merchant')
    revalidatePath('/admin')
  }

  return { ...result, status }
}

export async function getMyDiditSession() {
  const session = await getSession()
  const jar = await cookies()
  const cookieId = jar.get(DIDIT_SESSION_COOKIE)?.value ?? null
  const userId = session?.user?.id

  if (userId) {
    const [row] = await db
      .select()
      .from(diditSession)
      .where(eq(diditSession.userId, userId))
      .orderBy(desc(diditSession.updatedAt))
      .limit(1)
    if (row) {
      return {
        configured: isDiditConfigured(),
        sessionId: row.sessionId,
        status: row.status,
        url: row.verificationUrl,
      }
    }
  }

  if (cookieId) {
    const [row] = await db.select().from(diditSession).where(eq(diditSession.sessionId, cookieId)).limit(1)
    return {
      configured: isDiditConfigured(),
      sessionId: cookieId,
      status: row?.status ?? 'Not Started',
      url: row?.verificationUrl ?? null,
    }
  }

  return { configured: isDiditConfigured(), sessionId: null, status: null, url: null }
}

export async function linkDiditCookieToUser() {
  const userId = await requireUserId()
  const jar = await cookies()
  const sessionId = jar.get(DIDIT_SESSION_COOKIE)?.value
  if (!sessionId) return { ok: true as const, linked: false as const }
  const linked = await attachDiditSessionToUser(sessionId, userId)
  if (!linked.ok) return { ok: false as const, error: linked.error }
  revalidatePath('/dashboard')
  revalidatePath('/merchant')
  return { ok: true as const, linked: true as const, status: linked.status, url: linked.url }
}

export async function getDiditReturnPath() {
  const session = await getSession()
  if (!session?.user?.id) return '/sign-up'
  const role = await getRoleForUser(session.user.id)
  return role === 'merchant' ? '/merchant' : '/dashboard?tab=kyc_biometrico'
}
