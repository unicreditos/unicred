/**
 * Pagos de servicios / recargas vía ledger UNICRÉDITOS.
 * Débito inmediato al cliente; liquidación al prestador en cola tesorería RM.
 * Emite recibo printable (modelo comprobante de pago de factura).
 */

import { receiptBranding } from '@/lib/brand'
import { db } from '@/lib/db'
import { paymentReceipt, profile, servicePayment, user, walletAccount, walletMovement } from '@/lib/db/schema'
import { ensureWalletAccount } from '@/lib/payments/wallet'
import { serviceProviderById } from '@/lib/services/catalog'
import { and, desc, eq } from 'drizzle-orm'

function money(value: unknown) {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
}

function authCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

function operationId() {
  return `OP-${Date.now().toString(36).toUpperCase().slice(-8)}`
}

export type ServicePaymentRow = {
  id: string
  providerId: string
  providerName: string
  category: string
  kind: string
  accountRef: string
  amount: number
  status: string
  reference: string
  createdAt: string
  executedAt: string | null
  failureReason: string | null
  receiptId?: string | null
}

export async function listServicePayments(userId: string, limit = 30): Promise<ServicePaymentRow[]> {
  const rows = await db
    .select()
    .from(servicePayment)
    .where(eq(servicePayment.userId, userId))
    .orderBy(desc(servicePayment.createdAt))
    .limit(limit)

  const refs = rows.map((r) => r.reference)
  const receipts =
    refs.length === 0
      ? []
      : await db
          .select({ id: paymentReceipt.id, referenceNumber: paymentReceipt.referenceNumber })
          .from(paymentReceipt)
          .where(eq(paymentReceipt.userId, userId))

  const byRef = new Map(
    receipts
      .filter((r) => r.referenceNumber && refs.includes(r.referenceNumber))
      .map((r) => [r.referenceNumber!, r.id]),
  )

  return rows.map((r) => ({
    id: r.id,
    providerId: r.providerId,
    providerName: r.providerName,
    category: r.category,
    kind: r.kind,
    accountRef: r.accountRef,
    amount: money(r.amount),
    status: r.status,
    reference: r.reference,
    createdAt: r.createdAt.toISOString(),
    executedAt: r.executedAt?.toISOString() ?? null,
    failureReason: r.failureReason,
    receiptId: byRef.get(r.reference) ?? null,
  }))
}

