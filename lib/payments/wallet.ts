/**
 * Billetera virtual UNICRÉDITOS (cuenta propia + riel Payway / tesorería RM).
 * Ledger de billetera UNICRÉDITOS.
 * El saldo real solo se acredita por inbound Payway / tesorería. Las cargas simuladas están deshabilitadas.
 * El cobro de cuotas descuenta el saldo y emite el recibo Payway.
 */

import { db } from '@/lib/db'
import {
  installment,
  loan,
  payment,
  profile,
  user,
  walletAccount,
  walletMovement,
  walletPayout,
} from '@/lib/db/schema'
import { createPaywayWalletAccountLive, isPaywayConfigured, paywayAllowsSimulate } from '@/lib/payway'
import { buildSandboxAlias, buildSandboxCvu, parseWalletDestination } from '@/lib/payments/cvu'
import { settlePaywayPayment } from '@/lib/payments/settle-payway'
import { executeExternalRail, treasuryOriginLabel } from '@/lib/payments/wallet-rail'
import { TREASURY_ACCOUNT } from '@/lib/treasury'
import { and, desc, eq, inArray } from 'drizzle-orm'

const MAX_SANDBOX_LOAD = 5_000_000
const MAX_TRANSFER = 10_000_000
/** Techo de sanidad para un solo evento de acreditación entrante (webhook). No es un límite de negocio: es un freno ante un payload malformado o forjado. */
export const MAX_INBOUND_WEBHOOK_CREDIT = 5_000_000

function money(value: unknown) {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export type WalletSnapshot = {
  id: string
  status: string
  cvu: string
  alias: string
  holderName: string | null
  taxId: string | null
  balance: number
  currency: string
  provider: string
  sandbox: boolean
  paywayLive: boolean
  treasuryOrigin: string
  createdAt: string
  movements: {
    id: string
    direction: string
    kind: string
    amount: number
    balanceAfter: number
    reference: string | null
    notes: string | null
    createdAt: string
  }[]
  payouts: {
    id: string
    status: string
    amount: number
    destinationKind: string
    destinationValue: string
    concept: string | null
    reference: string
    rail: string
    createdAt: string
    executedAt: string | null
  }[]
}

async function loadSnapshot(userId: string, walletId: string): Promise<WalletSnapshot> {
  const [row] = await db.select().from(walletAccount).where(eq(walletAccount.id, walletId)).limit(1)
  if (!row) throw new Error('Billetera no encontrada.')
  const movements = await db
    .select()
    .from(walletMovement)
    .where(eq(walletMovement.walletId, walletId))
    .orderBy(desc(walletMovement.createdAt))
    .limit(40)
  const payouts = await db
    .select()
    .from(walletPayout)
    .where(eq(walletPayout.walletId, walletId))
    .orderBy(desc(walletPayout.createdAt))
    .limit(20)
  return {
    id: row.id,
    status: row.status,
    cvu: row.cvu,
    alias: row.alias,
    holderName: row.holderName,
    taxId: row.taxId,
    balance: money(row.balance),
    currency: row.currency,
    provider: row.provider,
    sandbox: false,
    paywayLive: Boolean(row.paywayAccountId),
    treasuryOrigin: treasuryOriginLabel(),
    createdAt: row.createdAt.toISOString(),
    movements: movements.map((m) => ({
      id: m.id,
      // UI usa in/out; el ledger persiste credit/debit.
      direction: m.direction === 'credit' || m.direction === 'in' ? 'in' : 'out',
      kind: m.kind,
      amount: money(m.amount),
      balanceAfter: money(m.balanceAfter),
      reference: m.reference,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      status: p.status,
      amount: money(p.amount),
      destinationKind: p.destinationKind,
      destinationValue: p.destinationValue,
      concept: p.concept,
      reference: p.reference,
      rail: p.rail,
      createdAt: p.createdAt.toISOString(),
      executedAt: p.executedAt ? p.executedAt.toISOString() : null,
    })),
  }
}

export async function ensureWalletAccount(userId: string): Promise<WalletSnapshot> {
  const existing = await db.select().from(walletAccount).where(eq(walletAccount.userId, userId)).limit(1)
  if (existing[0]) return loadSnapshot(userId, existing[0].id)

  const [usr] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1)
  const [prof] = await db
    .select({ cuil: profile.cuil, dni: profile.dni })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1)

  const cvu = buildSandboxCvu(userId)
  const alias = buildSandboxAlias(userId)
  const holderName = usr?.name ?? 'Cliente UNICRÉDITOS'
  const taxId = (prof?.cuil || prof?.dni || '').replace(/\D/g, '') || null
  const id = crypto.randomUUID()
  const reference = `UCW-${id.replace(/-/g, '').slice(0, 12)}`
  const now = new Date()

  await db.insert(walletAccount).values({
    id,
    userId,
    status: 'active',
    cvu,
    alias,
    holderName,
    taxId,
    balance: '0.00',
    currency: 'ARS',
    provider: 'unicred',
    paywayAccountId: null,
    pomeloAccountId: null,
    liveAttempt: { pending: isPaywayConfigured() },
    createdAt: now,
    updatedAt: now,
  })

  if (isPaywayConfigured()) {
    void createPaywayWalletAccountLive({
      reference,
      holderName,
      taxId: taxId || '20000000000',
      cvu,
      alias,
      email: usr?.email,
    })
      .then((live) => {
        const body = live.ok && live.body && typeof live.body === 'object' ? (live.body as Record<string, unknown>) : null
        const paywayAccountId = body ? String(body.id ?? body.account_id ?? body.accountId ?? '') || reference : null
        return db
          .update(walletAccount)
          .set({
            paywayAccountId,
            liveAttempt: live,
            updatedAt: new Date(),
          })
          .where(eq(walletAccount.id, id))
      })
      .catch((err) => {
        return db
          .update(walletAccount)
          .set({
            liveAttempt: { error: err instanceof Error ? err.message : 'payway_wallet_omitido' },
            updatedAt: new Date(),
          })
          .where(eq(walletAccount.id, id))
      })
  }

  return loadSnapshot(userId, id)
}

