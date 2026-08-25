import { createHash } from 'node:crypto'
import { arcaConfigured, lookupPersonaByCuit } from '@/lib/arca/padron'
import { diditApprovedForUser } from '@/lib/didit'
import { db } from '@/lib/db'
import { kycVerification, merchant, merchantDocument, profile } from '@/lib/db/schema'
import {
  evaluateMerchantKyb,
  validateMerchantUpload,
  type MerchantDocType,
  type RepresentativeRole,
} from '@/lib/merchant-kyb'
import { newId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

const ALLOWED_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function safeFileName(name: string, mime: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'documento'
  const ext = ALLOWED_EXT[mime] || 'bin'
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`
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

async function refreshMerchantKyb(merchantId: string, userId: string) {
  const [row] = await db.select().from(merchant).where(eq(merchant.id, merchantId)).limit(1)
  if (!row) return
  const docs = await db
    .select({ type: merchantDocument.type })
    .from(merchantDocument)
    .where(eq(merchantDocument.merchantId, merchantId))
  const configured = arcaConfigured()
  const padron = configured ? await lookupPersonaByCuit(row.cuit) : null
  const evaluation = evaluateMerchantKyb({
    declaredCuit: row.cuit,
    padron,
    padronConfigured: configured,
    titular: await titularForUser(userId),
    representativeRole: (row.representativeRole as RepresentativeRole) || 'titular',
    uploadedDocTypes: docs.map((d) => d.type as MerchantDocType),
  })
  await db
    .update(merchant)
    .set({
      kybStatus: row.status === 'active' && evaluation.canSubmit ? 'approved' : evaluation.kybStatus,
      kybBlockers: evaluation.blockers,
      titularMatch: evaluation.titularMatch,
      updatedAt: new Date(),
    })
    .where(eq(merchant.id, merchantId))
}

export async function saveMerchantDocumentFile(input: {
  userId: string
  type: string
  fileName: string
  mime: string
  bytes: Buffer
}) {
  const check = validateMerchantUpload({ mime: input.mime, size: input.bytes.length, type: input.type })
  if (!check.ok) return check

  const [row] = await db.select().from(merchant).where(eq(merchant.userId, input.userId)).limit(1)
  if (!row) {
    return { ok: false as const, error: 'Consultá el CUIT en ARCA y registrá el comercio antes de adjuntar el expediente.' }
  }
  if (row.personType !== 'JURIDICA') {
    return {
      ok: false as const,
      error: 'La constancia de un monotributista o RI persona física sale del padrón ARCA. No hace falta subir estatuto.',
    }
  }

  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  const now = new Date()
  await db
    .delete(merchantDocument)
    .where(and(eq(merchantDocument.merchantId, row.id), eq(merchantDocument.type, check.type)))

  await db.insert(merchantDocument).values({
    id: newId('mdoc'),
    merchantId: row.id,
    userId: input.userId,
    type: check.type,
    fileName: safeFileName(input.fileName, input.mime),
    mime: input.mime,
    size: input.bytes.length,
    sha256,
    content: input.bytes.toString('base64'),
    status: 'uploaded',
    createdAt: now,
    updatedAt: now,
  })

  await refreshMerchantKyb(row.id, input.userId)
  return { ok: true as const, sha256 }
}

export async function deleteMerchantDocumentFile(userId: string, documentId: string) {
  const [doc] = await db.select().from(merchantDocument).where(eq(merchantDocument.id, documentId)).limit(1)
  if (!doc || doc.userId !== userId) {
    return { ok: false as const, error: 'Documento no encontrado.' }
  }
  await db.delete(merchantDocument).where(eq(merchantDocument.id, documentId))
  await refreshMerchantKyb(doc.merchantId, userId)
  return { ok: true as const }
}
