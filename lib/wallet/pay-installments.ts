import { and, eq, inArray } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { enqueueInterestInvoices } from '@/lib/arca/invoice'
import { receiptBranding } from '@/lib/brand'
import { db } from '@/lib/db'
import { installment, loan, payment, paymentReceipt } from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { computeEarlySettlement } from '@/lib/legal/settlement'
import { canSettleOnCollection } from '@/lib/loan-state'
import { notifyPaymentReceived } from '@/lib/wallet/notify'
import { ensureWallet, formatMoney, fromCents, lockWallets, postMovement, centsOf, WalletError } from '@/lib/wallet/ledger'

/**
 * Cobro de cuotas con el saldo de la billetera: en UNA transacción se bloquea la billetera, se debita (con la condición
 * de saldo en el propio UPDATE), se registra el pago, se marcan las cuotas, se cierra el crédito si era la última y se
 * emite el recibo. Mismo modelo de datos que `unicred` (`payment`, `payment_receipt`, `installment`); la factura
 * electrónica del IVA sobre intereses queda en cola para que administración la emita contra ARCA.
 */

const toCents = (v: unknown) => Math.round((Number(v) || 0) * 100)

export type PaidResult = { paymentId: string; receiptId: string; receiptIds: string[]; receiptNumber: string; paidCents: number; balanceAfterCents: number; installments: number }

