'use server'

import { persistBcraConsultation } from '@/lib/bcra-persist'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { installment, kycVerification, loan, loanProduct, merchant, profile } from '@/lib/db/schema'
import { computeFrenchAmortization } from '@/lib/finance'
import { ensureLoanContract, notifyContractReady } from '@/lib/legal/expediente'
import { catalogByType } from '@/lib/loan-catalog'
import {
  computeCreditOffer,
  decideUnderwriting,
  OPEN_LOAN_STATUSES,
  type AppRepaymentHistory,
} from '@/lib/loan-underwriting'
import { assertRole, getOrCreateProfile, getRoleForUser, newId } from '@/lib/session'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getMyMerchant() {
  const userId = await assertRole('customer', 'merchant')
  const rows = await db.select().from(merchant).where(eq(merchant.userId, userId)).limit(1)
  return rows[0] ?? null
}

export async function registerMerchant(input: {
  businessName: string
  cuit: string
  category: string
  province: string
  city: string
  address: string
  phone: string
}) {
  const userId = await assertRole('customer', 'merchant')
  const role = await getRoleForUser(userId)
  if (role === 'admin') {
    throw new Error('Las cuentas de administración no pueden operar como comercio.')
  }
  await getOrCreateProfile()

  const existing = await getMyMerchant()
  const now = new Date()

  if (existing) {
    await db
      .update(merchant)
      .set({ ...input, updatedAt: now })
      .where(eq(merchant.id, existing.id))
  } else {
    await db.insert(merchant).values({
      id: newId('merch'),
      userId,
      ...input,
      status: 'pending',
      commissionRate: '8.00',
      createdAt: now,
      updatedAt: now,
    })
  }

  revalidatePath('/merchant')
  return { ok: true }
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
  customerName: string
  customerCuil: string
}) {
  await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) return { ok: false as const, error: 'Registrá tu comercio primero.' }
  if (m.status !== 'active') {
    return { ok: false as const, error: 'Tu comercio todavía no está aprobado por UNICRÉDITOS.' }
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
    return { ok: false as const, error: 'El cliente no tiene KYC Didit aprobado.' }
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

  const monthlyRate = Number(product.monthlyRate)
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
    monthlyRate,
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
  const purpose = `Venta ${m.businessName} — ${input.customerName.trim() || cuil}`
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
  }
}

export async function getMerchantSales() {
  await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) return []
  return db.select().from(loan).where(eq(loan.merchantId, m.id)).orderBy(desc(loan.createdAt)).limit(50)
}
