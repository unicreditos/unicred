import { and, desc, eq } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { receiptBranding } from '@/lib/brand'
import { db } from '@/lib/db'
import { paymentReceipt, profile, servicePayment, user as userTable, walletMovement } from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { serviceProviderById } from '@/lib/services/catalog'
import { assertIdentityVerified } from '@/lib/wallet/guards'
import { ensureWallet, formatMoney, fromCents, lockWallets, postMovement, WalletError } from '@/lib/wallet/ledger'

/**
 * Pago de servicios y recargas con el saldo de la billetera. El débito es inmediato; el pago al prestador lo liquida
 * tesorería (cola `queued`). Si tesorería no puede liquidarlo, el importe vuelve a la billetera. Mismas tablas que `unicred`.
 */

const authCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join('')
}

export async function payServiceFromWallet(input: { userId: string; providerId: string; accountRef: string; cents: number; attempt?: string }) {
  await assertIdentityVerified(input.userId)
  const provider = serviceProviderById(input.providerId)
  if (!provider) throw new WalletError('Ese prestador no está habilitado.')
  const amount = input.cents / 100
  if (!Number.isInteger(input.cents) || amount < provider.minAmount || amount > provider.maxAmount) {
    throw new WalletError(`El importe para ${provider.name} tiene que estar entre ${formatMoney(provider.minAmount)} y ${formatMoney(provider.maxAmount)}.`)
  }
  const accountRef = String(input.accountRef ?? '').replace(/\s+/g, '').trim()
  if (accountRef.length < 4) throw new WalletError(provider.accountHint)
  if (provider.accountPattern && !provider.accountPattern.test(accountRef)) throw new WalletError(`Referencia inválida. ${provider.accountHint}`)

  const wallet = await ensureWallet(input.userId)
  const paymentId = newId('svc')
  const opId = `OP-${(input.attempt ? input.attempt.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) : Date.now().toString(36)).toUpperCase()}`
  const code = authCode()
  const receiptId = newId('rcpt')
  const receiptNumber = `REC-SVC-${opId}`
  const now = new Date()

  const [[prof], [usr]] = await Promise.all([
    db.select().from(profile).where(eq(profile.userId, input.userId)).limit(1),
    db.select().from(userTable).where(eq(userTable.id, input.userId)).limit(1),
  ])

  const out = await db.transaction(async (tx) => {
    const locked = await lockWallets(tx, [wallet.id])
    const w = locked.get(wallet.id)
    if (!w) throw new WalletError('Billetera no encontrada.')
    const previous = Number(w.balance)
    const move = await postMovement(tx, w, {
      direction: 'debit',
      kind: provider.kind === 'recharge' ? 'service_recharge' : 'service_bill',
      cents: input.cents,
      externalId: `svc-${opId}`,
      reference: opId,
      notes: `${provider.name} · ${accountRef}`,
    })
    if (move.duplicate) throw new WalletError('Ese pago ya se registró.')
    await tx.insert(servicePayment).values({
      id: paymentId, userId: input.userId, walletId: wallet.id, providerId: provider.id, providerName: provider.name, category: provider.category,
      kind: provider.kind, accountRef, amount: fromCents(input.cents), currency: 'ARS', status: 'queued', reference: opId, movementId: move.movementId,
      providerPayload: { rail: 'treasury_rm', authCode: code, operationId: opId, message: 'Débito en la billetera OK. Liquidación al prestador en la cola de tesorería.' },
      createdAt: now, updatedAt: now,
    })
    await tx.insert(paymentReceipt).values({
      id: receiptId, receiptNumber, receiptType: 'service_payment', userId: input.userId, amount: fromCents(input.cents), currency: 'ARS',
      previousBalance: String(previous), newBalance: fromCents(move.balanceAfterCents), method: 'billetera_unicreditos', referenceNumber: opId,
      issuedAt: now, paidAt: now,
      loanSnapshot: { service: true, providerId: provider.id, providerName: provider.name, category: provider.category, kind: provider.kind, accountRef, authCode: code, operationId: opId, servicePaymentId: paymentId },
      customerSnapshot: { name: usr?.name ?? null, email: usr?.email ?? null, cuil: prof?.cuil ?? null, dni: prof?.dni ?? null, phone: prof?.phone ?? null },
      branding: receiptBranding(), createdAt: now,
    })
    return { balanceAfterCents: move.balanceAfterCents }
  })
  await recordAudit({
    actorUserId: input.userId, action: 'SERVICE_PAYMENT', entityType: 'service_payment', entityId: paymentId, targetUserId: input.userId,
    summary: `Pago de ${provider.name} por ${formatMoney(amount)}`,
  })
  return { id: paymentId, receiptId, operationId: opId, authCode: code, providerName: provider.name, balanceAfterCents: out.balanceAfterCents }
}

