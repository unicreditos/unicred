'use server'

import { db } from '@/lib/db'
import {
  merchant,
  merchantDocument,
  profile,
} from '@/lib/db/schema'
import { getSession, syncUserRole } from '@/lib/session'
import { requirePermission } from '@/lib/rbac'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit, diffFields } from '@/lib/audit'
import { ensureOriginacionSchema } from '@/lib/db/ensure-originacion'
import { diditApprovedForUser } from '@/lib/didit'
import { arcaConfigured, lookupPersonaByCuit } from '@/lib/arca/padron'
import {
  evaluateMerchantKyb,
  type MerchantDocType,
  type RepresentativeRole,
} from '@/lib/merchant-kyb'

export async function requireAdmin() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  await ensureOriginacionSchema()
  const [p] = await db
    .select({ role: profile.role })
    .from(profile)
    .where(eq(profile.userId, session.user.id))
    .limit(1)
  if (!p || p.role !== 'admin') throw new Error('Forbidden')
  return session.user.id
}

export async function setMerchantStatus(id: string, status: 'active' | 'rejected') {
  const adminUserId = await requirePermission('merchants.write')
  const [existing] = await db.select().from(merchant).where(eq(merchant.id, id)).limit(1)
  if (!existing) throw new Error('Comercio no encontrado')
  if (status === 'active') {
    if (!(await diditApprovedForUser(existing.userId))) {
      throw new Error('El titular no tiene Didit aprobado. No se puede habilitar el comercio.')
    }
    const [prof] = await db
      .select({ cuil: profile.cuil, dni: profile.dni })
      .from(profile)
      .where(eq(profile.userId, existing.userId))
      .limit(1)
    const docs = await db
      .select({ type: merchantDocument.type })
      .from(merchantDocument)
      .where(eq(merchantDocument.merchantId, existing.id))
    const configured = arcaConfigured()
    const padron = configured ? await lookupPersonaByCuit(existing.cuit) : null
    const evaluation = evaluateMerchantKyb({
      declaredCuit: existing.cuit,
      padron,
      padronConfigured: configured,
      titular: {
        diditApproved: true,
        dni: prof?.dni ?? null,
        cuil: prof?.cuil ?? null,
      },
      representativeRole: (existing.representativeRole as RepresentativeRole) || 'titular',
      uploadedDocTypes: docs.map((d) => d.type as MerchantDocType),
    })
    if (!evaluation.canActivate) {
      throw new Error(evaluation.blockers[0] || 'El comercio no supera el control ARCA / expediente.')
    }
    await db
      .update(merchant)
      .set({
        status: 'active',
        kybStatus: 'approved',
        kybBlockers: [],
        taxCondition: evaluation.taxCondition,
        taxStatus: evaluation.taxStatus,
        personType: evaluation.personType,
        legalName: evaluation.legalName || existing.legalName,
        titularMatch: evaluation.titularMatch,
        updatedAt: new Date(),
      })
      .where(eq(merchant.id, id))
  } else {
    await db
      .update(merchant)
      .set({ status: 'rejected', kybStatus: 'rejected', updatedAt: new Date() })
      .where(eq(merchant.id, id))
  }

  await syncUserRole(existing.userId, status === 'active' ? 'merchant' : 'customer')

  await recordAudit({
    actorUserId: adminUserId,
    action: status === 'active' ? 'MERCHANT_APPROVED' : 'MERCHANT_REJECTED',
    entityType: 'merchant',
    entityId: id,
    targetUserId: existing.userId,
    severity: status === 'active' ? 'info' : 'warning',
    summary: `Comercio ${existing.businessName} ${status === 'active' ? 'habilitado' : 'rechazado'}`,
    changes: diffFields(existing as any, { status }),
  })

  revalidatePath('/admin')
  return { ok: true, updatedBy: adminUserId }
}

