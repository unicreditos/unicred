'use server'

import { db } from '@/lib/db'
import { diditSession, kycVerification, profile, user } from '@/lib/db/schema'
import { assertRole, requireAdmin } from '@/lib/session'
import { recordAudit, diffFields } from '@/lib/audit'
import { applyDiditDecision, getDiditDecision, isDiditConfigured } from '@/lib/didit'
import { kycMediaBundle, parseDiditCapture } from '@/lib/didit-capture'
import { notifyKycDecision } from '@/lib/notify-email'
import { desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type KYCLevel = 'none' | 'basic' | 'biometric' | 'enhanced'
type KYCStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export async function getMyKYC() {
  const userId = await assertRole('customer')
  const rows = await db
    .select()
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

export async function submitBasicKYC(_input?: unknown) {
  throw new Error(
    'La identidad se valida únicamente con Didit. No se aceptan documentos cargados a mano.',
  )
}

export async function submitBiometricKYC(_input?: unknown) {
  throw new Error(
    'La identidad se valida únicamente con Didit. Completá el flujo biométrico oficial.',
  )
}

export async function setKYCStatus(
  id: string,
  status: KYCStatus,
  rejectionReason?: string,
) {
  const adminUserId = await requireAdmin()

  const [acc] = await db
    .select()
    .from(kycVerification)
    .where(eq(kycVerification.id, id))
    .limit(1)
  if (!acc) throw new Error('KYC no encontrado')

  let level: KYCLevel = acc.verificationLevel as KYCLevel
  if (status === 'approved') {
    level =
      !acc.verificationLevel || acc.verificationLevel === 'none'
        ? 'biometric'
        : (acc.verificationLevel as KYCLevel)
  }

  await db
    .update(kycVerification)
    .set({
      status,
      rejectionReason: status === 'rejected' ? rejectionReason?.trim() || 'Rechazado por mesa de identidad' : null,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      verificationLevel: level,
      updatedAt: new Date(),
    })
    .where(eq(kycVerification.id, id))

  await db
    .update(profile)
    .set({ kycStatus: status, updatedAt: new Date() })
    .where(eq(profile.userId, acc.userId))

  await recordAudit({
    actorUserId: adminUserId,
    action: status === 'approved' ? 'KYC_APPROVED' : status === 'rejected' ? 'KYC_REJECTED' : 'KYC_REVIEWED',
    entityType: 'kyc_verification',
    entityId: id,
    targetUserId: acc.userId,
    severity: status === 'rejected' ? 'warning' : 'info',
    summary:
      status === 'rejected'
        ? `KYC rechazado: ${rejectionReason ?? 'sin motivo indicado'}`
        : `KYC actualizado a ${status}`,
    changes: diffFields(acc as any, { status, verificationLevel: level }),
  })

  if (status === 'approved' || status === 'rejected') {
    await notifyKycDecision({ userId: acc.userId, status })
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  return { ok: true }
}

export async function refreshKycDidit(userId: string) {
  await requireAdmin()
  if (!isDiditConfigured()) throw new Error('Didit no está configurado en este entorno.')

  const [session] = await db
    .select()
    .from(diditSession)
    .where(eq(diditSession.userId, userId))
    .orderBy(desc(diditSession.updatedAt))
    .limit(1)
  const [kyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const sessionId = session?.sessionId || kyc?.providerReferenceId
  if (!sessionId) throw new Error('Esta persona no tiene una sesión Didit para refrescar.')

  const decision = await getDiditDecision(sessionId)
  const status = String(decision.status ?? session?.status ?? '')
  if (!status) throw new Error('Didit todavía no devolvió un resultado.')

  await applyDiditDecision({
    sessionId,
    vendorData: typeof decision.vendor_data === 'string' ? decision.vendor_data : session?.vendorData,
    status,
    decision,
    userId,
  })

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { ok: true as const, status }
}

export async function confirmCuil() {
  await assertRole('customer')
  throw new Error(
    'El CUIL se verifica en el proceso de identidad. Completá tus datos y esperá la revisión de UNICRÉDITOS.',
  )
}

export async function confirmPhone() {
  await assertRole('customer')
  throw new Error(
    'El teléfono se verifica en el proceso de identidad. Completá tus datos y esperá la revisión de UNICRÉDITOS.',
  )
}

export async function getPendingKYCReviews(limit = 20) {
  await requireAdmin()
  return db
    .select()
    .from(kycVerification)
    .where(eq(kycVerification.status, 'reviewing'))
    .limit(limit)
}

export async function getAllKYCReviews(limit = 500) {
  await requireAdmin()
  const rows = await db
    .select({
      id: kycVerification.id,
      userId: kycVerification.userId,
      dniFrontImageUrl: kycVerification.dniFrontImageUrl,
      dniBackImageUrl: kycVerification.dniBackImageUrl,
      selfieImageUrl: kycVerification.selfieImageUrl,
      dniNumber: kycVerification.dniNumber,
      verificationLevel: kycVerification.verificationLevel,
      status: kycVerification.status,
      faceMatchScore: kycVerification.faceMatchScore,
      provider: kycVerification.provider,
      providerReferenceId: kycVerification.providerReferenceId,
      rejectionReason: kycVerification.rejectionReason,
      cuilVerified: kycVerification.cuilVerified,
      phoneVerified: kycVerification.phoneVerified,
      emailVerified: kycVerification.emailVerified,
      reviewedBy: kycVerification.reviewedBy,
      reviewedAt: kycVerification.reviewedAt,
      ocrData: kycVerification.ocrData,
      createdAt: kycVerification.createdAt,
      updatedAt: kycVerification.updatedAt,
      _u_name: user.name,
      _u_email: user.email,
      _p_cuil: profile.cuil,
      _p_dni: profile.dni,
      _p_phone: profile.phone,
      _p_address: profile.address,
      _p_city: profile.city,
      _p_province: profile.province,
      _p_birth: profile.birthDate,
      _p_kyc: profile.kycStatus,
    })
    .from(kycVerification)
    .leftJoin(user, eq(kycVerification.userId, user.id))
    .leftJoin(profile, eq(kycVerification.userId, profile.userId))
    .orderBy(desc(kycVerification.updatedAt))
    .limit(limit)

  const userIds = rows.map((r) => r.userId)
  const sessions = userIds.length
    ? await db.select().from(diditSession).where(inArray(diditSession.userId, userIds))
    : []
  const latest = new Map<(typeof sessions)[number]['userId'], (typeof sessions)[number]>()
  for (const row of sessions) {
    if (!row.userId) continue
    const prev = latest.get(row.userId)
    if (!prev || new Date(row.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
      latest.set(row.userId, row)
    }
  }

  return rows.map((r) => {
    const session = latest.get(r.userId)
    const capture = parseDiditCapture(session?.decision ?? r.ocrData, {
      sessionId: session?.sessionId ?? r.providerReferenceId,
      status: session?.status ?? null,
    })
    const media = kycMediaBundle(capture, {
      front: r.dniFrontImageUrl,
      back: r.dniBackImageUrl,
      selfie: r.selfieImageUrl,
    })
    const id = capture.ids[0]
    return {
      id: r.id,
      userId: r.userId,
      dniFrontImageUrl: media.front,
      dniBackImageUrl: media.back,
      selfieImageUrl: media.selfie,
      dniNumber: r.dniNumber || id?.documentNumber || r._p_dni,
      verificationLevel: r.verificationLevel,
      status: r.status,
      faceMatchScore: r.faceMatchScore ?? capture.faces[0]?.score ?? null,
      provider: r.provider,
      providerReferenceId: session?.sessionId ?? r.providerReferenceId,
      rejectionReason: r.rejectionReason,
      cuilVerified: Boolean(r.cuilVerified),
      phoneVerified: Boolean(r.phoneVerified),
      emailVerified: Boolean(r.emailVerified),
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      diditStatus: session?.status ?? capture.status,
      ocr: id
        ? {
            fullName: id.fullName,
            documentType: id.documentType,
            birthDate: id.birthDate,
            nationality: id.nationality,
            address: id.formattedAddress || id.address,
            expirationDate: id.expirationDate,
            status: id.status,
          }
        : null,
      warnings: capture.warnings,
      aml: capture.aml.map((item) => item.status),
      ip: capture.ip[0]
        ? {
            country: capture.ip[0].country,
            isp: capture.ip[0].isp,
            isVpn: capture.ip[0].isVpn,
          }
        : null,
      media: media.all,
      user: {
        fullName: r._u_name ?? id?.fullName ?? null,
        cuil: r._p_cuil ?? id?.taxNumber ?? null,
        dni: r._p_dni ?? id?.documentNumber ?? null,
        email: r._u_email ?? null,
        phone: r._p_phone ?? null,
        address: r._p_address ?? null,
        city: r._p_city ?? null,
        province: r._p_province ?? null,
        birthDate: r._p_birth ?? id?.birthDate ?? null,
        kycStatus: r._p_kyc ?? r.status,
      },
    }
  })
}
