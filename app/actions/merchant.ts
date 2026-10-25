'use server'

import { snapshotFromPersona } from '@/lib/arca/constancia-snapshot'
import { arcaConfigured, lookupPersonaByCuit } from '@/lib/arca/padron'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { kycVerification, merchant, merchantDocument, profile } from '@/lib/db/schema'


import { diditApprovedForUser } from '@/lib/didit'
import {
  evaluateMerchantKyb,
  type MerchantDocType,
  type RepresentativeRole,
} from '@/lib/merchant-kyb'
import { consumeRateLimit } from '@/lib/rate-limit'
import { assertRole, getOrCreateProfile, getRoleForUser, newId } from '@/lib/session'
import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

async function clientKey() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

async function titularForUser(userId: string) {
  const [[prof], [kyc]] = await Promise.all([
    db.select({ cuil: profile.cuil, dni: profile.dni }).from(profile).where(eq(profile.userId, userId)).limit(1),
    db
      .select({ dniNumber: kycVerification.dniNumber })
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .limit(1),
  ])
  return {
    diditApproved: await diditApprovedForUser(userId),
    dni: kyc?.dniNumber || prof?.dni || null,
    cuil: prof?.cuil || null,
  }
}

function kybFields(evaluation: ReturnType<typeof evaluateMerchantKyb>, padron: Awaited<ReturnType<typeof lookupPersonaByCuit>>) {
  return {
    personType: evaluation.personType,
    taxCondition: evaluation.taxCondition,
    taxStatus: evaluation.taxStatus,
    legalName: evaluation.legalName || null,
    monotributoCategory: evaluation.monotributoCategory || null,
    titularMatch: evaluation.titularMatch,
    kybStatus: evaluation.kybStatus,
    kybBlockers: evaluation.blockers,
    afipSnapshot: padron ? snapshotFromPersona(padron) : null,
    afipLookedUpAt: new Date(),
  }
}

export async function getMyMerchant() {
  const userId = await assertRole('customer', 'merchant')
  const rows = await db.select().from(merchant).where(eq(merchant.userId, userId)).limit(1)
  return rows[0] ?? null
}

export async function getMyMerchantDocuments() {
  await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) return []
  return db
    .select({
      id: merchantDocument.id,
      type: merchantDocument.type,
      fileName: merchantDocument.fileName,
      mime: merchantDocument.mime,
      size: merchantDocument.size,
      status: merchantDocument.status,
      createdAt: merchantDocument.createdAt,
    })
    .from(merchantDocument)
    .where(eq(merchantDocument.merchantId, m.id))
    .orderBy(desc(merchantDocument.createdAt))
}

export async function lookupMerchantAfip(rawCuit: string) {
  const userId = await assertRole('customer', 'merchant')
  const limit = await consumeRateLimit(`merch-afip:${await clientKey()}`, 10, 10 * 60 * 1000)
  if (!limit.ok) {
    return { ok: false as const, error: 'Demasiadas consultas al padrón. Esperá unos minutos.' }
  }
  const cuit = normalizeCuit(rawCuit)
  if (!isValidCuit(cuit)) {
    return { ok: false as const, error: 'Ese CUIT no supera el dígito verificador de AFIP.' }
  }
  const configured = arcaConfigured()
  const padron = configured ? await lookupPersonaByCuit(cuit) : null
  const existing = await getMyMerchant()
  const docs = existing
    ? await db
        .select({ type: merchantDocument.type })
        .from(merchantDocument)
        .where(eq(merchantDocument.merchantId, existing.id))
    : []
  const evaluation = evaluateMerchantKyb({
    declaredCuit: cuit,
    padron,
    padronConfigured: configured,
    titular: await titularForUser(userId),
    representativeRole: (existing?.representativeRole as RepresentativeRole) || 'titular',
    uploadedDocTypes: docs.map((d) => d.type as MerchantDocType),
  })
  return {
    ok: true as const,
    configured,
    padron: padron
      ? {
          cuil: padron.cuil,
          name: padron.name,
          personType: padron.personType,
          taxStatus: padron.taxStatus,
          taxCondition: padron.taxCondition,
          monotributoCategory: padron.monotributoCategory,
          taxes: padron.taxes,
          activities: padron.activities,
          address: padron.address,
          city: padron.city,
          province: padron.province,
          postalCode: padron.postalCode,
        }
      : null,
    evaluation,
  }
}

export async function registerMerchant(input: {
  businessName: string
  cuit: string
  category: string
  province: string
  city: string
  address: string
  phone: string
  representativeRole?: RepresentativeRole
}) {
  const userId = await assertRole('customer', 'merchant')
  const role = await getRoleForUser(userId)
  if (role === 'admin') {
    throw new Error('Las cuentas de administración no pueden operar como comercio.')
  }
  await getOrCreateProfile()
  if (!(await diditApprovedForUser(userId))) {
    throw new Error('Verificá la identidad del titular con Didit antes de registrar o actualizar el comercio.')
  }

  const cuit = normalizeCuit(input.cuit)
  if (!isValidCuit(cuit)) {
    throw new Error('El CUIT del comercio no es válido.')
  }

  const configured = arcaConfigured()
  if (!configured) {
    throw new Error('El padrón ARCA no está disponible. No se registra un comercio sin constancia oficial.')
  }
  const padron = await lookupPersonaByCuit(cuit)
  const existing = await getMyMerchant()
  const docs = existing
    ? await db
        .select({ type: merchantDocument.type })
        .from(merchantDocument)
        .where(eq(merchantDocument.merchantId, existing.id))
    : []
  const representativeRole = input.representativeRole || (existing?.representativeRole as RepresentativeRole) || 'titular'
  const evaluation = evaluateMerchantKyb({
    declaredCuit: cuit,
    padron,
    padronConfigured: configured,
    titular: await titularForUser(userId),
    representativeRole,
    uploadedDocTypes: docs.map((d) => d.type as MerchantDocType),
  })
  if (!evaluation.canPersist) {
    throw new Error(evaluation.blockers[0] || 'El alta del comercio no supera el control ARCA / Didit.')
  }

  const [taken] = await db.select({ id: merchant.id, userId: merchant.userId }).from(merchant).where(eq(merchant.cuit, cuit)).limit(1)
  if (taken && taken.userId !== userId) {
    throw new Error('Ese CUIT ya está adherido a otro comercio UNICRÉDITOS.')
  }

  const now = new Date()
  const legalName = evaluation.legalName || input.businessName.trim()
  const values = {
    businessName: legalName,
    cuit,
    category: input.category,
    province: evaluation.province || input.province,
    city: evaluation.city || input.city,
    address: evaluation.address || input.address,
    phone: input.phone,
    representativeRole,
    ...kybFields(evaluation, padron),
    updatedAt: now,
  }

  if (existing) {
    if (existing.status === 'rejected') {
      await db
        .update(merchant)
        .set({ ...values, status: 'pending' })
        .where(eq(merchant.id, existing.id))
    } else {
      await db.update(merchant).set(values).where(eq(merchant.id, existing.id))
    }
  } else {
    await db.insert(merchant).values({
      id: newId('merch'),
      userId,
      status: 'pending',
      commissionRate: '8.00',
      createdAt: now,
      ...values,
    })
  }

  revalidatePath('/merchant')
  revalidatePath('/admin')
  return { ok: true as const, evaluation }
}
