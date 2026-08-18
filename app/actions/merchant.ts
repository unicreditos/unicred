'use server'

import { db } from '@/lib/db'
import { computeFrenchAmortization } from '@/lib/finance'
import { installment, loan, merchant, profile } from '@/lib/db/schema'
import { getOrCreateProfile, newId, requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getMyMerchant() {
  const userId = await requireUserId()
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
  const userId = await requireUserId()
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

  // Marca el perfil como comercio.
  await db.update(profile).set({ role: 'merchant', updatedAt: now }).where(eq(profile.userId, userId))

  revalidatePath('/merchant')
  return { ok: true }
}

/** Crea una venta financiada en cuotas asociada al comercio. */
export async function createMerchantSale(input: {
  amount: number
  term: number
  monthlyRate: number
  customerName: string
}) {
  const userId = await requireUserId()
  const m = await getMyMerchant()
  if (!m) return { ok: false as const, error: 'Registrá tu comercio primero.' }
  if (m.status !== 'active') {
    return { ok: false as const, error: 'Tu comercio todavía no está aprobado por UniCred.' }
  }

  const amount = Math.round(Number(input.amount))
  const term = Math.round(Number(input.term))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, error: 'Monto inválido.' }
  }
  if (!Number.isFinite(term) || term < 1 || term > 24) {
    return { ok: false as const, error: 'El plazo debe estar entre 1 y 24 cuotas.' }
  }

  const amort = computeFrenchAmortization(amount, term, input.monthlyRate)
  const loanId = newId('loan')
  const now = new Date()

  await db.insert(loan).values({
    id: loanId,
    userId,
    merchantId: m.id,
    type: 'comercio',
    principal: String(amount),
    term,
    monthlyRate: String(input.monthlyRate),
    tna: String(amort.tna),
    installmentAmount: String(amort.installmentAmount),
    totalAmount: String(amort.totalAmount),
    cft: String(amort.cft),
    status: 'active',
    purpose: `Venta en cuotas — ${input.customerName}`,
    disbursedAt: now,
    createdAt: now,
    updatedAt: now,
  })

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

  revalidatePath('/merchant')
  return { ok: true as const, loanId, installmentAmount: amort.installmentAmount }
}

export async function getMerchantSales() {
  const userId = await requireUserId()
  const m = await getMyMerchant()
  if (!m) return []
  return db
    .select()
    .from(loan)
    .where(and(eq(loan.merchantId, m.id), eq(loan.userId, userId)))
    .orderBy(desc(loan.createdAt))
}