export async function listServicePaymentsFor(userId: string, limit = 30) {
  const rows = await db.select().from(servicePayment).where(eq(servicePayment.userId, userId)).orderBy(desc(servicePayment.createdAt)).limit(limit)
  if (!rows.length) return []
  const receipts = await db.select({ id: paymentReceipt.id, ref: paymentReceipt.referenceNumber }).from(paymentReceipt).where(and(eq(paymentReceipt.userId, userId), eq(paymentReceipt.receiptType, 'service_payment')))
  const byRef = new Map(receipts.map((r) => [r.ref, r.id]))
  return rows.map((r) => ({ ...r, receiptId: byRef.get(r.reference) ?? null }))
}

export async function listServicePaymentsAdmin(status?: string) {
  const rows = await db
    .select({ p: servicePayment, name: userTable.name, email: userTable.email })
    .from(servicePayment)
    .innerJoin(userTable, eq(userTable.id, servicePayment.userId))
    .where(status ? eq(servicePayment.status, status) : undefined)
    .orderBy(desc(servicePayment.createdAt))
    .limit(100)
  return rows
}

/** Tesorería liquidó el pago al prestador. */
export async function markServiceSettled(adminId: string, paymentId: string, note: string) {
  const text = String(note ?? '').trim().slice(0, 120)
  if (text.length < 4) throw new WalletError('Cargá la referencia o el comprobante de la liquidación.')
  const [current] = await db.select().from(servicePayment).where(eq(servicePayment.id, paymentId)).limit(1)
  if (!current) throw new WalletError('Pago no encontrado.')
  const now = new Date()
  const [row] = await db
    .update(servicePayment)
    .set({
      status: 'executed',
      executedAt: now,
      updatedAt: now,
      providerPayload: { ...((current.providerPayload as Record<string, unknown> | null) ?? {}), settledBy: adminId, settlementRef: text },
    })
    .where(and(eq(servicePayment.id, paymentId), eq(servicePayment.status, 'queued')))
    .returning()
  if (!row) throw new WalletError('Este pago ya fue resuelto.')
  if ((row.providerPayload as { rail?: string } | null)?.rail === 'gire') await issueServiceReceipt(paymentId, { authCode: text })
  await recordAudit({ actorUserId: adminId, action: 'SERVICE_SETTLED', entityType: 'service_payment', entityId: paymentId, targetUserId: row.userId, summary: `Pago de ${row.providerName} liquidado (${text})` })
}

/**
 * Comprobante de un pago de servicio, idempotente: si ya existe devuelve el mismo. Los pagos de la red GIRE lo emiten
 * recién cuando la red confirma (antes no hay nada que probar); los de la cola manual lo traen desde el principio.
 */