export async function creditWallet(input: {
  userId?: string
  cvu?: string
  alias?: string
  amount: number
  kind: string
  externalId?: string | null
  reference?: string | null
  notes?: string | null
  paymentId?: string | null
}) {
  const amount = round2(input.amount)
  if (!(amount > 0)) throw new Error('Importe inválido.')

  return db.transaction(async (tx) => {
    const filters = []
    if (input.userId) filters.push(eq(walletAccount.userId, input.userId))
    if (input.cvu) filters.push(eq(walletAccount.cvu, input.cvu.replace(/\D/g, '')))
    if (input.alias) filters.push(eq(walletAccount.alias, input.alias.replace(/^@/, '').toLowerCase()))
    if (!filters.length) throw new Error('Billetera no indicada.')

    const [wallet] = await tx.select().from(walletAccount).where(and(...filters)).for('update').limit(1)
    if (!wallet) return { matched: false as const, credited: 0 }

    if (input.externalId) {
      const [dup] = await tx
        .select({ id: walletMovement.id })
        .from(walletMovement)
        .where(eq(walletMovement.externalId, input.externalId))
        .limit(1)
      if (dup) return { matched: true as const, duplicate: true as const, credited: 0, walletId: wallet.id }
    }

    const next = round2(money(wallet.balance) + amount)
    const now = new Date()
    await tx
      .update(walletAccount)
      .set({ balance: String(next.toFixed(2)), updatedAt: now })
      .where(eq(walletAccount.id, wallet.id))
    await tx.insert(walletMovement).values({
      id: crypto.randomUUID(),
      walletId: wallet.id,
      userId: wallet.userId,
      direction: 'credit',
      kind: input.kind,
      amount: String(amount.toFixed(2)),
      balanceAfter: String(next.toFixed(2)),
      paymentId: input.paymentId ?? null,
      externalId: input.externalId ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      createdAt: now,
    })
    return { matched: true as const, credited: amount, walletId: wallet.id, userId: wallet.userId, balance: next }
  })
}

