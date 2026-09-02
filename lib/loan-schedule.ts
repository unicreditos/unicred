import { bankAccount, disbursement, installment, loan } from '@/lib/db/schema'
import { computeFrenchAmortization } from '@/lib/finance'
import { canTransition } from '@/lib/loan-state'
import { newId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

type DbLike = {
  select: (...args: any[]) => any
  insert: (...args: any[]) => any
  update: (...args: any[]) => any
  delete: (...args: any[]) => any
}

export function buildInstallmentValues(input: {
  loanId: string
  userId: string
  principal: number
  term: number
  monthlyRate: number
  from?: Date
}) {
  const from = input.from ?? new Date()
  const amort = computeFrenchAmortization(input.principal, input.term, input.monthlyRate)
  return {
    amort,
    rows: amort.schedule.map((s) => {
      const due = new Date(from)
      due.setMonth(due.getMonth() + s.number)
      return {
        id: newId('inst'),
        loanId: input.loanId,
        userId: input.userId,
        number: s.number,
        amount: s.amount.toFixed(2),
        dueDate: due,
        status: 'pending' as const,
        createdAt: from,
      }
    }),
  }
}

/** Genera el plan de cuotas sólo si el crédito todavía no tiene uno. */
export async function ensureInstallmentPlan(
  tx: DbLike,
  input: {
    loanId: string
    userId: string
    principal: number
    term: number
    monthlyRate: number
    from?: Date
  },
) {
  const existing = await tx
    .select({ id: installment.id })
    .from(installment)
    .where(eq(installment.loanId, input.loanId))
    .limit(1)
  if (existing.length) return { created: false }

  const { rows } = buildInstallmentValues(input)
  if (rows.length) await tx.insert(installment).values(rows)
  return { created: true }
}

/** Orden de desembolso pendiente; no acredita ni activa el crédito. */
export async function ensurePendingDisbursement(
  tx: DbLike,
  input: { loanId: string; userId: string; amount: number; now?: Date },
) {
  const now = input.now ?? new Date()
  const [existing] = await tx
    .select({ id: disbursement.id })
    .from(disbursement)
    .where(eq(disbursement.loanId, input.loanId))
    .limit(1)
  if (existing) return existing.id

  const [destination] = await tx
    .select({ id: bankAccount.id })
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, input.userId), eq(bankAccount.isActive, true)))
    .orderBy(desc(bankAccount.isPrimary))
    .limit(1)

  const id = newId('disb')
  await tx.insert(disbursement).values({
    id,
    loanId: input.loanId,
    userId: input.userId,
    bankAccountId: destination?.id ?? null,
    amount: String(input.amount),
    netAmount: String(input.amount),
    currency: 'ARS',
    status: 'pending',
    disbursementMethod: 'bank_transfer',
    receiptNumber: `DES-${input.loanId.slice(-10).toUpperCase()}`,
    expectedDate: now,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

/** Regenera el cronograma si todavía no hay cuotas pagas. */
export async function rebuildUnpaidInstallmentPlan(
  tx: DbLike,
  input: {
    loanId: string
    userId: string
    principal: number
    term: number
    monthlyRate: number
    from?: Date
  },
) {
  const paid = await tx
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.loanId, input.loanId), eq(installment.status, 'paid')))
    .limit(1)
  if (paid.length) return { created: false, rebuilt: false }

  await tx.delete(installment).where(eq(installment.loanId, input.loanId))
  const result = await ensureInstallmentPlan(tx, input)
  return { ...result, rebuilt: true }
}

export async function activateLoanAfterDisbursement(
  tx: DbLike,
  input: {
    loanId: string
    userId: string
    principal: number
    term: number
    monthlyRate: number
    now?: Date
  },
) {
  const now = input.now ?? new Date()
  // Solo activar si la máquina de estados lo permite (approved→active). Evita
  // que un desembolso reactive un crédito cancelled/rejected por error.
  const [current] = await tx
    .select({ status: loan.status })
    .from(loan)
    .where(eq(loan.id, input.loanId))
    .limit(1)
  if (current && !canTransition(current.status, 'active')) {
    throw new Error(
      `No se puede activar el crédito: transición inválida desde "${current.status}".`,
    )
  }
  await rebuildUnpaidInstallmentPlan(tx, { ...input, from: now })
  await tx
    .update(loan)
    .set({ status: 'active', disbursedAt: now, updatedAt: now })
    .where(eq(loan.id, input.loanId))
}
