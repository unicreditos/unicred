import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { diditSession, kycVerification, profile } from '@/lib/db/schema'
import { validatePersonalData } from '@/lib/personal-data'

export type KycStatus = 'pending' | 'reviewing' | 'approved' | 'rejected'

export const KYC_LABELS: Record<KycStatus, string> = {
  pending: 'Sin verificar',
  reviewing: 'En revisión',
  approved: 'Verificada',
  rejected: 'Rechazada',
}

export const KYC_BADGE: Record<KycStatus, 'secondary' | 'reviewing' | 'success' | 'destructive'> = {
  pending: 'secondary',
  reviewing: 'reviewing',
  approved: 'success',
  rejected: 'destructive',
}

export function normalizeKycStatus(value: string | null | undefined): KycStatus {
  return value === 'reviewing' || value === 'approved' || value === 'rejected' ? value : 'pending'
}

export const DIDIT_STATUS_LABELS: Record<string, string> = {
  Approved: 'Identidad verificada',
  Declined: 'La verificación fue rechazada',
  'In Review': 'Tu verificación quedó en revisión',
  Resubmitted: 'Hace falta que repitas la verificación',
  'In Progress': 'La verificación todavía no terminó',
  'Not Started': 'La verificación todavía no empezó',
  Abandoned: 'La verificación se abandonó',
  Expired: 'La verificación venció',
  'KYC Expired': 'La verificación venció',
  'Awaiting User': 'Falta que completes un paso',
}

export function diditStatusLabel(status: string | null | undefined) {
  return (status && DIDIT_STATUS_LABELS[status]) || 'Recibimos tu verificación'
}

export type KycOverview = {
  status: KycStatus
  provider: string | null
  rejectionReason: string | null
  reviewedAt: Date | null
  dniNumber: string | null
  faceMatchScore: string | null
  lastSessionStatus: string | null
  lastSessionId: string | null
  personal: {
    cuil: string | null
    dni: string | null
    birthDate: string | null
    phone: string | null
    complete: boolean
    bcraConsentAt: Date | null
    monthlyIncome: string | null
    employmentStatus: string | null
    province: string | null
    city: string | null
    postalCode: string | null
    address: string | null
  }
}

/** Todo lo que el panel necesita saber del estado de un usuario, en una sola pasada. */
export async function getKycOverview(userId: string): Promise<KycOverview> {
  const [[prof], [kyc], [last]] = await Promise.all([
    db.select().from(profile).where(eq(profile.userId, userId)).limit(1),
    db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1),
    db
      .select({ sessionId: diditSession.sessionId, status: diditSession.status })
      .from(diditSession)
      .where(eq(diditSession.userId, userId))
      .orderBy(desc(diditSession.updatedAt))
      .limit(1),
  ])
  const personal = {
    cuil: prof?.cuil ?? null,
    dni: prof?.dni ?? null,
    birthDate: prof?.birthDate ?? null,
    phone: prof?.phone ?? null,
  }
  return {
    // El perfil manda: es lo que usa el resto del ecosistema para habilitar un crédito.
    status: normalizeKycStatus(prof?.kycStatus ?? kyc?.status),
    provider: kyc?.provider ?? null,
    rejectionReason: kyc?.rejectionReason ?? null,
    reviewedAt: kyc?.reviewedAt ?? null,
    dniNumber: kyc?.dniNumber ?? null,
    faceMatchScore: kyc?.faceMatchScore ?? null,
    lastSessionStatus: last?.status ?? null,
    lastSessionId: last?.sessionId ?? null,
    personal: {
      ...personal,
      complete: validatePersonalData(personal).ok,
      bcraConsentAt: prof?.bcraConsentAt ?? null,
      monthlyIncome: prof?.monthlyIncome ?? null,
      employmentStatus: prof?.employmentStatus ?? null,
      province: prof?.province ?? null,
      city: prof?.city ?? null,
      postalCode: prof?.postalCode ?? null,
      address: prof?.address ?? null,
    },
  }
}
