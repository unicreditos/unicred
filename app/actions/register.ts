'use server'

import { persistBcraReportForUser } from '@/app/actions/documents'
import { persistBcraConsultation } from '@/lib/bcra-persist'
import { arcaConfigured, lookupPersonaByCuit } from '@/lib/arca/padron'
import { snapshotFromPersona } from '@/lib/arca/constancia-snapshot'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { kycVerification, merchant, profile, user } from '@/lib/db/schema'
import { listDepartments, listLocalities, listProvinces } from '@/lib/geo-ar'
import { lookupIdentity, type AccountKind, type IdentityMatch } from '@/lib/identity'
import {
  applyDiditDecision,
  attachDiditSessionToUser,
  DIDIT_SESSION_COOKIE,
  getDiditDecision,
  isDiditConfigured,
} from '@/lib/didit'
import { evaluateMerchantKyb, type RepresentativeRole } from '@/lib/merchant-kyb'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getOrCreateProfile, getSession, newId } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'

async function clientKey() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

function isAdult(birthDate: string) {
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return false
  const limit = new Date()
  limit.setFullYear(limit.getFullYear() - 18)
  return d <= limit
}

async function isIdentifierTaken(cuil: string) {
  const [byProfile] = await db.select({ id: profile.id }).from(profile).where(eq(profile.cuil, cuil)).limit(1)
  if (byProfile) return true
  const [byMerchant] = await db.select({ id: merchant.id }).from(merchant).where(eq(merchant.cuit, cuil)).limit(1)
  return Boolean(byMerchant)
}

export async function lookupRegistrationIdentity(input: { identifier: string; accountType: AccountKind }) {
  const limit = consumeRateLimit(`id:${await clientKey()}`, 8, 10 * 60 * 1000)
  if (!limit.ok) {
    return { ok: false as const, error: 'Demasiadas consultas. Esperá unos minutos e intentá de nuevo.' }
  }

  const accountType = input.accountType === 'comercio' ? 'comercio' : 'persona'
  const result = await lookupIdentity(input.identifier, accountType)
  if (!result.ok) return result

  const taken = await isIdentifierTaken(result.match.cuil)
  return { ...result, alreadyRegistered: taken }
}

export async function getGeoProvinces() {
  try {
    return { ok: true as const, items: await listProvinces() }
  } catch {
    return { ok: false as const, error: 'No se pudieron cargar las provincias.', items: [] as { id: string; name: string }[] }
  }
}

export async function getGeoDepartments(provinceName: string) {
  if (!provinceName.trim()) return { ok: true as const, items: [] }
  try {
    return { ok: true as const, items: await listDepartments(provinceName) }
  } catch {
    return { ok: false as const, error: 'No se pudieron cargar los departamentos.', items: [] }
  }
}

export async function getGeoLocalities(provinceName: string, departmentName: string) {
  if (!provinceName.trim() || !departmentName.trim()) return { ok: true as const, items: [] }
  try {
    return { ok: true as const, items: await listLocalities(provinceName, departmentName) }
  } catch {
    return { ok: false as const, error: 'No se pudieron cargar las localidades.', items: [] }
  }
}

export type CompleteRegistrationInput = {
  accountType: AccountKind
  name: string
  cuil: string
  dni: string
  phone: string
  birthDate: string
  province: string
  department: string
  city: string
  postalCode: string
  address: string
  monthlyIncome: number
  employmentStatus: string
  businessName?: string
  category?: string
  merchantCuit?: string
  representativeRole?: RepresentativeRole
  confirmedIdentity: boolean
  acceptedTerms: boolean
  identity?: IdentityMatch | null
}

