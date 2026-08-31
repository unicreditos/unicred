'use server'

import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { loan, loanContract, profile, user as userTable } from '@/lib/db/schema'
import { applyLoanWithdrawal } from '@/lib/legal/withdrawal-apply'
import { consumeRateLimit } from '@/lib/rate-limit'
import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'

async function clientKey() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

export async function withdrawLoanAcceptancePublic(input: {
  cuil: string
  email: string
  reference: string
}) {
  const limit = await consumeRateLimit(`wd:${await clientKey()}`, 5, 10 * 60 * 1000)
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