export async function loadWalletSandbox(_userId: string, _amount: number): Promise<never> {
  throw new Error(
    'Las cargas de prueba están deshabilitadas. Transferí a tu CVU o alias; el saldo se acredita cuando Payway confirma el ingreso.',
  )
}

export async function reportWalletInbound(userId: string, amount: number, originRaw: string) {
  if (!paywayAllowsSimulate()) {
    throw new Error(
      'En producción el ingreso llega solo cuando Payway acredita la transferencia al CVU. No se puede informar manualmente.',
    )
  }
  const origin = parseWalletDestination(originRaw)
  const value = round2(amount)
  if (!(value >= 100) || value > MAX_SANDBOX_LOAD) {
    throw new Error(`Ingresá un importe entre $100 y ${MAX_SANDBOX_LOAD.toLocaleString('es-AR')}.`)
  }
  const wallet = await ensureWalletAccount(userId)
  if (origin.kind !== 'alias' && origin.value === wallet.cvu) {
    throw new Error('El origen no puede ser tu propio CVU.')
  }
  const result = await creditWallet({
    userId,
    amount: value,
    kind: 'inbound_transfer',
    externalId: `inbound-${crypto.randomUUID()}`,
    reference: `PW-IN-${Date.now().toString().slice(-8)}`,
    notes: `Ingreso informado desde ${origin.kind.toUpperCase()} ${origin.value}`,
  })
  if (!result.matched) throw new Error('No se pudo acreditar el ingreso.')
  return loadSnapshot(userId, result.walletId!)
}

export async function findWalletByDestination(destinationRaw: string) {
  const destination = parseWalletDestination(destinationRaw)
  if (destination.kind === 'alias') {
    const [row] = await db
      .select()
      .from(walletAccount)
      .where(eq(walletAccount.alias, destination.value))
      .limit(1)
    return row ?? null
  }
  const [row] = await db
    .select()
    .from(walletAccount)
    .where(eq(walletAccount.cvu, destination.value))
    .limit(1)
  return row ?? null
}