export async function completeRegistration(input: CompleteRegistrationInput) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: false as const, error: 'Creá la cuenta e ingresá antes de guardar el perfil.' }
  }

  if (!input.confirmedIdentity) {
    return { ok: false as const, error: 'Tenés que confirmar que los datos consultados son tuyos.' }
  }
  if (!input.acceptedTerms) {
    return { ok: false as const, error: 'Tenés que aceptar que la cuenta no garantiza un crédito.' }
  }

  const cuil = normalizeCuit(input.cuil)
  if (!isValidCuit(cuil)) {
    return { ok: false as const, error: 'CUIT/CUIL inválido.' }
  }
  const dni = String(input.dni ?? '').replace(/\D/g, '')
  if (!/^\d{7,8}$/.test(dni)) {
    return { ok: false as const, error: 'El DNI del titular debe tener 7 u 8 dígitos.' }
  }
  if (!isAdult(input.birthDate)) {
    return { ok: false as const, error: 'Tenés que ser mayor de 18 años.' }
  }
  if (!input.name.trim() || !input.phone.trim() || !input.province.trim() || !input.city.trim() || !input.address.trim()) {
    return { ok: false as const, error: 'Completá nombre, teléfono y domicilio.' }
  }
  if (input.accountType === 'comercio' && !String(input.businessName ?? '').trim()) {
    return { ok: false as const, error: 'Indicá la razón social del comercio.' }
  }

  const merchantCuit = normalizeCuit(input.merchantCuit || (input.accountType === 'comercio' ? cuil : ''))
  if (input.accountType === 'comercio') {
    if (!isValidCuit(merchantCuit)) {
      return { ok: false as const, error: 'CUIT del comercio inválido.' }
    }
    if (!arcaConfigured()) {
      return { ok: false as const, error: 'El padrón ARCA no está disponible. No se da de alta un comercio sin constancia oficial.' }
    }
  }

  const taken = await isIdentifierTaken(cuil)
  if (taken) {
    const [own] = await db.select({ userId: profile.userId }).from(profile).where(eq(profile.cuil, cuil)).limit(1)
    if (own && own.userId !== session.user.id) {
      return { ok: false as const, error: 'Ese CUIT/CUIL ya tiene una cuenta UNICRÉDITOS. Ingresá con tu email.' }
    }
  }

  if (!isDiditConfigured()) {
    return {
      ok: false as const,
      error: 'La verificación de identidad con Didit no está disponible. Intentá de nuevo en unos minutos.',
    }
  }
  const jar = await cookies()
  const diditSessionId = jar.get(DIDIT_SESSION_COOKIE)?.value
  if (!diditSessionId) {
    return {
      ok: false as const,
      error: 'Tenés que verificar tu identidad con Didit antes de crear la cuenta. No se aceptan documentos cargados a mano.',
    }
  }

  const userId = session.user.id
  await getOrCreateProfile()
  const now = new Date()
  const income = Number(input.monthlyIncome) || 0
  const accountRole = input.accountType === 'comercio' ? 'merchant' : 'customer'

  await db
    .update(profile)
    .set({
      role: accountRole,
      cuil,
      dni,
      phone: input.phone.trim(),
      birthDate: input.birthDate,
      province: input.province.trim(),
      department: input.department.trim() || null,
      city: input.city.trim(),
      postalCode: input.postalCode.trim() || null,
      address: input.address.trim(),
      monthlyIncome: String(income),
      employmentStatus: input.employmentStatus.trim() || (input.accountType === 'comercio' ? 'Comercio' : ''),
      kycStatus: 'pending',
      updatedAt: now,
    })
    .where(eq(profile.userId, userId))

  await db.update(user).set({ role: accountRole, updatedAt: now }).where(eq(user.id, userId))

  const [existingKyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const personPadron = arcaConfigured() ? await lookupPersonaByCuit(cuil) : null
  const personSnapshot = personPadron ? snapshotFromPersona(personPadron) : null
  const prevOcr = (existingKyc?.ocrData as Record<string, unknown> | null) ?? {}
  const kycValues = {
    dniNumber: dni,
    cuilVerified: true,
    status: 'pending' as const,
    verificationLevel: 'biometric' as const,
    provider: 'didit',
    providerReferenceId: diditSessionId,
    ocrData: {
      ...prevOcr,
      accountType: input.accountType,
      sources: input.identity?.sources ?? [],
      nameConfirmed: input.name.trim(),
      ...(personSnapshot ? { arcaPadron: personSnapshot, arcaLookedUpAt: personSnapshot.consultedAt } : {}),
    },
    updatedAt: now,
  }
  if (existingKyc) {
    await db.update(kycVerification).set(kycValues).where(eq(kycVerification.id, existingKyc.id))
  } else {
    await db.insert(kycVerification).values({
      id: newId('kyc'),
      userId,
      createdAt: now,
      ...kycValues,
    })
  }

  if (input.accountType === 'comercio') {
    const padron = await lookupPersonaByCuit(merchantCuit)
    const evaluation = evaluateMerchantKyb({
      declaredCuit: merchantCuit,
      padron,
      padronConfigured: arcaConfigured(),
      titular: {
        diditApproved: true,
        dni,
        cuil,
      },
      representativeRole: input.representativeRole || 'titular',
      uploadedDocTypes: [],
    })
    if (!evaluation.canPersist) {
      return { ok: false as const, error: evaluation.blockers[0] || 'El CUIT del comercio no supera el control ARCA.' }
    }

    const [existingMerchant] = await db.select().from(merchant).where(eq(merchant.userId, userId)).limit(1)
    const [taken] = await db.select({ id: merchant.id, userId: merchant.userId }).from(merchant).where(eq(merchant.cuit, merchantCuit)).limit(1)
    if (taken && taken.userId !== userId) {
      return { ok: false as const, error: 'Ese CUIT ya está adherido a otro comercio UNICRÉDITOS.' }
    }

    const legalName = evaluation.legalName || String(input.businessName).trim()
    const merchantValues = {
      businessName: legalName,
      cuit: merchantCuit,
      category: String(input.category ?? '').trim() || 'general',
      province: evaluation.province || input.province.trim(),
      city: evaluation.city || input.city.trim(),
      address: evaluation.address || input.address.trim(),
      phone: input.phone.trim(),
      representativeRole: input.representativeRole || 'titular',
      personType: evaluation.personType,
      taxCondition: evaluation.taxCondition,
      taxStatus: evaluation.taxStatus,
      legalName: evaluation.legalName || null,
      monotributoCategory: evaluation.monotributoCategory || null,
      titularMatch: evaluation.titularMatch,
      kybStatus: evaluation.kybStatus,
      kybBlockers: evaluation.blockers,
      afipSnapshot: padron ? snapshotFromPersona(padron) : null,
      afipLookedUpAt: now,
      updatedAt: now,
    }
    if (existingMerchant) {
      await db.update(merchant).set(merchantValues).where(eq(merchant.id, existingMerchant.id))
    } else {
      await db.insert(merchant).values({
        id: newId('merch'),
        userId,
        status: 'pending',
        commissionRate: '8.00',
        createdAt: now,
        ...merchantValues,
      })
    }
  }

  await attachDiditSessionToUser(diditSessionId, userId)
  try {
    const decision = await getDiditDecision(diditSessionId)
    const status = String(decision.status ?? '')
    if (status) {
      await applyDiditDecision({
        sessionId: diditSessionId,
        vendorData: typeof decision.vendor_data === 'string' ? decision.vendor_data : userId,
        status,
        decision,
        userId,
      })
    }
  } catch (err) {
    console.warn('[register] no se pudo sincronizar Didit:', (err as Error).message)
  }

  const bcra = await persistBcraConsultation({ userId, cuil, monthlyIncome: income })
  const merchantBcra =
    input.accountType === 'comercio' && merchantCuit && merchantCuit !== cuil
      ? await persistBcraConsultation({ userId, cuil: merchantCuit, monthlyIncome: income })
      : null
  if (!bcra.ok && !(merchantBcra && merchantBcra.ok)) {
    return {
      ok: true as const,
      score: null,
      reportId: null,
      dashboardUrl: input.accountType === 'comercio' ? '/merchant' : '/dashboard?tab=scoring',
      warning: bcra.ok ? null : bcra.error,
      diditConfigured: true,
    }
  }

  let reportId: string | null = null
  try {
    if (bcra.ok) {
      const report = await persistBcraReportForUser(userId, bcra.checkId)
      reportId = report.reportId
    }
    if (merchantBcra && merchantBcra.ok) {
      const companyReport = await persistBcraReportForUser(userId, merchantBcra.checkId)
      reportId = reportId || companyReport.reportId
    }
  } catch {
    /* se conserva el informe que sí se haya podido guardar */
  }

  return {
    ok: true as const,
    score: bcra.ok ? bcra.score : merchantBcra && merchantBcra.ok ? merchantBcra.score : null,
    reportId,
    dashboardUrl: input.accountType === 'comercio' ? '/merchant' : '/dashboard?tab=scoring',
    warning: bcra.ok ? null : bcra.error,
    diditConfigured: true,
  }
}
