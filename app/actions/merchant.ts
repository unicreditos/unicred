'use server'

import { persistBcraConsultation } from '@/lib/bcra-persist'
import { snapshotFromPersona } from '@/lib/arca/constancia-snapshot'
import { arcaConfigured, lookupPersonaByCuit } from '@/lib/arca/padron'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { installment, kycVerification, loan, loanProduct, merchant, merchantDocument, profile } from '@/lib/db/schema'
import { computeFrenchAmortization } from '@/lib/finance'
import { ensureLoanContract, notifyContractReady } from '@/lib/legal/expediente'
import { catalogByType } from '@/lib/loan-catalog'
import {
  computeCreditOffer,
  decideUnderwriting,
  OPEN_LOAN_STATUSES,
  type AppRepaymentHistory,
} from '@/lib/loan-underwriting'
import { diditApprovedForUser } from '@/lib/didit'
import {
  evaluateMerchantKyb,
  type MerchantDocType,
  type RepresentativeRole,
} from '@/lib/merchant-kyb'
import { consumeRateLimit } from '@/lib/rate-limit'
import { assertRole, getOrCreateProfile, getRoleForUser, newId } from '@/lib/session'
import { and, desc, eq, inArray } from 'drizzle-orm'
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
  const userId = await assertRole('customer', 'merchant')
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
  const limit = consumeRateLimit(`merch-afip:${await clientKey()}`, 10, 10 * 60 * 1000)
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

async function loadAppRepaymentHistory(userId: string): Promise<AppRepaymentHistory> {
  const [paidRows, overdueRows, completedRows] = await Promise.all([
    db
      .select({ id: installment.id })
      .from(installment)
      .where(and(eq(installment.userId, userId), eq(installment.status, 'paid'))),
    db
      .select({ id: installment.id })
      .from(installment)
      .where(and(eq(installment.userId, userId), eq(installment.status, 'overdue'))),
    db
      .select({ id: loan.id })
      .from(loan)
      .where(and(eq(loan.userId, userId), eq(loan.status, 'paid'))),
  ])
  return {
    paidCount: paidRows.length,
    overdueCount: overdueRows.length,
    completedLoans: completedRows.length,
  }
}

