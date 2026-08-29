import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  installment,
  loan,
  loanProduct,
  payment,
  profile,
  user as userTable,
} from '@/lib/db/schema'
import { ensureWalletAccount } from '@/lib/payments/wallet'
import { getInbox } from '@/lib/notifications'
import { getRoleForUser } from '@/lib/session'
import { computeCreditOffer } from '@/lib/loan-underwriting'

async function estimateAvailableCreditLine(userId: string, creditScore: number | null): Promise<number | null> {
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const [product] = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.active, true))
    .orderBy(asc(loanProduct.minAmount))
    .limit(1)
  if (!product) return null
  const monthlyIncome = Number(prof?.monthlyIncome ?? 0)
  const score = creditScore ?? prof?.creditScore ?? 550
  const term = Math.min(Math.max(product.minTerm || 6, 12), product.maxTerm || 24)
  const paidRows = await db
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.userId, userId), eq(installment.status, 'paid')))
  const overdueRows = await db
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.userId, userId), eq(installment.status, 'overdue')))
  const completedRows = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, userId), eq(loan.status, 'paid')))
  const offer = computeCreditOffer({
    score,
    monthlyIncome: monthlyIncome > 0 ? monthlyIncome : 300_000,
    term,
    monthlyRate: Number(product.monthlyRate),
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    history: {
      paidCount: paidRows.length,
      overdueCount: overdueRows.length,
      completedLoans: completedRows.length,
    },
  })
  return offer.eligible ? offer.maxAmount : 0
}

export async function mobileDashboard(userId: string) {
  const [usr] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const firstName = (usr?.name ?? '').split(/\s+/)[0] || usr?.name || 'Usuario'

  const activeLoans = await db
    .select()
    .from(loan)
    .where(and(eq(loan.userId, userId), inArray(loan.status, ['active', 'approved', 'disbursed'])))
    .orderBy(desc(loan.createdAt))
    .limit(20)

  const productIds = [...new Set(activeLoans.map((l) => l.productId).filter(Boolean))] as string[]
  const products = productIds.length
    ? await db.select().from(loanProduct).where(inArray(loanProduct.id, productIds))
    : []
  const productMap = new Map(products.map((p) => [p.id, p]))

  const activeLoanSummaries = await Promise.all(
    activeLoans.map(async (row) => {
      const pending = await db
        .select()
        .from(installment)
        .where(and(eq(installment.loanId, row.id), inArray(installment.status, ['pending', 'overdue'])))
        .orderBy(asc(installment.dueDate))
      const nextInst = pending[0]
      const remaining = pending.reduce((s, i) => s + Number(i.amount), 0)
      const daysUntilDue = nextInst
        ? Math.ceil((new Date(nextInst.dueDate as Date).getTime() - Date.now()) / 86400000)
        : null
      const prod = row.productId ? productMap.get(row.productId) : null
      return {
        id: row.id,
        productName: prod?.name ?? row.type ?? 'Préstamo',
        remainingBalance: Math.round(remaining * 100) / 100,
        status: String(row.status).toUpperCase(),
        nextInstallmentAmount: nextInst ? Number(nextInst.amount) : null,
        nextInstallmentDueDate: nextInst?.dueDate ? new Date(nextInst.dueDate as Date).toISOString() : null,
        daysUntilDue,
      }
    }),
  )

  const [nextInstallment] = await db
    .select()
    .from(installment)
    .where(and(eq(installment.userId, userId), inArray(installment.status, ['pending', 'overdue'])))
    .orderBy(asc(installment.dueDate))
    .limit(1)

  let nextPayment = null as null | {
    installmentId: string
    loanId: string
    loanProductName: string
    installmentNumber: number
    amount: number
    dueDate: string
    daysUntilDue: number
  }
  if (nextInstallment) {
    const [loanRow] = await db.select().from(loan).where(eq(loan.id, nextInstallment.loanId)).limit(1)
    const [prod] = loanRow?.productId
      ? await db.select().from(loanProduct).where(eq(loanProduct.id, loanRow.productId)).limit(1)
      : [null]
    const daysUntilDue = Math.ceil((new Date(nextInstallment.dueDate as Date).getTime() - Date.now()) / 86400000)
    nextPayment = {
      installmentId: nextInstallment.id,
      loanId: nextInstallment.loanId,
      loanProductName: prod?.name ?? 'Préstamo',
      installmentNumber: nextInstallment.number,
      amount: Number(nextInstallment.amount),
      dueDate: new Date(nextInstallment.dueDate as Date).toISOString(),
      daysUntilDue,
    }
  }

  const recentPayments = await db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(desc(payment.createdAt))
    .limit(3)

  const role = await getRoleForUser(userId)
  const inbox = await getInbox(userId, role).catch(() => ({ unreadHint: 0 }))

  const availableCreditLine = await estimateAvailableCreditLine(userId, prof?.creditScore ?? null)

  return {
    firstName,
    creditScore: prof?.creditScore ?? null,
    availableCreditLine,
    unreadNotificationCount: Number((inbox as { unreadHint?: number }).unreadHint ?? 0),
    activeLoans: activeLoanSummaries,
    nextPayment,
    recentPayments: recentPayments.map((pay) => ({
      id: pay.id,
      amount: Number(pay.amount),
      method: pay.method,
      status: String(pay.status).toUpperCase(),
      createdAt: pay.createdAt ? new Date(pay.createdAt).toISOString() : new Date().toISOString(),
    })),
  }
}

