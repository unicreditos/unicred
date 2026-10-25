import { and, desc, eq } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { user as userTable, walletPayout } from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { notifyPayoutResult } from '@/lib/wallet/notify'
import { getWithdrawableAccount } from '@/lib/wallet/bank-accounts'
import { conceptText, isConceptCode } from '@/lib/wallet/concepts'
import { assertIdentityVerified } from '@/lib/wallet/guards'
import {
  MAX_TRANSFER_CENTS,
  MIN_PAYOUT_CENTS,
  assertAmount,
  ensureWallet,
  formatMoney,
  fromCents,
  lockWallets,
  postMovement,
  shortRef,
  WalletError,
} from '@/lib/wallet/ledger'

/**
 * Retiro a una cuenta bancaria PROPIA. Mismo modelo que `unicred` (`wallet_payout`): el saldo se debita al pedir el
 * retiro (queda retenido) y la orden pasa a `queued`. Un administrador con permiso de tesorería envía la transferencia
 * y la aprueba cargando la referencia bancaria (`executed`), o la rechaza (`cancelled`) y el dinero vuelve a la
 * billetera. Nada sale sin esa aprobación.
 */

/** CBU de la cuenta de tesorería de origen (dato que ya figura en los comprobantes de `unicred`). */
export const TREASURY_CBU = process.env.TREASURY_CBU?.trim() || '1430001725039815100019'

export async function requestPayout(input: {
  userId: string
  accountId: string
  cents: number
  /** Código de concepto de la transferencia (VAR, ALQ, CUO…). */
  conceptCode?: string
  /** Detalle libre opcional. */
  concept?: string
  /** Referencia estable (por intento): un doble clic no genera dos retiros. */
  reference?: string
}) {
  const { cuil } = await assertIdentityVerified(input.userId)
  if (input.reference) {
    // Reintento con la misma clave: se devuelve el retiro original, no se crea otro ni se retiene dos veces.
    const [prior] = await db
      .select()
      .from(walletPayout)
      .where(and(eq(walletPayout.reference, input.reference), eq(walletPayout.userId, input.userId)))
      .limit(1)
    if (prior) {
      const w = await ensureWallet(input.userId)
      return { payoutId: prior.id, reference: prior.reference, balanceAfterCents: Math.round(Number(w.balance) * 100) }
    }
  }
  assertAmount(input.cents, MIN_PAYOUT_CENTS, MAX_TRANSFER_CENTS)
  const account = await getWithdrawableAccount(input.userId, input.accountId, cuil)
  const wallet = await ensureWallet(input.userId)

  const kind = account.cbu ? 'cbu' : account.cvu ? 'cvu' : 'alias'
  const destination = (account.cbu ?? account.cvu ?? account.alias) as string
  const verified = account.isVerified
  const payoutId = newId('payout')
  const reference = input.reference ?? shortRef('UC-OUT')
  const code = input.conceptCode && isConceptCode(input.conceptCode) ? input.conceptCode : 'VAR'
  const note = conceptText(code, input.concept)
  const now = new Date()

  const balanceAfterCents = await db.transaction(async (tx) => {
    const locked = await lockWallets(tx, [wallet.id])
    const w = locked.get(wallet.id)
    if (!w) throw new WalletError('Billetera no encontrada.')
    const move = await postMovement(tx, w, {
      direction: 'debit',
      kind: 'treasury_payout',
      cents: input.cents,
      payoutId,
      externalId: `payout-${reference}`,
      reference,
      notes: `Retiro a ${account.bankName} (${kind === 'alias' ? `alias ${destination}` : `${kind.toUpperCase()} …${destination.slice(-4)}`}) · ${note}`,
    })
    await tx.insert(walletPayout).values({
      id: payoutId,
      userId: input.userId,
      walletId: wallet.id,
      status: 'queued',
      amount: fromCents(input.cents),
      currency: 'ARS',
      destinationKind: kind,
      destinationValue: destination,
      concept: note,
      reference,
      treasuryCbu: TREASURY_CBU,
      rail: 'treasury_rm',
      providerPayload: {
        bankAccountId: account.id,
        bankName: account.bankName,
        holderName: account.holderName,
        holderCuil: account.holderCuil,
        alias: account.alias,
        conceptCode: code,
        // Cuenta cargada a mano (la validación bancaria no estaba disponible): administración verifica la titularidad antes de enviar.
        accountVerified: verified,
        verificationMethod: account.verificationMethod,
        requestedFrom: 'verify',
      },
      createdAt: now,
      updatedAt: now,
    })
    return move.balanceAfterCents
  })

  await recordAudit({
    actorUserId: input.userId,
    action: 'WALLET_PAYOUT_REQUESTED',
    entityType: 'wallet_payout',
    entityId: payoutId,
    targetUserId: input.userId,
    summary: `Retiro solicitado: ${formatMoney(fromCents(input.cents))} a ${account.bankName} …${destination.slice(-4)}`,
    changes: { reference },
  })
  return { payoutId, reference, balanceAfterCents }
}

/** La persona puede cancelar su retiro mientras nadie lo envió: el dinero vuelve a la billetera. */
export async function cancelOwnPayout(userId: string, payoutId: string) {
  return refundPayout({ payoutId, status: 'cancelled', reason: 'Cancelado por el titular', actorUserId: userId, onlyOwnerId: userId })
}