export async function payInstallmentsFromWallet(input: { userId: string; installmentIds: string[]; reference?: string }): Promise<PaidResult> {
  const ids = [...new Set(input.installmentIds.map(String))].filter(Boolean)
  if (!ids.length) throw new WalletError('Elegí al menos una cuota.')
  if (ids.length > 36) throw new WalletError('Podés pagar hasta 36 cuotas por vez.')
  const wallet = await ensureWallet(input.userId)

  const result = await db.transaction(async (tx) => {
    const locked = await lockWallets(tx, [wallet.id])
    const w = locked.get(wallet.id)
    if (!w) throw new WalletError('Billetera no encontrada.')

    const insts = await tx
      .select()
      .from(installment)
      .where(and(inArray(installment.id, ids), eq(installment.userId, input.userId)))
      .for('update')
    if (insts.length !== ids.length) throw new WalletError('Alguna de las cuotas no existe.')
    if (insts.some((i) => i.status === 'paid')) throw new WalletError('Alguna de las cuotas elegidas ya está paga.')
    if (insts.some((i) => i.status === 'cancelled')) throw new WalletError('Alguna de las cuotas fue anulada.')
    const loanId = insts[0].loanId
    if (insts.some((i) => i.loanId !== loanId)) throw new WalletError('Las cuotas tienen que ser de un mismo crédito.')
    const [ln] = await tx.select().from(loan).where(eq(loan.id, loanId)).limit(1)
    if (!ln || ln.status !== 'active') throw new WalletError('Solo se pagan cuotas de un crédito vigente.')

    // Orden de pago: no se salta una cuota anterior impaga del mismo crédito.
    const all = await tx.select().from(installment).where(eq(installment.loanId, loanId))
    const open = all.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').sort((a, b) => a.number - b.number)
    const chosen = new Set(ids)
    const expected = open.slice(0, ids.length).map((i) => i.id)
    if (!expected.every((id) => chosen.has(id))) {
      throw new WalletError('Pagá las cuotas en orden: empezá por la más antigua que tengas pendiente.')
    }

    const totalCents = insts.reduce((a, i) => a + toCents(i.amount), 0)
    const paymentId = newId('pay')
    const reference = input.reference ?? `UC-W-${paymentId.slice(-8).toUpperCase()}`
    const now = new Date()

    // 1) pago (antes del asiento: el asiento referencia al pago)
    await tx.insert(payment).values({
      id: paymentId,
      userId: input.userId,
      loanId,
      installmentId: insts[0].id,
      amount: fromCents(totalCents),
      currency: 'ARS',
      status: 'paid',
      method: 'payway_wallet',
      source: 'web',
      gateway: 'unicred',
      gatewayResponse: { installment_ids: ids, loanId, wallet_id: w.id, cvu: w.cvu },
      externalId: paymentId,
      paymentLinkId: paymentId,
      referenceNumber: reference,
      paidAt: now,
      notes: 'Cobrado con billetera UNICRÉDITOS',
      createdAt: now,
      updatedAt: now,
    })

    // 2) débito con la condición de saldo (si no alcanza, el UPDATE no encuentra fila y se corta)
    const move = await postMovement(tx, w, {
      direction: 'debit',
      kind: 'pay_installment',
      cents: totalCents,
      paymentId,
      externalId: `wallet-pay-${paymentId}`,
      reference,
      notes: `Pago de ${insts.length} cuota${insts.length === 1 ? '' : 's'} del crédito ${loanId.slice(-8).toUpperCase()}`,
    })

    // 3) cuotas
    for (const inst of insts) {
      await tx.update(installment).set({ status: 'paid', paidAt: now }).where(eq(installment.id, inst.id))
    }

    // 4) crédito saldado si no queda nada abierto
    const left = open.filter((i) => !chosen.has(i.id))
    if (left.length === 0 && canSettleOnCollection(ln.status)) {
      await tx.update(loan).set({ status: 'paid', updatedAt: now }).where(and(eq(loan.id, loanId), eq(loan.status, 'active')))
    }

    // 5) un recibo por cada cuota (cada uno con SU cuota, como en unicred): suman el importe del pago
    const ordered = [...insts].sort((x, y) => x.number - y.number)
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const principalTotal = all.reduce((a, i) => a + (Number(i.amount) || 0), 0)
    const paidBefore = all.filter((i) => i.status === 'paid').reduce((a, i) => a + (Number(i.amount) || 0), 0)
    const receiptIds: string[] = []
    let remainingAfter = open.reduce((a, i) => a + (Number(i.amount) || 0), 0)
    let paidToDate = paidBefore
    for (const [idx, inst] of ordered.entries()) {
      const amountNum = Number(inst.amount) || 0
      const previous = remainingAfter
      remainingAfter -= amountNum
      paidToDate += amountNum
      const receiptId = newId('rcpt')
      receiptIds.push(receiptId)
      await tx.insert(paymentReceipt).values({
        id: receiptId,
        receiptNumber: `RC-${stamp}-${paymentId.slice(-6).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
        receiptType: 'payment',
        userId: input.userId,
        paymentId,
        loanId,
        installmentId: inst.id,
        amount: fromCents(toCents(inst.amount)),
        currency: 'ARS',
        loanSnapshot: JSON.parse(JSON.stringify(ln)),
        installmentSnapshot: JSON.parse(JSON.stringify(inst)),
        previousBalance: String(Math.round(previous * 100) / 100),
        newBalance: String(Math.max(0, Math.round(remainingAfter * 100) / 100)),
        pendingInstallments: open.length - idx - 1,
        totalPaidToDate: String(Math.round(paidToDate * 100) / 100),
        method: 'payway_wallet',
        referenceNumber: reference,
        issuedAt: now,
        paidAt: now,
        branding: JSON.parse(JSON.stringify(receiptBranding())),
        createdAt: now,
      })
    }
    void principalTotal
    const receiptId = receiptIds[0]
    const receiptNumber = `RC-${stamp}-${paymentId.slice(-6).toUpperCase()}-01`

    return { paymentId, receiptId, receiptIds, receiptNumber, paidCents: totalCents, balanceAfterCents: move.balanceAfterCents, installments: insts.length, instIds: insts.map((i) => i.id), firstNumber: insts[0].number }
  })

  enqueueInterestInvoices(result.instIds)
  await recordAudit({
    actorUserId: input.userId,
    action: 'INSTALLMENTS_PAID_WALLET',
    entityType: 'payment',
    entityId: result.paymentId,
    targetUserId: input.userId,
    summary: `Pago de ${result.installments} cuota(s) con la billetera por ${formatMoney(fromCents(result.paidCents))}`,
  })
  await notifyPaymentReceived({ userId: input.userId, amount: fromCents(result.paidCents), installmentNumber: result.firstNumber, receiptId: result.receiptId })
  const { instIds: _ids, firstNumber: _n, ...rest } = result
  void _ids
  void _n
  return rest
}

/** Cotización de la cancelación anticipada de un crédito vigente (capital remanente, sin intereses futuros). */
export async function quoteEarlySettlement(userId: string, loanId: string) {
  const [ln] = await db.select().from(loan).where(and(eq(loan.id, loanId), eq(loan.userId, userId))).limit(1)
  if (!ln) throw new WalletError('Crédito no encontrado.')
  const insts = await db.select().from(installment).where(and(eq(installment.loanId, loanId), eq(installment.userId, userId)))
  const unpaid = insts.filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
  const settlement = computeEarlySettlement({
    principal: Number(ln.principal) || 0,
    monthlyRate: Number(ln.monthlyRate) || 0,
    term: ln.term,
    paidCount: insts.filter((i) => i.status === 'paid').length,
    unpaidAmounts: unpaid.map((i) => Number(i.amount) || 0),
  })
  return { loanId, loanStatus: ln.status, ...settlement, unpaidIds: unpaid.map((i) => i.id) }
}

/** Cancela un crédito vigente pagando el capital remanente con la billetera. */
export async function settleLoanEarlyFromWallet(input: { userId: string; loanId: string; reference?: string }) {
  const quote = await quoteEarlySettlement(input.userId, input.loanId)
  if (quote.loanStatus !== 'active') throw new WalletError('Solo se puede cancelar un crédito vigente.')
  if (!quote.unpaidIds.length || quote.settlementAmount <= 0) throw new WalletError('Este crédito no tiene saldo para cancelar.')
  const cents = toCents(quote.settlementAmount)
  const wallet = await ensureWallet(input.userId)

  const out = await db.transaction(async (tx) => {
    const locked = await lockWallets(tx, [wallet.id])
    const w = locked.get(wallet.id)
    if (!w) throw new WalletError('Billetera no encontrada.')
    const [ln] = await tx.select().from(loan).where(and(eq(loan.id, input.loanId), eq(loan.userId, input.userId))).for('update').limit(1)
    if (!ln || ln.status !== 'active') throw new WalletError('El crédito ya no está vigente.')
    const unpaid = await tx
      .select()
      .from(installment)
      .where(and(eq(installment.loanId, input.loanId), eq(installment.userId, input.userId), inArray(installment.status, ['pending', 'overdue'])))
      .for('update')
    if (!unpaid.length) throw new WalletError('Este crédito no tiene cuotas abiertas.')

    const paymentId = newId('pay')
    const reference = input.reference ?? `UC-CAN-${paymentId.slice(-8).toUpperCase()}`
    const now = new Date()
    await tx.insert(payment).values({
      id: paymentId, userId: input.userId, loanId: input.loanId, installmentId: unpaid[0].id, amount: fromCents(cents), currency: 'ARS',
      status: 'paid', method: 'payway_wallet', source: 'web', gateway: 'unicred',
      gatewayResponse: { kind: 'early_settlement', loanId: input.loanId, settlementAmount: quote.settlementAmount, installment_ids: unpaid.map((i) => i.id), wallet_id: w.id },
      externalId: paymentId, paymentLinkId: paymentId, referenceNumber: reference, paidAt: now,
      notes: 'Cancelación anticipada con billetera UNICRÉDITOS', createdAt: now, updatedAt: now,
    })
    const move = await postMovement(tx, w, {
      direction: 'debit',
      kind: 'pay_installment',
      cents,
      paymentId,
      externalId: `wallet-settle-${paymentId}`,
      reference,
      notes: `Cancelación anticipada del crédito ${input.loanId.slice(-8).toUpperCase()}`,
    })
    for (const inst of unpaid) {
      await tx.update(installment).set({ status: 'paid', paidAt: now }).where(eq(installment.id, inst.id))
    }
    await tx.update(loan).set({ status: 'paid', updatedAt: now }).where(and(eq(loan.id, input.loanId), eq(loan.status, 'active')))
    const all = await tx.select().from(installment).where(eq(installment.loanId, input.loanId))
    const receiptId = newId('rcpt')
    const receiptNumber = `RC-CAN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${paymentId.slice(-6).toUpperCase()}`
    await tx.insert(paymentReceipt).values({
      id: receiptId, receiptNumber, receiptType: 'early_settlement', userId: input.userId, paymentId, loanId: input.loanId,
      installmentId: unpaid[0].id, amount: fromCents(cents), currency: 'ARS', loanSnapshot: JSON.parse(JSON.stringify(ln)),
      installmentSnapshot: JSON.parse(JSON.stringify(unpaid)), previousBalance: String(all.reduce((a, i) => a + (Number(i.amount) || 0), 0)),
      newBalance: '0', pendingInstallments: 0, totalPaidToDate: String(all.reduce((a, i) => a + (Number(i.amount) || 0), 0)),
      method: 'payway_wallet', referenceNumber: reference, issuedAt: now, paidAt: now, branding: JSON.parse(JSON.stringify(receiptBranding())), createdAt: now,
    })
    return { paymentId, receiptId, receiptNumber, balanceAfterCents: move.balanceAfterCents, instIds: unpaid.map((i) => i.id) }
  })

  enqueueInterestInvoices(out.instIds)
  await recordAudit({
    actorUserId: input.userId,
    action: 'LOAN_EARLY_SETTLEMENT',
    entityType: 'loan',
    entityId: input.loanId,
    targetUserId: input.userId,
    summary: `Cancelación anticipada con la billetera por ${formatMoney(quote.settlementAmount)}`,
  })
  return { paymentId: out.paymentId, receiptId: out.receiptId, receiptNumber: out.receiptNumber, paidCents: cents, balanceAfterCents: out.balanceAfterCents, balance: centsOf(fromCents(out.balanceAfterCents)) }
}
