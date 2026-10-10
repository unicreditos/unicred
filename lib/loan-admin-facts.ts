import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { disbursement, installment, kycVerification, loanContract, profile } from '@/lib/db/schema'
import { diditApprovedForUser } from '@/lib/didit'
import { isKycFresh } from '@/lib/kyc-validity'
import type { KycFacts, ReopenFacts } from '@/lib/loan-admin-rules'

/** Hechos de identidad de un cliente (Didit, BCRA, ARCA, documentos). Solo lectura. */
export async function loadKycFacts(userId: string): Promise<KycFacts & { reviewedAt: Date | null; expiresAt: Date | null; docs: Record<'dni_front' | 'dni_back' | 'selfie' | 'video', boolean>; arcaName: string | null }> {
  const [k] = await db
    .select({
      status: kycVerification.status,
      provider: kycVerification.provider,
      reviewedAt: kycVerification.reviewedAt,
      expiresAt: kycVerification.expiresAt,
      updatedAt: kycVerification.updatedAt,
      ocr: kycVerification.ocrData,
      front: sql<boolean>`coalesce(length(${kycVerification.dniFrontImageUrl}), 0) > 0`,
      back: sql<boolean>`coalesce(length(${kycVerification.dniBackImageUrl}), 0) > 0`,
      selfie: sql<boolean>`coalesce(length(${kycVerification.selfieImageUrl}), 0) > 0`,
      video: sql<boolean>`coalesce(length(${kycVerification.videoUrl}), 0) > 0`,
    })
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  const [p] = await db.select({ kyc: profile.kycStatus, consent: profile.bcraConsentAt }).from(profile).where(eq(profile.userId, userId)).limit(1)
  const ocr = (k?.ocr as Record<string, unknown> | null) ?? {}
  const arca = ocr.arcaPadron as { nombre?: string; name?: string } | undefined
  return {
    diditApproved: await diditApprovedForUser(userId),
    profileKycStatus: p?.kyc ?? null,
    kycRecordStatus: k?.status ?? null,
    provider: k?.provider ?? null,
    fresh: k ? isKycFresh({ expiresAt: k.expiresAt, reviewedAt: k.reviewedAt, updatedAt: k.updatedAt }) : false,
    bcraConsent: Boolean(p?.consent),
    arcaManualReview: Boolean(ocr.manualReview),
    arcaChecked: Boolean(arca),
    reviewedAt: k?.reviewedAt ?? null,
    expiresAt: k?.expiresAt ?? null,
    docs: { dni_front: !!k?.front, dni_back: !!k?.back, selfie: !!k?.selfie, video: !!k?.video },
    arcaName: arca?.nombre ?? arca?.name ?? null,
  }
}

/** Hechos del crédito que impiden reabrirlo (operaciones ya ejecutadas). */
export async function loadReopenFacts(loanId: string, status: string): Promise<ReopenFacts> {
  const [d] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(disbursement)
    .where(and(eq(disbursement.loanId, loanId), sql`${disbursement.status} in ('credited','completed')`))
  const [i] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(installment)
    .where(and(eq(installment.loanId, loanId), eq(installment.status, 'paid')))
  const [c] = await db.select({ acceptedAt: loanContract.acceptedAt }).from(loanContract).where(eq(loanContract.loanId, loanId)).limit(1)
  return { status, disbursementsCredited: d?.n ?? 0, paidInstallments: i?.n ?? 0, contractAccepted: Boolean(c?.acceptedAt) }
}