export async function issueServiceReceipt(paymentId: string, extra: { authCode?: string | null; operationId?: string | null } = {}) {
  const [p] = await db.select().from(servicePayment).where(eq(servicePayment.id, paymentId)).limit(1)
  if (!p) throw new WalletError('Pago no encontrado.')
  const receiptNumber = `REC-SVC-${p.reference}`
  const [existing] = await db.select({ id: paymentReceipt.id }).from(paymentReceipt).where(eq(paymentReceipt.receiptNumber, receiptNumber)).limit(1)
  if (existing) return existing.id

  const [[prof], [usr], [move]] = await Promise.all([
    db.select().from(profile).where(eq(profile.userId, p.userId)).limit(1),
    db.select().from(userTable).where(eq(userTable.id, p.userId)).limit(1),
    p.movementId ? db.select({ after: walletMovement.balanceAfter }).from(walletMovement).where(eq(walletMovement.id, p.movementId)).limit(1) : Promise.resolve([] as Array<{ after: string }>),
  ])
  const payload = (p.providerPayload as Record<string, unknown> | null) ?? {}
  const gateway = (payload.gateway as { operationId?: string; authCode?: string; operationNumber?: string | null; securityCode?: string | null; posCode?: string | null; voucher?: string[] } | undefined) ?? {}
  const operationId = String(extra.operationId ?? gateway.operationId ?? payload.operationId ?? p.reference)
  // En la red Rapipago el "código" del comprobante es el código de seguridad de la operación; sin él, el número de operación.
  const authCode = String(extra.authCode ?? gateway.securityCode ?? gateway.authCode ?? gateway.operationNumber ?? payload.authCode ?? operationId)
  const after = move ? Number(move.after) : null
  const now = new Date()
  const id = newId('rcpt')
  await db
    .insert(paymentReceipt)
    .values({
      id, receiptNumber, receiptType: 'service_payment', userId: p.userId, amount: p.amount, currency: 'ARS',
      previousBalance: after === null ? null : String(Math.round((after + Number(p.amount)) * 100) / 100),
      newBalance: after === null ? null : String(after), method: 'billetera_unicreditos', referenceNumber: p.reference,
      issuedAt: now, paidAt: p.executedAt ?? now,
      loanSnapshot: {
        service: true, providerId: p.providerId, providerName: p.providerName, category: p.category, kind: p.kind, accountRef: p.accountRef, authCode, operationId, servicePaymentId: p.id,
        ...(payload.rail === 'gire' ? { rail: 'gire', operationNumber: gateway.operationNumber ?? null, securityCode: gateway.securityCode ?? null, posCode: gateway.posCode ?? null, voucherLines: gateway.voucher ?? null } : {}),
      },
      customerSnapshot: { name: usr?.name ?? null, email: usr?.email ?? null, cuil: prof?.cuil ?? null, dni: prof?.dni ?? null, phone: prof?.phone ?? null },
      branding: receiptBranding(), createdAt: now,
    })
    .onConflictDoNothing()
  const [row] = await db.select({ id: paymentReceipt.id }).from(paymentReceipt).where(eq(paymentReceipt.receiptNumber, receiptNumber)).limit(1)
  return row?.id ?? id
}

/**
 * Marca el pago como fallido y devuelve el importe a la billetera, UNA sola vez (la condición `status = 'queued'` lo garantiza
 * aunque la devolución la pidan a la vez una persona de tesorería y la conciliación automática). `actorId = null` es el sistema.
 */
export async function refundServicePayment(actorId: string | null, paymentId: string, reason: string) {
  const text = String(reason ?? '').trim().slice(0, 200)
  const [current] = await db.select().from(servicePayment).where(eq(servicePayment.id, paymentId)).limit(1)
  if (!current) throw new WalletError('Pago no encontrado.')
  const cents = Math.round(Number(current.amount) * 100)
  await db.transaction(async (tx) => {
    const now = new Date()
    const rows = await tx
      .update(servicePayment)
      .set({ status: 'failed', failureReason: text, updatedAt: now })
      .where(and(eq(servicePayment.id, paymentId), eq(servicePayment.status, 'queued')))
      .returning({ id: servicePayment.id })
    if (!rows.length) throw new WalletError('Este pago ya fue resuelto.')
    const locked = await lockWallets(tx, [current.walletId])
    const w = locked.get(current.walletId)
    if (!w) throw new WalletError('Billetera no encontrada.')
    await postMovement(tx, w, {
      direction: 'credit', kind: 'payout_refund', cents, externalId: `svc-refund-${paymentId}`, reference: current.reference,
      notes: `Devolución de ${current.providerName}: ${text}`, allowBlocked: true,
    })
  })
  await recordAudit({
    actorUserId: actorId, action: 'SERVICE_REFUNDED', entityType: 'service_payment', entityId: paymentId, targetUserId: current.userId, severity: 'warning',
    summary: `Pago de ${current.providerName} devuelto${actorId ? '' : ' (automático)'}: ${text}`,
  })
}

/** Tesorería no pudo liquidarlo: se marca fallido y el importe vuelve a la billetera (una sola vez). */
export async function failServiceAndRefund(adminId: string, paymentId: string, reason: string) {
  const text = String(reason ?? '').trim().slice(0, 200)
  if (text.length < 10) throw new WalletError('Contá el motivo (mínimo 10 caracteres): lo ve la persona.')
  await refundServicePayment(adminId, paymentId, text)
}
