import { db } from '@/lib/db'
import { disbursement, installment, loan, loanContract } from '@/lib/db/schema'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'
import { canWithdrawAcceptance, withdrawalDeadline, WITHDRAWAL_DAYS } from '@/lib/legal/withdrawal'
import { and, eq, ne } from 'drizzle-orm'

/**
 * Mutación real del arrepentimiento. No es un Server Action: vive fuera de un
 * archivo 'use server' a propósito, para que nunca sea invocable directo con
 * un userId ajeno. Los dos puntos de entrada (panel autenticado y el flujo
 * público por CUIL+email) ya verificaron la titularidad antes de llamarla.
 * Server-only: toca la DB directo, por eso vive separado de withdrawal.ts
 * (ese sí lo importa un componente cliente para la fecha límite).
 */
export async function applyLoanWithdrawal(loanId: string, userId: string) {
  const [row] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!row) return { ok: false as const, error: 'Crédito no encontrado.' }
  if (row.status === 'cancelled' || row.status === 'rejected') {
    return { ok: false as const, error: 'Ese crédito ya no está vigente.' }
  }

  const [contract] = await db.select().from(loanContract).where(eq(loanContract.loanId, loanId)).limit(1)
  if (!contract || contract.status !== 'accepted' || !contract.acceptedAt) {
    return { ok: false as const, error: 'Solo aplica a un contrato ya aceptado.' }
  }

  if (
    !canWithdrawAcceptance({
      contractStatus: contract.status,
      acceptedAt: contract.acceptedAt,
      loanStatus: row.status,
      disbursedAt: row.disbursedAt,
    })
  ) {
    const deadline = withdrawalDeadline(contract.acceptedAt)
    if (new Date() > deadline) {
      return {
        ok: false as const,
        error: `El plazo de ${WITHDRAWAL_DAYS} días corridos venció. Usá la cancelación anticipada del saldo.`,
      }
    }
    if (row.disbursedAt || row.status === 'active') {
      return {
        ok: false as const,
        error:
          'El crédito ya se acreditó. Para arrepentirte hay que devolver el capital. Escribí a soporte o cancelá el saldo.',
      }
    }
    return { ok: false as const, error: 'Este crédito no admite arrepentimiento en este estado.' }
  }

  const now = new Date()
  await db
    .update(loan)
    .set({ status: 'cancelled', updatedAt: now, rejectionReason: 'Arrepentimiento Ley 24.240 art. 34' })
    .where(eq(loan.id, loanId))
  await db.update(loanContract).set({ status: 'withdrawn', updatedAt: now }).where(eq(loanContract.id, contract.id))
  await db
    .update(installment)
    .set({ status: 'cancelled' })
    .where(and(eq(installment.loanId, loanId), eq(installment.userId, userId), ne(installment.status, 'paid')))
  await db
    .update(disbursement)
    .set({ status: 'cancelled', failureReason: 'Arrepentimiento Ley 24.240', updatedAt: now })
    .where(and(eq(disbursement.loanId, loanId), ne(disbursement.status, 'credited')))

  revalidateCustomer()
  revalidateOps()
  return { ok: true as const }
}
