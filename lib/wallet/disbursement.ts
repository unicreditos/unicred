import { and, desc, eq, notInArray } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  disbursement,
  installment,
  loan,
  loanContract,
  paymentReceipt,
  profile,
  user as userTable,
  walletAccount,
} from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { addMonths } from '@/lib/legal/mora'
import { receiptBranding } from '@/lib/brand'
import { notifyDisbursementCredited } from '@/lib/wallet/notify'
import { assertIdentityVerified } from '@/lib/wallet/guards'
import { ensureWallet, fromCents, formatMoney, lockWallets, postMovement, WalletError, type Tx } from '@/lib/wallet/ledger'

/** IVA sobre los intereses (se usa para informar el CFT). */
const IVA_INTERESES = 0.21

/** Sistema francés de amortización: misma fórmula que `unicred` (cuota fija redondeada a centavos). */
export function computeFrenchAmortization(principal: number, term: number, monthlyRate: number) {
  const i = monthlyRate / 100
  const raw = i === 0 ? principal / term : (principal * (i * Math.pow(1 + i, term))) / (Math.pow(1 + i, term) - 1)
  const installmentAmount = Math.round(raw * 100) / 100
  const totalAmount = Math.round(installmentAmount * term * 100) / 100
  const tea = Math.round((Math.pow(1 + i, 12) - 1) * 100 * 100) / 100
  return {
    installmentAmount,
    totalAmount,
    tna: Math.round(i * 12 * 100 * 100) / 100,
    tea,
    cft: Math.round(tea * (1 + IVA_INTERESES) * 100) / 100,
    schedule: Array.from({ length: term }, (_, idx) => ({ number: idx + 1, amount: installmentAmount })),
  }
}

/** Transiciones válidas del crédito (misma máquina de estados que `unicred`). */
const CAN_ACTIVATE_FROM = new Set(['approved', 'active'])

/**
 * Acredita el desembolso de un crédito en la billetera de la persona. En una sola transacción:
 *  1) toma la orden de desembolso (la condición de estado va en el UPDATE: no se acredita dos veces),
 *  2) acredita el capital en la billetera (asiento idempotente `disb-<id>`),
 *  3) activa el crédito y genera el plan de cuotas si todavía no hay cuotas pagas,
 *  4) emite el recibo de desembolso.
 * Exige contrato aceptado y identidad verificada.
 */
