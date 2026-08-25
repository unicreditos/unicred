'use server'

import { db } from '@/lib/db'
import { kycVerification, profile, user } from '@/lib/db/schema'
import { assertRole, requireAdmin } from '@/lib/session'
import { recordAudit, diffFields } from '@/lib/audit'
import { eq, desc } from 'drizzle-orm'
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
        ? 'basic'
        : (acc.verificationLevel as KYCLevel)
  }

  await db
    .update(kycVerification)
    .set({
      status,
      rejectionReason,
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
    action: status === 'approved' ? 'KYC_APPROVED' : 'KYC_REVIEWED',
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

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/perfil')
  return { ok: true }
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

export async function getAllKYCReviews(limit = 100) {
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
      createdAt: kycVerification.createdAt,
      updatedAt: kycVerification.updatedAt,
      _u_name: user.name,
      _u_email: user.email,
      _p_cuil: profile.cuil,
      _p_phone: profile.phone,
    })
    .from(kycVerification)
    .leftJoin(user, eq(kycVerification.userId, user.id))
    .leftJoin(profile, eq(kycVerification.userId, profile.userId))
    .orderBy(desc(kycVerification.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    dniFrontImageUrl: r.dniFrontImageUrl,
    dniBackImageUrl: r.dniBackImageUrl,
    selfieImageUrl: r.selfieImageUrl,
    dniNumber: r.dniNumber,
    verificationLevel: r.verificationLevel,
    status: r.status,
    faceMatchScore: r.faceMatchScore,
    provider: r.provider,
    providerReferenceId: r.providerReferenceId,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    user: {
      fullName: r._u_name ?? null,
      cuil: r._p_cuil ?? null,
      email: r._u_email ?? null,
      phone: r._p_phone ?? null,
    },
  }))
}