export async function payServiceFromWallet(input: {
  userId: string
  providerId: string
  accountRef: string
  amount: number
}) {
  const provider = serviceProviderById(input.providerId)
  if (!provider) throw new Error('Prestador no habilitado en UNICRÉDITOS.')

  const amount = round2(Number(input.amount))
  if (!Number.isFinite(amount) || amount < provider.minAmount || amount > provider.maxAmount) {
    throw new Error(
      `Monto fuera de rango para ${provider.name}: ${provider.minAmount} a ${provider.maxAmount} ARS.`,
    )
  }

  const accountRef = String(input.accountRef || '').replace(/\s+/g, '').trim()
  if (accountRef.length < 4) throw new Error(provider.accountHint)
  if (provider.accountPattern && !provider.accountPattern.test(accountRef)) {
    throw new Error(`Referencia inválida. ${provider.accountHint}`)
  }

  const wallet = await ensureWalletAccount(input.userId)
  const balance = money(wallet.balance)
  if (balance < amount) {
    throw new Error(
      `Saldo insuficiente. Tenés ${balance.toLocaleString('es-AR')} ARS y el pago es de ${amount.toLocaleString('es-AR')} ARS. Cargá billetera o transferí desde tu CBU.`,
    )
  }

  const paymentId = newId('svc')
  const movementId = newId('wmov')
  const receiptId = newId('rcpt')
  const opId = operationId()
  const code = authCode()
  const reference = opId
  const receiptNumber = `REC-SVC-${opId}`
  const now = new Date()
  let balanceAfter = round2(balance - amount)
  let previousBalance = balance

  const [[prof], [usr]] = await Promise.all([
    db.select().from(profile).where(eq(profile.userId, input.userId)).limit(1),
    db.select().from(user).where(eq(user.id, input.userId)).limit(1),
  ])

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(walletAccount)
      .where(and(eq(walletAccount.id, wallet.id), eq(walletAccount.userId, input.userId)))
      .limit(1)
    if (!locked) throw new Error('Billetera no encontrada.')
    const current = money(locked.balance)
    if (current < amount) throw new Error('Saldo insuficiente al confirmar el pago.')

    previousBalance = current
    balanceAfter = round2(current - amount)
    await tx
      .update(walletAccount)
      .set({ balance: String(balanceAfter), updatedAt: now })
      .where(eq(walletAccount.id, wallet.id))

    await tx.insert(walletMovement).values({
      id: movementId,
      walletId: wallet.id,
      userId: input.userId,
      direction: 'out',
      kind: provider.kind === 'recharge' ? 'service_recharge' : 'service_bill',
      amount: String(amount),
      balanceAfter: String(balanceAfter),
      externalId: reference,
      reference,
      notes: `${provider.name} · ${accountRef}`,
      createdAt: now,
    })

    await tx.insert(servicePayment).values({
      id: paymentId,
      userId: input.userId,
      walletId: wallet.id,
      providerId: provider.id,
      providerName: provider.name,
      category: provider.category,
      kind: provider.kind,
      accountRef,
      amount: String(amount),
      currency: 'ARS',
      status: 'queued',
      reference,
      movementId,
      providerPayload: {
        rail: 'treasury_rm',
        authCode: code,
        operationId: opId,
        message: 'Débito en ledger OK. Liquidación al prestador en cola de tesorería RM.',
      },
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(paymentReceipt).values({
      id: receiptId,
      receiptNumber,
      receiptType: 'service_payment',
      userId: input.userId,
      amount: String(amount),
      currency: 'ARS',
      previousBalance: String(previousBalance),
      newBalance: String(balanceAfter),
      method: 'billetera_unicreditos',
      referenceNumber: reference,
      issuedAt: now,
      paidAt: now,
      loanSnapshot: {
        service: true,
        providerId: provider.id,
        providerName: provider.name,
        category: provider.category,
        kind: provider.kind,
        accountRef,
        authCode: code,
        operationId: opId,
        servicePaymentId: paymentId,
      },
      customerSnapshot: {
        name: usr?.name ?? null,
        email: usr?.email ?? null,
        cuil: prof?.cuil ?? null,
        dni: prof?.dni ?? null,
        phone: prof?.phone ?? null,
      },
      branding: receiptBranding(),
      createdAt: now,
    })
  })

  return {
    id: paymentId,
    receiptId,
    receiptNumber,
    reference,
    operationId: opId,
    authCode: code,
    amount,
    previousBalance,
    balanceAfter,
    status: 'queued' as const,
    providerName: provider.name,
    accountRef,
    category: provider.category,
    kind: provider.kind,
    paidAt: now.toISOString(),
    message: '¡Pago exitoso! Tu pago fue procesado correctamente.',
  }
}

export async function markServicePaymentExecuted(input: {
  paymentId: string
  actorUserId?: string
  failureReason?: string
}) {
  const [row] = await db
    .select()
    .from(servicePayment)
    .where(eq(servicePayment.id, input.paymentId))
    .limit(1)
  if (!row) throw new Error('Pago de servicio no encontrado.')
  if (row.status === 'executed') return row

  const now = new Date()
  if (input.failureReason) {
    await db
      .update(servicePayment)
      .set({
        status: 'failed',
        failureReason: input.failureReason,
        updatedAt: now,
      })
      .where(eq(servicePayment.id, row.id))
  } else {
    await db
      .update(servicePayment)
      .set({
        status: 'executed',
        executedAt: now,
        updatedAt: now,
        providerPayload: {
          ...(typeof row.providerPayload === 'object' && row.providerPayload
            ? (row.providerPayload as object)
            : {}),
          executedBy: input.actorUserId ?? 'ops',
        },
      })
      .where(eq(servicePayment.id, row.id))
  }
  return row
}
