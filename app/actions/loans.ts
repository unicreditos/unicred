'use server'

import { computeScore, getDeudas } from '@/lib/bcra'
import { db } from '@/lib/db'
import { computeFrenchAmortization } from '@/lib/finance'
import { bcraCheck, installment, loan, loanProduct, profile } from '@/lib/db/schema'
import { getOrCreateProfile, newId, requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getLoanProducts() {
  return db.select().from(loanProduct).where(eq(loanProduct.active, true))
}

export async function updateProfile(input: {
  cuil: string
  dni: string
  phone: string
  birthDate: string
  province: string
  city: string
  address: string
  monthlyIncome: number
  employmentStatus: string
}) {
  const userId = await requireUserId()
  await getOrCreateProfile()
  await db
    .update(profile)
    .set({
      cuil: input.cuil,
      dni: input.dni,
      phone: input.phone,
      birthDate: input.birthDate,
      province: input.province,
      city: input.city,
      address: input.address,
      monthlyIncome: String(input.monthlyIncome),
      employmentStatus: input.employmentStatus,
      kycStatus: 'submitted',
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, userId))
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Solicita un préstamo: valida el producto, consulta el BCRA, calcula el score
 * y decide automáticamente la aprobación o el rechazo.
 */
export async function requestLoan(input: {
  productId: string
  amount: number
  term: number
  purpose: string
}) {
  const userId = await requireUserId()
  const prof = await getOrCreateProfile()
  if (!prof) throw new Error('Unauthorized')

  if (!prof.cuil) {
    return { ok: false as const, error: 'Completá tu perfil (CUIL e ingresos) antes de solicitar.' }
  }

  const [product] = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.id, input.productId))
    .limit(1)

  if (!product) return { ok: false as const, error: 'Producto no encontrado.' }

  // Validación server-side de monto y plazo.
  const amount = Math.round(Number(input.amount))
  const term = Math.round(Number(input.term))
  if (
    !Number.isFinite(amount) ||
    amount < Number(product.minAmount) ||
    amount > Number(product.maxAmount)
  ) {
    return { ok: false as const, error: 'El monto solicitado está fuera del rango permitido.' }
  }
  if (!Number.isFinite(term) || term < product.minTerm || term > product.maxTerm) {
    return { ok: false as const, error: 'El plazo solicitado está fuera del rango permitido.' }
  }

  const monthlyRate = Number(product.monthlyRate)
  const amort = computeFrenchAmortization(amount, term, monthlyRate)

  // --- Consulta BCRA + scoring ---
  const monthlyIncome = Number(prof.monthlyIncome ?? 0)
  const deuda = await getDeudas(prof.cuil)
  const score = computeScore({ deuda, monthlyIncome })

  await db.insert(bcraCheck).values({
    id: newId('bcra'),
    userId,
    cuil: prof.cuil,
    worstSituation: deuda.worstSituation,
    totalDebt: String(deuda.totalDebt),
    entitiesCount: deuda.entitiesCount,
    hasRejectedChecks: false,
    rawResult: deuda as unknown as Record<string, unknown>,
    computedScore: score.score,
  })

  await db
    .update(profile)
    .set({ creditScore: score.score, updatedAt: new Date() })
    .where(eq(profile.userId, userId))

  // Reglas de decisión automática.
  const maxInstallmentAffordable = monthlyIncome * 0.35
  let status: 'approved' | 'rejected' = 'approved'
  let rejectionReason: string | null = null

  if (score.score < 560) {
    status = 'rejected'
    rejectionReason = 'Score crediticio insuficiente según la evaluación BCRA.'
  } else if (deuda.worstSituation && deuda.worstSituation >= 4) {
    status = 'rejected'
    rejectionReason = 'Situación crediticia irregular en el BCRA (situación 4 o 5).'
  } else if (monthlyIncome > 0 && amort.installmentAmount > maxInstallmentAffordable) {
    status = 'rejected'
    rejectionReason = 'La cuota supera el 35% de los ingresos declarados.'
  }

  const loanId = newId('loan')
  const now = new Date()

  await db.insert(loan).values({
    id: loanId,
    userId,
    productId: product.id,
    type: product.type,
    principal: String(amount),
    term,
    monthlyRate: String(monthlyRate),
    tna: String(amort.tna),
    installmentAmount: String(amort.installmentAmount),
    totalAmount: String(amort.totalAmount),
    cft: String(amort.cft),
    status,
    purpose: input.purpose,
    scoreAtApproval: score.score,
    rejectionReason,
    disbursedAt: status === 'approved' ? now : null,
    createdAt: now,
    updatedAt: now,
  })

  if (status === 'approved') {
    const installments = amort.schedule.map((s) => {
      const due = new Date(now)
      due.setMonth(due.getMonth() + s.number)
      return {
        id: newId('inst'),
        loanId,
        userId,
        number: s.number,
        amount: String(s.amount),
        dueDate: due,
        status: 'pending' as const,
        createdAt: now,
      }
    })
    await db.insert(installment).values(installments)
    await db.update(loan).set({ status: 'active' }).where(eq(loan.id, loanId))
  }

  revalidatePath('/dashboard')
  return {
    ok: true as const,
    status,
    score: score.score,
    band: score.band,
    reasons: score.reasons,
    rejectionReason,
    loanId,
  }
}

export async function getMyLoans() {
  const userId = await requireUserId()
  return db
    .select()
    .from(loan)
    .where(eq(loan.userId, userId))
    .orderBy(desc(loan.createdAt))
}

export async function getLoanInstallments(loanId: string) {
  const userId = await requireUserId()
  return db
    .select()
    .from(installment)
    .where(and(eq(installment.loanId, loanId), eq(installment.userId, userId)))
    .orderBy(installment.number)
}

export async function payInstallment(installmentId: string) {
  const userId = await requireUserId()
  await db
    .update(installment)
    .set({ status: 'paid', paidAt: new Date() })
    .where(and(eq(installment.id, installmentId), eq(installment.userId, userId)))

  revalidatePath('/dashboard')
  return { ok: true }
}