/** Admin: la transferencia ya se envió. Se aprueba con la referencia del banco. */
export async function approveExecutedPayout(input: { adminId: string; payoutId: string; bankReference: string }) {
  const bankReference = input.bankReference.trim().slice(0, 80)
  if (bankReference.length < 4) throw new WalletError('Cargá la referencia o el número de operación de la transferencia enviada.')

  const [current] = await db.select().from(walletPayout).where(eq(walletPayout.id, input.payoutId)).limit(1)
  if (!current) throw new WalletError('La orden no existe.')
  const now = new Date()
  // El estado va en el UPDATE: si dos admins aprueban a la vez, solo uno la encuentra en cola.
  const rows = await db
    .update(walletPayout)
    .set({
      status: 'executed',
      executedAt: now,
      executedBy: input.adminId,
      failureReason: null,
      providerPayload: { ...((current.providerPayload as Record<string, unknown> | null) ?? {}), bankReference, approvedBy: input.adminId },
      updatedAt: now,
    })
    .where(and(eq(walletPayout.id, input.payoutId), eq(walletPayout.status, 'queued')))
    .returning()
  const row = rows[0]
  if (!row) throw new WalletError('La orden ya fue resuelta.')

  await recordAudit({
    actorUserId: input.adminId,
    action: 'WALLET_PAYOUT_EXECUTED',
    entityType: 'wallet_payout',
    entityId: row.id,
    targetUserId: row.userId,
    severity: 'warning',
    summary: `Retiro ${row.reference} aprobado y enviado (${formatMoney(row.amount)}). Referencia bancaria: ${bankReference}`,
    changes: { bankReference },
  })
  await notifyPayoutResult({ userId: row.userId, status: 'executed', amount: row.amount, reference: row.reference })
  return row
}

/** Admin: rechaza el retiro. El dinero vuelve a la billetera. */
export async function rejectPayout(input: { adminId: string; payoutId: string; reason: string }) {
  const reason = input.reason.trim()
  if (reason.length < 10) throw new WalletError('Contá el motivo del rechazo (mínimo 10 caracteres): se lo mostramos a la persona.')
  return refundPayout({ payoutId: input.payoutId, status: 'cancelled', reason, actorUserId: input.adminId })
}

async function refundPayout(input: {
  payoutId: string
  status: 'cancelled'
  reason: string
  actorUserId: string
  onlyOwnerId?: string
}) {
  const now = new Date()
  const result = await db.transaction(async (tx) => {
    // La condición de estado va en el UPDATE: dos resoluciones simultáneas no pueden devolver el dinero dos veces.
    const rows = await tx
      .update(walletPayout)
      .set({ status: input.status, failureReason: input.reason, executedBy: input.actorUserId, updatedAt: now })
      .where(
        and(
          eq(walletPayout.id, input.payoutId),
          eq(walletPayout.status, 'queued'),
          ...(input.onlyOwnerId ? [eq(walletPayout.userId, input.onlyOwnerId)] : []),
        ),
      )
      .returning()
    const payout = rows[0]
    if (!payout) throw new WalletError('La orden ya fue resuelta o no existe.')

    const locked = await lockWallets(tx, [payout.walletId])
    const wallet = locked.get(payout.walletId)
    if (!wallet) throw new WalletError('Billetera no encontrada.')
    const cents = Math.round(Number(payout.amount) * 100)
    await postMovement(tx, wallet, {
      direction: 'credit',
      kind: 'payout_refund',
      cents,
      payoutId: payout.id,
      externalId: `payout-refund-${payout.id}`,
      reference: payout.reference,
      notes: `Devolución del retiro ${payout.reference}: ${input.reason}`,
      allowBlocked: true,
    })
    return payout
  })

  await recordAudit({
    actorUserId: input.actorUserId,
    action: input.onlyOwnerId ? 'WALLET_PAYOUT_CANCELLED_BY_OWNER' : 'WALLET_PAYOUT_REJECTED',
    entityType: 'wallet_payout',
    entityId: result.id,
    targetUserId: result.userId,
    severity: 'warning',
    summary: `Retiro ${result.reference} ${input.onlyOwnerId ? 'cancelado por el titular' : 'rechazado'} y devuelto a la billetera (${formatMoney(result.amount)}): ${input.reason}`,
  })
  if (!input.onlyOwnerId) {
    await notifyPayoutResult({ userId: result.userId, status: 'cancelled', amount: result.amount, reference: result.reference, reason: input.reason })
  }
  return result
}

export async function listPayoutsForUser(userId: string, limit = 30) {
  return db.select().from(walletPayout).where(eq(walletPayout.userId, userId)).orderBy(desc(walletPayout.createdAt)).limit(limit)
}

export async function listPayoutsForAdmin(input: { status?: string; limit?: number }) {
  return db
    .select({
      payout: walletPayout,
      name: userTable.name,
      email: userTable.email,
    })
    .from(walletPayout)
    .innerJoin(userTable, eq(userTable.id, walletPayout.userId))
    .where(input.status ? eq(walletPayout.status, input.status) : undefined)
    .orderBy(desc(walletPayout.createdAt))
    .limit(input.limit ?? 100)
}
