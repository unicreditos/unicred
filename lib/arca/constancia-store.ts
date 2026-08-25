import { lookupPersonaByCuit } from '@/lib/arca/padron'
import {
  parseConstanciaSnapshot,
  snapshotFromPersona,
  type ArcaConstanciaSnapshot,
} from '@/lib/arca/constancia-snapshot'
import { db } from '@/lib/db'
import { kycVerification, merchant, profile } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function persistArcaSnapshotForUser(
  userId: string,
  snapshot: ArcaConstanciaSnapshot,
  opts?: { merchant?: boolean },
) {
  const now = new Date()
  const [kyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const prev = (kyc?.ocrData as Record<string, unknown> | null) ?? {}
  if (kyc) {
    await db
      .update(kycVerification)
      .set({
        ocrData: { ...prev, arcaPadron: snapshot, arcaLookedUpAt: snapshot.consultedAt },
        updatedAt: now,
      })
      .where(eq(kycVerification.id, kyc.id))
  }
  if (opts?.merchant) {
    await db
      .update(merchant)
      .set({
        afipSnapshot: snapshot,
        afipLookedUpAt: now,
        updatedAt: now,
      })
      .where(eq(merchant.userId, userId))
  }
}

export async function loadConstanciaForUser(userId: string): Promise<ArcaConstanciaSnapshot | null> {
  const [[shop], [kyc], [prof]] = await Promise.all([
    db.select().from(merchant).where(eq(merchant.userId, userId)).limit(1),
    db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1),
    db.select({ cuil: profile.cuil }).from(profile).where(eq(profile.userId, userId)).limit(1),
  ])
  const fromMerchant = parseConstanciaSnapshot(shop?.afipSnapshot)
  if (fromMerchant?.name || fromMerchant?.address) {
    return fromMerchant
  }
  const fromKyc = parseConstanciaSnapshot((kyc?.ocrData as Record<string, unknown> | null)?.arcaPadron)
  if (fromKyc?.name || fromKyc?.address) {
    return fromKyc
  }
  const cuit = shop?.cuit || prof?.cuil || ''
  if (!cuit) return null
  const persona = await lookupPersonaByCuit(cuit)
  if (!persona) return null
  const snapshot = snapshotFromPersona(persona)
  await persistArcaSnapshotForUser(userId, snapshot, { merchant: Boolean(shop) })
  return snapshot
}