/** Transferencia interna entre dos billeteras UNICRÉDITOS (ledger propio, instantánea). */
export async function transferInternalP2P(
  fromUserId: string,
  amount: number,
  destinationRaw: string,
  concept?: string,
) {
  const value = round2(amount)
  if (!(value >= 1) || value > MAX_TRANSFER) {
    throw new Error(`Ingresá un importe entre $1 y ${MAX_TRANSFER.toLocaleString('es-AR')}.`)
  }
  const note = (concept ?? '').trim().slice(0, 80) || 'Transferencia UNICRÉDITOS'
  const destWallet = await findWalletByDestination(destinationRaw)
  if (!destWallet) {
    throw new Error('El destino no es una billetera UNICRÉDITOS. Usá transferencia externa.')
  }
  if (destWallet.userId === fromUserId) {
    throw new Error('No podés transferirte a tu misma billetera.')
  }

  const reference = `UC-P2P-${Date.now().toString().slice(-8)}`
  await db.transaction(async (tx) => {
    const [from] = await tx
      .select()
      .from(walletAccount)
      .where(eq(walletAccount.userId, fromUserId))
      .for('update')
      .limit(1)
    const [to] = await tx
      .select()
      .from(walletAccount)
      .where(eq(walletAccount.id, destWallet.id))
      .for('update')
      .limit(1)
    if (!from || !to) throw new Error('Billetera no encontrada.')
    if (from.status !== 'active' || to.status !== 'active') throw new Error('Alguna billetera está bloqueada.')

    const fromBal = money(from.balance)
    if (fromBal + 0.009 < value) {
      throw new Error(`Saldo insuficiente. Tenés ${fromBal.toLocaleString('es-AR')}.`)
    }
    const now = new Date()
    const fromNext = round2(fromBal - value)
    const toNext = round2(money(to.balance) + value)

    await tx
      .update(walletAccount)
      .set({ balance: String(fromNext.toFixed(2)), updatedAt: now })
      .where(eq(walletAccount.id, from.id))
    await tx
      .update(walletAccount)
      .set({ balance: String(toNext.toFixed(2)), updatedAt: now })
      .where(eq(walletAccount.id, to.id))

    await tx.insert(walletMovement).values({
      id: crypto.randomUUID(),
      walletId: from.id,
      userId: from.userId,
      direction: 'debit',
      kind: 'p2p_out',
      amount: String(value.toFixed(2)),
      balanceAfter: String(fromNext.toFixed(2)),
      counterpartyUserId: to.userId,
      externalId: `p2p-out-${reference}`,
      reference,
      notes: `A @${to.alias} · ${note}`,
      createdAt: now,
    })
    await tx.insert(walletMovement).values({
      id: crypto.randomUUID(),
      walletId: to.id,
      userId: to.userId,
      direction: 'credit',
      kind: 'p2p_in',
      amount: String(value.toFixed(2)),
      balanceAfter: String(toNext.toFixed(2)),
      counterpartyUserId: from.userId,
      externalId: `p2p-in-${reference}`,
      reference,
      notes: `De @${from.alias} · ${note}`,
      createdAt: now,
    })
  })

  return loadSnapshot(fromUserId, (await db.select({ id: walletAccount.id }).from(walletAccount).where(eq(walletAccount.userId, fromUserId)).limit(1))[0]!.id)
}

/**
 * Egreso a banco externo: debita el ledger del cliente y crea orden
 * para que tesorería RM (o Payway/Pomelo) ejecute la transferencia.
 */