/** Origina un crédito de consumo a nombre del cliente (CUIL), no del comercio. */
export async function createMerchantSale(input: {
  amount: number
  term: number
  monthlyRate?: number
  /** Promoción 0% absorbida por el comercio (cuotas sin interés). */
  zeroInterest?: boolean
  customerName: string
  customerCuil: string
}) {
  await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) return { ok: false as const, error: 'Registrá tu comercio primero.' }
  if (m.status !== 'active') {
    return { ok: false as const, error: 'Tu comercio todavía no está aprobado por UNICRÉDITOS.' }
  }
  if (!(await diditApprovedForUser(m.userId))) {
    return { ok: false as const, error: 'El titular del comercio tiene que tener Didit aprobado.' }
  }

  const cuil = normalizeCuit(input.customerCuil)
  if (!isValidCuit(cuil)) {
    return { ok: false as const, error: 'CUIL del cliente inválido.' }
  }

  const catalog = catalogByType('consumo')
  const amount = Math.round(Number(input.amount))
  const term = Math.round(Number(input.term))
  if (!Number.isFinite(amount) || amount < catalog.minAmount || amount > catalog.maxAmount) {
    return {
      ok: false as const,
      error: `Monto fuera de rango: ${catalog.minAmount} a ${catalog.maxAmount}.`,
    }
  }
  if (!Number.isFinite(term) || term < catalog.minTerm || term > catalog.maxTerm) {
    return { ok: false as const, error: `El plazo debe estar entre ${catalog.minTerm} y ${catalog.maxTerm} cuotas.` }
  }

  const [customer] = await db.select().from(profile).where(eq(profile.cuil, cuil)).limit(1)
  if (!customer) {
    return {
      ok: false as const,
      error: 'Ese CUIL no tiene cuenta UNICRÉDITOS. El cliente tiene que registrarse y completar KYC.',
    }
  }
  if (customer.userId === m.userId) {
    return { ok: false as const, error: 'No podés financiarte a vos mismo como cliente del local.' }
  }

  const [kyc] = await db
    .select({ status: kycVerification.status, provider: kycVerification.provider })
    .from(kycVerification)
    .where(eq(kycVerification.userId, customer.userId))
    .limit(1)
  if (kyc?.provider !== 'didit' || kyc.status !== 'approved' || customer.kycStatus !== 'approved') {
    return { ok: false as const, error: 'El cliente no tiene identidad Didit aprobada. Tiene que verificar DNI y prueba de vida antes de financiar.' }
  }
  if (Number(customer.monthlyIncome ?? 0) <= 0) {
    return { ok: false as const, error: 'El cliente tiene que declarar ingresos en su perfil.' }
  }

  const open = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, customer.userId), inArray(loan.status, [...OPEN_LOAN_STATUSES])))
    .limit(1)
  if (open.length) {
    return { ok: false as const, error: 'El cliente ya tiene un crédito abierto.' }
  }

  const [product] = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.id, catalog.id))
    .limit(1)
  if (!product?.active) {
    return { ok: false as const, error: 'El producto de consumo no está activo. Pedile a admin que ejecute el seed.' }
  }

  const monthlyRate = input.zeroInterest ? 0 : Number(product.monthlyRate)
  const monthlyIncome = Number(customer.monthlyIncome ?? 0)
  const consulted = await persistBcraConsultation({
    userId: customer.userId,
    cuil,
    monthlyIncome,
  })
  if (!consulted.ok) return { ok: false as const, error: consulted.error }

  const score = consulted.score
  const deuda = consulted.snapshot.deudas
  const history = await loadAppRepaymentHistory(customer.userId)
  const offer = computeCreditOffer({
    score: score.score,
    monthlyIncome,
    term,
    monthlyRate: monthlyRate || Number(product.monthlyRate),
    productMinAmount: Number(product.minAmount ?? catalog.minAmount),
    productMaxAmount: Number(product.maxAmount ?? catalog.maxAmount),
    history,
  })
  if (!offer.eligible || amount > offer.maxAmount) {
    return {
      ok: false as const,
      error: `Monto no ofrecible. Tope actual del cliente: ${offer.maxAmount.toLocaleString('es-AR')} ARS. ${offer.reason}`,
    }
  }

  const amort = computeFrenchAmortization(amount, term, monthlyRate)
  const decision = decideUnderwriting({
    score,
    installmentAmount: amort.installmentAmount,
    monthlyIncome,
    worstSituation: deuda.worstSituation,
    rejectedChecksCount: Number(consulted.snapshot.chequesRechazados?.count ?? 0),
  })

  let status: 'pending' | 'approved' | 'rejected' = 'pending'
  let rejectionReason: string | null = null
  if (decision.outcome === 'rejected') {
    status = 'rejected'
    rejectionReason = decision.reason
  } else if (decision.outcome === 'pending_review') {
    status = 'pending'
    rejectionReason = decision.reason
  } else {
    status = 'approved'
  }

  const loanId = newId('loan')
  const now = new Date()
  const purpose = input.zeroInterest
    ? `Venta 0% ${m.businessName} — ${input.customerName.trim() || cuil}`
    : `Venta ${m.businessName} — ${input.customerName.trim() || cuil}`
  let contractId: string | null = null

  await db.transaction(async (tx) => {
    await tx.insert(loan).values({
      id: loanId,
      userId: customer.userId,
      productId: product.id,
      merchantId: m.id,
      type: 'consumo',
      principal: String(amount),
      term,
      monthlyRate: String(monthlyRate),
      tna: String(amort.tna),
      installmentAmount: String(amort.installmentAmount),
      totalAmount: String(amort.totalAmount),
      cft: String(amort.cft),
      status,
      purpose,
      scoreAtApproval: score.score,
      rejectionReason,
      disbursedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    if (status === 'approved') {
      // Solo contrato. Cuotas/desembolso tras firma del cliente.
      const contract = await ensureLoanContract(
        tx,
        { id: loanId, userId: customer.userId, type: 'consumo', status: 'approved' },
        { generatedBy: 'merchant_sale', now },
      )
      contractId = contract?.id ?? null
    }
  })

  if (contractId) {
    await notifyContractReady({
      userId: customer.userId,
      contractId,
      principal: amount,
      term,
    })
  }

  revalidatePath('/merchant')
  revalidatePath('/dashboard')
  return {
    ok: true as const,
    loanId,
    installmentAmount: amort.installmentAmount,
    status,
    rejectionReason,
    maxOffered: offer.maxAmount,
    zeroInterest: Boolean(input.zeroInterest),
  }
}

/** Cliente financia una compra en un comercio adherido (online o QR). */
export async function requestConsumoAtMerchant(input: {
  merchantId: string
  amount: number
  term: number
  note?: string
}) {
  const userId = await assertRole('customer')
  const [m] = await db
    .select()
    .from(merchant)
    .where(and(eq(merchant.id, input.merchantId), eq(merchant.status, 'active')))
    .limit(1)
  if (!m) return { ok: false as const, error: 'Comercio no encontrado o inactivo.' }
  if (m.userId === userId) {
    return { ok: false as const, error: 'No podés financiarte en tu propio comercio.' }
  }

  const [customer] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!customer?.cuil) {
    return { ok: false as const, error: 'Completá CUIL en tu perfil antes de financiar.' }
  }
  if (!(await diditApprovedForUser(userId)) || customer.kycStatus !== 'approved') {
    return { ok: false as const, error: 'Verificá tu identidad con Didit antes de comprar en cuotas.' }
  }
  if (Number(customer.monthlyIncome ?? 0) <= 0) {
    return { ok: false as const, error: 'Declará tus ingresos en el perfil.' }
  }

  const catalog = catalogByType('consumo')
  const amount = Math.round(Number(input.amount))
  const term = Math.round(Number(input.term))
  if (!Number.isFinite(amount) || amount < catalog.minAmount || amount > catalog.maxAmount) {
    return {
      ok: false as const,
      error: `Monto fuera de rango: ${catalog.minAmount} a ${catalog.maxAmount}.`,
    }
  }
  if (!Number.isFinite(term) || term < catalog.minTerm || term > catalog.maxTerm) {
    return { ok: false as const, error: `El plazo debe estar entre ${catalog.minTerm} y ${catalog.maxTerm} cuotas.` }
  }

  const open = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, userId), inArray(loan.status, [...OPEN_LOAN_STATUSES])))
    .limit(1)
  if (open.length) {
    return { ok: false as const, error: 'Ya tenés un crédito abierto. Cancelalo o terminá de pagarlo antes.' }
  }

  const [product] = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.id, catalog.id))
    .limit(1)
  if (!product?.active) {
    return { ok: false as const, error: 'El producto de consumo no está activo.' }
  }

  const monthlyRate = Number(product.monthlyRate)
  const monthlyIncome = Number(customer.monthlyIncome ?? 0)
  const consulted = await persistBcraConsultation({
    userId,
    cuil: customer.cuil,
    monthlyIncome,
  })
  if (!consulted.ok) return { ok: false as const, error: consulted.error }

  const score = consulted.score
  const deuda = consulted.snapshot.deudas
  const history = await loadAppRepaymentHistory(userId)
  const offer = computeCreditOffer({
    score: score.score,
    monthlyIncome,
    term,
    monthlyRate,
    productMinAmount: Number(product.minAmount ?? catalog.minAmount),
    productMaxAmount: Number(product.maxAmount ?? catalog.maxAmount),
    history,
  })
  if (!offer.eligible || amount > offer.maxAmount) {
    return {
      ok: false as const,
      error: `Monto no ofrecible. Tu tope actual: ${offer.maxAmount.toLocaleString('es-AR')} ARS. ${offer.reason}`,
    }
  }

  const amort = computeFrenchAmortization(amount, term, monthlyRate)
  const decision = decideUnderwriting({
    score,
    installmentAmount: amort.installmentAmount,
    monthlyIncome,
    worstSituation: deuda.worstSituation,
    rejectedChecksCount: Number(consulted.snapshot.chequesRechazados?.count ?? 0),
  })

  let status: 'pending' | 'approved' | 'rejected' = 'pending'
  let rejectionReason: string | null = null
  if (decision.outcome === 'rejected') {
    status = 'rejected'
    rejectionReason = decision.reason
  } else if (decision.outcome === 'pending_review') {
    status = 'pending'
    rejectionReason = decision.reason
  } else {
    status = 'approved'
  }

  const loanId = newId('loan')
  const now = new Date()
  const note = input.note?.trim()
  const purpose = note
    ? `Compra en cuotas · ${m.businessName} · ${note}`
    : `Compra en cuotas · ${m.businessName}`
  let contractId: string | null = null

  await db.transaction(async (tx) => {
    await tx.insert(loan).values({
      id: loanId,
      userId,
      productId: product.id,
      merchantId: m.id,
      type: 'consumo',
      principal: String(amount),
      term,
      monthlyRate: String(monthlyRate),
      tna: String(amort.tna),
      installmentAmount: String(amort.installmentAmount),
      totalAmount: String(amort.totalAmount),
      cft: String(amort.cft),
      status,
      purpose,
      scoreAtApproval: score.score,
      rejectionReason,
      disbursedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    if (status === 'approved') {
      const contract = await ensureLoanContract(
        tx,
        { id: loanId, userId, type: 'consumo', status: 'approved' },
        { generatedBy: 'online_consumo', now },
      )
      contractId = contract?.id ?? null
    }
  })

  if (contractId) {
    await notifyContractReady({
      userId,
      contractId,
      principal: amount,
      term,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/merchant')
  return {
    ok: true as const,
    loanId,
    installmentAmount: amort.installmentAmount,
    status,
    rejectionReason,
    merchantName: m.businessName,
  }
}

export async function getMerchantSales() {
  await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) return []
  return db.select().from(loan).where(eq(loan.merchantId, m.id)).orderBy(desc(loan.createdAt)).limit(50)
}