export async function mobileWalletMe(userId: string) {
  const wallet = await ensureWalletAccount(userId)
  return {
    id: wallet.id,
    cvu: wallet.cvu,
    alias: wallet.alias,
    balance: wallet.balance,
    currency: wallet.currency,
    status: wallet.status,
    holderName: wallet.holderName,
  }
}

export async function mobileWalletMovements(userId: string, limit = 20) {
  const wallet = await ensureWalletAccount(userId)
  return {
    items: wallet.movements.slice(0, limit).map((m) => ({
      id: m.id,
      direction: m.direction,
      kind: m.kind,
      amount: m.amount,
      balanceAfter: m.balanceAfter,
      reference: m.reference,
      notes: m.notes,
      createdAt: m.createdAt,
    })),
  }
}

export async function mobileCreditProducts() {
  const rows = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.active, true))
    .orderBy(asc(loanProduct.name))
  return {
    items: rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.type || p.name,
      minAmount: Number(p.minAmount),
      maxAmount: Number(p.maxAmount),
      minTermMonths: p.minTerm || 3,
      maxTermMonths: p.maxTerm || 24,
      interestRateMonthly: Number(p.monthlyRate),
      cftRate: Number(p.tna) > 0 ? Number(p.tna) * 1.21 : Number(p.monthlyRate) * 12 * 1.21,
      adminFeePercent: 0,
      isActive: !!p.active,
    })),
  }
}

export async function mobileMyLoans(userId: string) {
  const rows = await db.select().from(loan).where(eq(loan.userId, userId)).orderBy(desc(loan.createdAt))
  return rows.map((l) => ({
    id: l.id,
    status: String(l.status).toUpperCase(),
    amount: Number(l.principal),
    installments: l.term,
    type: l.type,
    createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
  }))
}

export async function mobilePaymentsUpcoming(userId: string) {
  const rows = await db
    .select()
    .from(installment)
    .where(and(eq(installment.userId, userId), inArray(installment.status, ['pending', 'overdue'])))
    .orderBy(asc(installment.dueDate))
    .limit(50)

  const loanIds = [...new Set(rows.map((r) => r.loanId))]
  const loans = loanIds.length
    ? await db.select().from(loan).where(inArray(loan.id, loanIds))
    : []
  const loanMap = new Map(loans.map((l) => [l.id, l]))
  const productIds = [...new Set(loans.map((l) => l.productId).filter(Boolean))] as string[]
  const products = productIds.length
    ? await db.select().from(loanProduct).where(inArray(loanProduct.id, productIds))
    : []
  const productMap = new Map(products.map((p) => [p.id, p]))

  return {
    items: rows.map((i) => {
      const loanRow = loanMap.get(i.loanId)
      const prod = loanRow?.productId ? productMap.get(loanRow.productId) : null
      const due = i.dueDate ? new Date(i.dueDate as Date) : new Date()
      const daysUntilDue = Math.ceil((due.getTime() - Date.now()) / 86400000)
      return {
        installmentId: i.id,
        loanId: i.loanId,
        loanProductName: prod?.name ?? loanRow?.type ?? 'Préstamo',
        installmentNumber: i.number,
        amount: Number(i.amount),
        dueDate: due.toISOString(),
        status: String(i.status).toUpperCase(),
        daysUntilDue,
      }
    }),
  }
}

export async function mobileProfile(userId: string) {
  const [usr] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  return {
    id: usr?.id,
    email: usr?.email,
    name: usr?.name,
    phone: usr?.phoneNumber ?? prof?.phone ?? null,
    dni: prof?.dni ?? null,
    cuil: prof?.cuil ?? null,
    kycStatus: prof?.kycStatus ?? 'pending',
    role: prof?.role ?? usr?.role ?? 'customer',
  }
}
