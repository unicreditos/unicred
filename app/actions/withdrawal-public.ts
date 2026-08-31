'use server'

import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { disbursement, installment, loan, loanContract, profile, user as userTable } from '@/lib/db/schema'
import { canWithdrawAcceptance, WITHDRAWAL_DAYS } from '@/lib/legal/withdrawal'
import { consumeRateLimit } from '@/lib/rate-limit'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'
import { and, eq, ne, sql } from 'drizzle-orm'
import { headers } from 'next/headers'

async function clientKey() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

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
    const deadline = new Date(contract.acceptedAt)
    deadline.setDate(deadline.getDate() + WITHDRAWAL_DAYS)
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

export async function withdrawLoanAcceptancePublic(input: {
  cuil: string
  email: string
  reference: string
}) {
  const limit = consumeRateLimit(`wd:${await clientKey()}`, 5, 10 * 60 * 1000)
  if (!limit.ok) {
    return { ok: false as const, error: 'Demasiados intentos. Esperá unos minutos o escribinos a soporte.' }
  }

  const cuil = normalizeCuit(input.cuil)
  if (!isValidCuit(cuil)) {
    return { ok: false as const, error: 'CUIL inválido.' }
  }
  const email = String(input.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) {
    return { ok: false as const, error: 'Email inválido.' }
  }
  const reference = String(input.reference ?? '').trim()
  if (reference.length < 6) {
    return { ok: false as const, error: 'Indicá el ID del crédito o del contrato.' }
  }

  const [match] = await db
    .select({ userId: profile.userId, email: userTable.email, cuil: profile.cuil })
    .from(profile)
    .innerJoin(userTable, eq(userTable.id, profile.userId))
    .where(and(eq(profile.cuil, cuil), sql`lower(${userTable.email}) = ${email}`))
    .limit(1)
  if (!match) {
    return { ok: false as const, error: 'No encontramos una cuenta con ese CUIL y email.' }
  }

  const [byLoan] = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, match.userId), eq(loan.id, reference)))
    .limit(1)
  const [byContract] = byLoan
    ? [null]
    : await db
        .select({ loanId: loanContract.loanId })
        .from(loanContract)
        .where(and(eq(loanContract.userId, match.userId), eq(loanContract.id, reference)))
        .limit(1)
  const loanId = byLoan?.id ?? byContract?.loanId
  if (!loanId) {
    return { ok: false as const, error: 'No hay un crédito o contrato con esa referencia en esa cuenta.' }
  }

  return applyLoanWithdrawal(loanId, match.userId)
}