export async function disburseLoanToWallet(input: { adminId: string; loanId: string }) {
  const [ln] = await db.select().from(loan).where(eq(loan.id, input.loanId)).limit(1)
  if (!ln) throw new WalletError('Crédito no encontrado.')
  if (ln.status === 'pending') throw new WalletError('Aprobá el crédito antes de desembolsar.')
  if (!CAN_ACTIVATE_FROM.has(ln.status)) throw new WalletError('Este crédito no puede desembolsarse en su estado actual.')
  if (ln.disbursedAt) {
    throw new WalletError('Este crédito ya figura desembolsado. Revisá el desembolso existente antes de acreditar de nuevo.')
  }

  const [contract] = await db.select().from(loanContract).where(eq(loanContract.loanId, ln.id)).limit(1)
  if (!contract) throw new WalletError('No hay contrato emitido para este crédito.')
  if (contract.status !== 'accepted') {
    throw new WalletError('El cliente debe aceptar el contrato y el pagaré antes de acreditar el desembolso.')
  }
  await assertIdentityVerified(ln.userId)
  const wallet = await ensureWallet(ln.userId)

  const [cust] = await db
    .select({ fullName: userTable.name, email: userTable.email, cuil: profile.cuil, phone: profile.phone })
    .from(userTable)
    .leftJoin(profile, eq(profile.userId, userTable.id))
    .where(eq(userTable.id, ln.userId))
    .limit(1)

  const now = new Date()
  const principalCents = Math.round(Number(ln.principal) * 100)
  if (!(principalCents > 0)) throw new WalletError('El capital del crédito es inválido.')

  const result = await db.transaction(async (tx) => {
    // 1) orden de desembolso (se crea si no existe) y toma atómica
    const [existing] = await tx.select().from(disbursement).where(eq(disbursement.loanId, ln.id)).limit(1)
    let disbId = existing?.id
    if (!disbId) {
      disbId = newId('disb')
      await tx.insert(disbursement).values({
        id: disbId,
        loanId: ln.id,
        userId: ln.userId,
        amount: fromCents(principalCents),
        netAmount: fromCents(principalCents),
        currency: 'ARS',
        status: 'pending',
        disbursementMethod: 'wallet',
        receiptNumber: `DES-${ln.id.slice(-10).toUpperCase()}`,
        expectedDate: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    const receiptNumber = `DES-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${disbId.slice(-8).toUpperCase()}`
    const taken = await tx
      .update(disbursement)
      .set({
        status: 'credited',
        disbursementMethod: 'wallet',
        creditedAt: now,
        receiptNumber,
        referenceNumber: `WALLET-${wallet.cvu.slice(-6)}`,
        processedBy: input.adminId,
        updatedAt: now,
      })
      .where(and(eq(disbursement.id, disbId), notInArray(disbursement.status, ['credited', 'completed'])))
      .returning({ id: disbursement.id })
    if (!taken.length) throw new WalletError('Este desembolso ya fue acreditado.')

    // 2) acreditación en la billetera
    const locked = await lockWallets(tx, [wallet.id])
    const w = locked.get(wallet.id)
    if (!w) throw new WalletError('Billetera no encontrada.')
    const move = await postMovement(tx, w, {
      direction: 'credit',
      kind: 'loan_disbursement',
      cents: principalCents,
      externalId: `disb-${disbId}`,
      reference: receiptNumber,
      notes: `Desembolso del crédito ${ln.id.slice(-8).toUpperCase()}`,
    })

    // 3) activar el crédito y armar las cuotas
    await activateLoan(tx, ln, now)

    // 4) recibo
    await tx.insert(paymentReceipt).values({
      id: newId('rcpt'),
      receiptNumber,
      receiptType: 'disbursement',
      userId: ln.userId,
      disbursementId: disbId,
      loanId: ln.id,
      amount: fromCents(principalCents),
      currency: 'ARS',
      previousBalance: '0',
      newBalance: String(ln.totalAmount),
      pendingInstallments: ln.term,
      totalPaidToDate: '0',
      loanSnapshot: JSON.parse(JSON.stringify(ln)),
      customerSnapshot: cust ? JSON.parse(JSON.stringify(cust)) : null,
      bankAccountSnapshot: {
        bankName: 'Billetera virtual UNICRÉDITOS',
        accountType: 'cvu',
        cvu: wallet.cvu,
        alias: wallet.alias,
        holderName: wallet.holderName,
        holderCuil: wallet.taxId,
      },
      method: 'wallet',
      referenceNumber: `WALLET-${wallet.cvu.slice(-6)}`,
      paidAt: now,
      issuedAt: now,
      branding: JSON.parse(JSON.stringify(receiptBranding())),
      createdAt: now,
    })
    return { disbId, receiptNumber, balanceAfterCents: move.balanceAfterCents }
  })

  await recordAudit({
    actorUserId: input.adminId,
    action: 'LOAN_DISBURSED_TO_WALLET',
    entityType: 'loan',
    entityId: ln.id,
    targetUserId: ln.userId,
    severity: 'warning',
    summary: `Crédito desembolsado en la billetera: ${formatMoney(fromCents(principalCents))} · ${result.receiptNumber}`,
  })
  await notifyDisbursementCredited({ userId: ln.userId, amount: fromCents(principalCents) })
  return result
}

/** Activa el crédito y regenera el plan de cuotas (solo si no hay cuotas pagas), como `unicred`. */
async function activateLoan(tx: Tx, ln: typeof loan.$inferSelect, now: Date) {
  const [current] = await tx.select({ status: loan.status }).from(loan).where(eq(loan.id, ln.id)).limit(1)
  if (!current || !CAN_ACTIVATE_FROM.has(current.status)) {
    throw new WalletError(`No se puede activar el crédito: estado "${current?.status ?? 'desconocido'}".`)
  }
  const paid = await tx
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.loanId, ln.id), eq(installment.status, 'paid')))
    .limit(1)
  if (!paid.length) {
    await tx.delete(installment).where(eq(installment.loanId, ln.id))
    const amort = computeFrenchAmortization(Number(ln.principal), ln.term, Number(ln.monthlyRate))
    const rows = amort.schedule.map((s) => {
      const due = addMonths(now, s.number)
      return {
        id: newId('inst'),
        loanId: ln.id,
        userId: ln.userId,
        number: s.number,
        amount: s.amount.toFixed(2),
        dueDate: due,
        status: 'pending',
        createdAt: now,
      }
    })
    if (rows.length) await tx.insert(installment).values(rows)
  }
  await tx.update(loan).set({ status: 'active', disbursedAt: now, updatedAt: now }).where(eq(loan.id, ln.id))
}

/** Créditos que esperan desembolso: aprobados, o vigentes con una orden sin acreditar. */
export async function listLoansPendingDisbursement() {
  const rows = await db
    .select({
      loan,
      name: userTable.name,
      email: userTable.email,
      contractStatus: loanContract.status,
      disbursementStatus: disbursement.status,
      walletStatus: walletAccount.status,
    })
    .from(loan)
    .innerJoin(userTable, eq(userTable.id, loan.userId))
    .leftJoin(loanContract, eq(loanContract.loanId, loan.id))
    .leftJoin(disbursement, eq(disbursement.loanId, loan.id))
    .leftJoin(walletAccount, eq(walletAccount.userId, loan.userId))
    .where(and(notInArray(loan.status, ['pending', 'rejected', 'cancelled', 'paid'])))
    .orderBy(desc(loan.createdAt))
  return rows.filter(
    (r) => !r.loan.disbursedAt && r.disbursementStatus !== 'credited' && r.disbursementStatus !== 'completed',
  )
}