export async function requestTreasuryPayout(
  userId: string,
  amount: number,
  destinationRaw: string,
  concept?: string,
) {
  const destination = parseWalletDestination(destinationRaw)
  const value = round2(amount)
  if (!(value >= 100) || value > MAX_TRANSFER) {
    throw new Error(`Ingresá un importe entre $100 y ${MAX_TRANSFER.toLocaleString('es-AR')}.`)
  }
  const note = (concept ?? '').trim().slice(0, 80) || 'Transferencia'
  const internal = await findWalletByDestination(destinationRaw)
  if (internal) {
    return transferInternalP2P(userId, value, destinationRaw, note)
  }

  const payoutId = crypto.randomUUID()
  const reference = `UC-OUT-${Date.now().toString().slice(-8)}`

  // Outbox: el débito y los asientos quedan confirmados ('queued') dentro de
  // la transacción; el riel externo (HTTP a Payway) corre después del commit
  // para no sostener el lock de la billetera durante la llamada de red. Si
  // Payway falla o el proceso se cae antes de actualizar el payout, la plata
  // ya está debitada y registrada — el payout queda 'queued' para reconciliar.
  const rowLock = await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(walletAccount)
      .where(eq(walletAccount.userId, userId))
      .for('update')
      .limit(1)
    if (!wallet) throw new Error('Billetera no encontrada.')
    if (wallet.status !== 'active') throw new Error('La billetera está bloqueada.')
    if (destination.kind !== 'alias' && destination.value === wallet.cvu) {
      throw new Error('No podés transferirte a tu mismo CVU.')
    }
    if (destination.kind === 'alias' && destination.value === wallet.alias) {
      throw new Error('No podés transferirte a tu mismo alias.')
    }

    const balance = money(wallet.balance)
    if (balance + 0.009 < value) {
      throw new Error(`Saldo insuficiente. Tenés ${balance.toLocaleString('es-AR')}.`)
    }

    const next = round2(balance - value)
    const now = new Date()

    await tx
      .update(walletAccount)
      .set({ balance: String(next.toFixed(2)), updatedAt: now })
      .where(eq(walletAccount.id, wallet.id))

    await tx.insert(walletPayout).values({
      id: payoutId,
      userId,
      walletId: wallet.id,
      status: 'queued',
      amount: String(value.toFixed(2)),
      currency: 'ARS',
      destinationKind: destination.kind,
      destinationValue: destination.value,
      concept: note,
      reference,
      treasuryCbu: TREASURY_ACCOUNT.cbu,
      rail: 'treasury_rm',
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(walletMovement).values({
      id: crypto.randomUUID(),
      walletId: wallet.id,
      userId,
      direction: 'debit',
      kind: 'treasury_payout',
      amount: String(value.toFixed(2)),
      balanceAfter: String(next.toFixed(2)),
      payoutId,
      externalId: `payout-${reference}`,
      reference,
      notes: `A ${destination.kind.toUpperCase()} ${destination.value} · ${note} · Origen: tesorería RM`,
      createdAt: now,
    })

    return { walletId: wallet.id, originCvu: wallet.cvu, originAlias: wallet.alias, pomeloSourceAccountId: wallet.pomeloAccountId }
  })

  try {
    const rail = await executeExternalRail({
      reference,
      amount: value,
      originCvu: rowLock.originCvu,
      originAlias: rowLock.originAlias,
      destination,
      concept: note,
      pomeloSourceAccountId: rowLock.pomeloSourceAccountId,
    })
    const status = rail.ok && !rail.queued ? 'executed' : 'queued'
    await db
      .update(walletPayout)
      .set({
        status,
        rail: rail.rail,
        providerPayload: rail.providerPayload as any,
        executedAt: status === 'executed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(walletPayout.id, payoutId))
  } catch (err) {
    // El débito ya está confirmado en el ledger; el payout queda 'queued'
    // para que la reconciliación de tesorería lo reintente.
    await db
      .update(walletPayout)
      .set({ failureReason: err instanceof Error ? err.message : 'error_riel', updatedAt: new Date() })
      .where(eq(walletPayout.id, payoutId))
  }

  return loadSnapshot(userId, rowLock.walletId)
}

/** Compat: detecta P2P interno o egreso por tesorería RM. */
export async function transferFromWallet(
  userId: string,
  amount: number,
  destinationRaw: string,
  concept?: string,
) {
  const internal = await findWalletByDestination(destinationRaw)
  if (internal && internal.userId !== userId) {
    return transferInternalP2P(userId, amount, destinationRaw, concept)
  }
  return requestTreasuryPayout(userId, amount, destinationRaw, concept)
}

export async function markTreasuryPayoutExecuted(payoutId: string, actorUserId: string) {
  const now = new Date()
  const [row] = await db.select().from(walletPayout).where(eq(walletPayout.id, payoutId)).limit(1)
  if (!row) throw new Error('Orden no encontrada.')
  if (row.status === 'executed') return { ok: true as const, already: true as const }
  if (row.status === 'cancelled' || row.status === 'failed') {
    throw new Error(`La orden está ${row.status} y no se puede ejecutar.`)
  }
  await db
    .update(walletPayout)
    .set({
      status: 'executed',
      executedAt: now,
      executedBy: actorUserId,
      updatedAt: now,
      failureReason: null,
    })
    .where(eq(walletPayout.id, payoutId))
  return { ok: true as const, already: false as const }
}

export async function listQueuedPayouts(limit = 50) {
  return db
    .select()
    .from(walletPayout)
    .where(eq(walletPayout.status, 'queued'))
    .orderBy(desc(walletPayout.createdAt))
    .limit(limit)
}

export async function payInstallmentsFromWallet(userId: string, installmentIds: string[]) {
  if (!installmentIds.length) throw new Error('Elegí al menos una cuota.')
  await ensureWalletAccount(userId)

  const result = await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(walletAccount)
      .where(eq(walletAccount.userId, userId))
      .for('update')
      .limit(1)
    if (!wallet) throw new Error('Billetera no encontrada.')
    if (wallet.status !== 'active') throw new Error('La billetera está bloqueada.')

    const insts = await tx
      .select()
      .from(installment)
      .where(and(inArray(installment.id, installmentIds), eq(installment.userId, userId)))
      .for('update')
    if (insts.length !== installmentIds.length) throw new Error('Cuota(s) no encontrada(s).')
    if (insts.some((i) => i.status === 'paid')) throw new Error('Alguna de las cuotas seleccionadas ya está pagada.')

    const loanId = insts[0].loanId
    if (insts.some((i) => i.loanId !== loanId)) {
      throw new Error('Las cuotas deben pertenecer a un mismo crédito.')
    }
    const [loanRow] = await tx.select({ status: loan.status }).from(loan).where(eq(loan.id, loanId)).limit(1)
    if (!loanRow || loanRow.status !== 'active') {
      throw new Error('Solo podés pagar cuotas de un crédito vigente.')
    }

    const total = round2(insts.reduce((acc, i) => acc + money(i.amount), 0))
    const balance = money(wallet.balance)
    if (balance + 0.009 < total) {
      throw new Error(`Saldo insuficiente. Tenés ${balance.toLocaleString('es-AR')} y la cuota es ${total.toLocaleString('es-AR')}.`)
    }

    const paymentId = crypto.randomUUID()
    const reference = `PW-W-${Date.now().toString().slice(-8)}`
    const now = new Date()
    await tx.insert(payment).values({
      id: paymentId,
      userId,
      loanId,
      installmentId: insts[0].id,
      amount: String(total.toFixed(2)),
      currency: 'ARS',
      status: 'pending',
      method: 'payway_wallet',
      source: 'web',
      gateway: 'payway',
      gatewayResponse: {
        installment_ids: installmentIds,
        loanId,
        wallet_id: wallet.id,
        cvu: wallet.cvu,
        sandbox: false,
      },
      externalId: paymentId,
      paymentLinkId: paymentId,
      referenceNumber: reference,
      createdAt: now,
      updatedAt: now,
    } as any)

    const next = round2(balance - total)
    await tx
      .update(walletAccount)
      .set({ balance: String(next.toFixed(2)), updatedAt: now })
      .where(eq(walletAccount.id, wallet.id))
    await tx.insert(walletMovement).values({
      id: crypto.randomUUID(),
      walletId: wallet.id,
      userId,
      direction: 'debit',
      kind: 'pay_installment',
      amount: String(total.toFixed(2)),
      balanceAfter: String(next.toFixed(2)),
      paymentId,
      externalId: `wallet-pay-${paymentId}`,
      reference,
      notes: `Pago de ${insts.length} cuota(s) con billetera virtual`,
      createdAt: now,
    })

    const settled = await settlePaywayPayment({
      status: 'approved',
      amount: total,
      localPaymentId: paymentId,
      paywayId: `wallet-${paymentId.replace(/-/g, '').slice(0, 12)}`,
      method: 'payway_wallet',
      gatewayPayload: { wallet: true, cvu: wallet.cvu, alias: wallet.alias },
      tx,
    })
    if (!settled.credited) {
      throw new Error(settled.reason === 'gateway_distinto' ? 'No se pudo acreditar el cobro.' : 'El cobro no se acreditó.')
    }
    return {
      ok: true as const,
      paymentId,
      credited: settled.credited,
      receiptId: settled.receiptId ?? null,
      amount: total,
      balance: next,
      localPaymentId: settled.localPaymentId ?? paymentId,
    }
  })

  if (result.credited > 0 && result.localPaymentId) {
    const { enqueueInvoicesForPayment } = await import('@/lib/arca/invoice')
    void enqueueInvoicesForPayment(result.localPaymentId)
  }

  return result
}
