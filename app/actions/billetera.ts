'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { guard, parseAmountToCents, assertRateLimit } from '@/lib/action-utils'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { mpQrOrder, walletAccount } from '@/lib/db/schema'
import { assertCustomerId } from '@/lib/session'
import { addOwnBankAccount, LookupUnavailableError, removeOwnBankAccount } from '@/lib/wallet/bank-accounts'
import { parseWalletDestination } from '@/lib/wallet/cvu'
import { assertIdentityVerified } from '@/lib/wallet/guards'
import { scopedRef } from '@/lib/wallet/refs'
import {
  MAX_TRANSFER_CENTS,
  MIN_TRANSFER_CENTS,
  WalletError,
  assertAmount,
  ensureWallet,
  findWalletByDestination,
  fromCents,
  formatMoney,
  transferInternal,
} from '@/lib/wallet/ledger'
import { isSavedContact, maskHolder, removeContact, saveContact, touchContact } from '@/lib/wallet/contacts'
import { cancelOwnPayout, requestPayout } from '@/lib/wallet/payouts'
import { MpError } from '@/lib/mercadopago/client'
import { assertMpReady, cancelQrOrderInMp, createQrOrder, ensureUserPos } from '@/lib/mercadopago/qr'
import { reconcileQr, syncQrOrder } from '@/lib/mercadopago/settle'
import { extractQrToken, isEmvText, qrSvg, verifyQrToken } from '@/lib/wallet/qr'

const EMV_MESSAGE =
  'Ese es un QR de Mercado Pago. Se paga con la cámara o la app de tu banco o de Mercado Pago; acá solo se pagan los QR internos anteriores de UNICRÉDITOS.'

/** Identificador estable por intento: un doble clic repite la misma referencia y no duplica la operación. */
function attemptRef(prefix: string, userId: string, attemptId: string) {
  const clean = String(attemptId ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
  if (clean.length < 8) throw new WalletError('Recargá la página e intentá de nuevo.')
  return scopedRef(prefix, userId, clean)
}

/* ------------------------------ Transferir ------------------------------ */

export async function resolveDestination(raw: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-resolve:${userId}`, 40, 10 * 60 * 1000)
    const dest = parseWalletDestination(raw)
    if (dest.kind === 'cbu') {
      throw new WalletError('Eso es un CBU bancario. Las transferencias son entre billeteras UNICRÉDITOS (CVU o alias); para llevar dinero a tu banco usá Retirar.')
    }
    const w = await findWalletByDestination(raw)
    if (!w) throw new WalletError('No encontramos una billetera UNICRÉDITOS con ese CVU o alias.')
    const own = await ensureWallet(userId)
    if (own.id === w.id) throw new WalletError('Esa es tu propia billetera.')
    return { alias: w.alias, holder: maskHolder(w.holderName), saved: await isSavedContact(userId, w.cvu) }
  })
}

/** Guarda a quien vas a transferirle para elegirlo la próxima vez sin escribir el alias. */
export async function saveContactAction(input: { destination: string; label?: string }) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-contact:${userId}`, 30, 10 * 60 * 1000)
    const res = await saveContact(userId, input)
    revalidatePath('/dashboard/billetera/transferir')
    return { created: res.created }
  })
}

export async function removeContactAction(contactId: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await removeContact(userId, String(contactId ?? ''))
    revalidatePath('/dashboard/billetera/transferir')
    return {}
  })
}

export async function transferToWallet(input: { destination: string; amount: string; concept?: string; attemptId: string }) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-transfer:${userId}`, 20, 10 * 60 * 1000)
    await assertIdentityVerified(userId)
    const cents = parseAmountToCents(input.amount)
    assertAmount(cents)
    const dest = parseWalletDestination(input.destination)
    if (dest.kind === 'cbu') throw new WalletError('Las transferencias son entre billeteras UNICRÉDITOS. Para un CBU bancario usá Retirar.')
    const to = await findWalletByDestination(input.destination)
    if (!to) throw new WalletError('No encontramos una billetera UNICRÉDITOS con ese CVU o alias.')

    const res = await transferInternal({
      fromUserId: userId,
      to,
      cents,
      concept: input.concept,
      channel: 'transfer',
      reference: attemptRef('UC-P2P', userId, input.attemptId),
    })
    await touchContact(userId, to.cvu)
    revalidatePath('/dashboard/billetera')
    return { reference: res.reference, toAlias: res.toAlias, balance: fromCents(res.balanceAfterCents), amount: fromCents(cents), saved: await isSavedContact(userId, to.cvu) }
  })
}

/* ---------------------------------- QR ---------------------------------- */

/** Activa la caja de cobro (PDV) de la persona en Mercado Pago: se crea una sola vez y queda ligada a su billetera. */
export async function activateCollectionPos() {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr-pos:${userId}`, 6, 60 * 60 * 1000)
    await assertIdentityVerified(userId, 'cobrar con QR')
    const wallet = await ensureWallet(userId)
    if (wallet.status !== 'active') throw new WalletError('Tu billetera está bloqueada. Contactá a soporte.')
    assertMpReady()
    try {
      await ensureUserPos(userId)
    } catch (err) {
      if (err instanceof MpError) {
        console.error('[mp-qr] activar caja:', err.status, err.message)
        throw new WalletError(err.transient ? 'Mercado Pago no respondió. Probá de nuevo en unos minutos.' : 'No pudimos abrir tu caja de cobro en Mercado Pago. Avisá a soporte.')
      }
      throw err
    }
    await recordAudit({ actorUserId: userId, action: 'MP_QR_POS_CREATED', entityType: 'wallet', entityId: wallet.id, targetUserId: userId, summary: 'Caja de cobro QR de Mercado Pago activada' })
    revalidatePath('/dashboard/billetera/qr')
    return {}
  })
}

/** Genera un QR de Mercado Pago con importe (y vencimiento) para cobrar a través de la caja de la persona. */
export async function createCollectionQr(input: { amount: string; concept?: string; ttlMinutes?: number; permanent?: boolean }) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr:${userId}`, 40, 10 * 60 * 1000)
    await assertIdentityVerified(userId, 'cobrar con QR')
    const wallet = await ensureWallet(userId)
    if (wallet.status !== 'active') throw new WalletError('Tu billetera está bloqueada. Contactá a soporte.')
    const cents = parseAmountToCents(input.amount)
    assertAmount(cents)
    const ttl = Math.min(Math.max(Math.round(input.ttlMinutes ?? 60), 5), 60 * 24 * 7)
    const { order, qrData } = await createQrOrder({ userId, cents, concept: input.concept, ttlMinutes: ttl, permanent: Boolean(input.permanent) })
    revalidatePath('/dashboard/billetera/qr')
    return {
      orderId: order.id,
      svg: qrData ? await qrSvg(qrData) : null,
      code: qrData,
      permanent: !qrData,
      amount: fromCents(cents),
      concept: order.concept,
      expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
    }
  })
}

/** Estado de un cobro con QR (la pantalla lo consulta cada pocos segundos mientras espera el pago). */
export async function getCollectionQrStatus(orderId: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr-status:${userId}`, 240, 10 * 60 * 1000)
    const [o] = await db.select().from(mpQrOrder).where(and(eq(mpQrOrder.id, orderId), eq(mpQrOrder.userId, userId))).limit(1)
    if (!o) throw new WalletError('No encontramos ese cobro.')
    let status = o.status
    if (status === 'created' || status === 'creating') {
      try {
        status = (await syncQrOrder(o.id)).status
      } catch (err) {
        if (!(err instanceof MpError)) throw err
      }
    }
    if (status === 'paid') revalidatePath('/dashboard/billetera')
    return { status }
  })
}

export async function cancelCollectionQr(orderId: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr-cancel:${userId}`, 30, 10 * 60 * 1000)
    const [o] = await db.select().from(mpQrOrder).where(and(eq(mpQrOrder.id, orderId), eq(mpQrOrder.userId, userId))).limit(1)
    if (!o) throw new WalletError('No encontramos ese cobro.')
    if (o.status !== 'created') throw new WalletError('Ese cobro ya no se puede anular.')
    if (o.mpOrderId) {
      const r = await cancelQrOrderInMp(o.mpOrderId)
      // Si Mercado Pago no lo anuló, se pone al día: puede que ya lo hayan pagado.
      if (!r.ok) {
        const synced = await syncQrOrder(o.id)
        if (synced.status === 'paid') throw new WalletError('Ese cobro ya fue pagado, no se puede anular.')
        if (synced.status !== 'cancelled' && synced.status !== 'expired') throw new WalletError('Mercado Pago no pudo anular el cobro. Probá de nuevo.')
      }
    }
    await db.update(mpQrOrder).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(mpQrOrder.id, o.id), eq(mpQrOrder.status, 'created')))
    revalidatePath('/dashboard/billetera/qr')
    return {}
  })
}

/** Pone al día los cobros de la persona con Mercado Pago (botón "Actualizar"). */
export async function refreshCollections() {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr-refresh:${userId}`, 30, 10 * 60 * 1000)
    const r = await reconcileQr({ userId, limit: 20 })
    if (r.creditedCents > 0) revalidatePath('/dashboard/billetera')
    return { credited: fromCents(r.creditedCents) }
  })
}

export async function previewQr(raw: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr-preview:${userId}`, 60, 10 * 60 * 1000)
    if (isEmvText(raw)) throw new WalletError(EMV_MESSAGE)
    const v = verifyQrToken(extractQrToken(raw))
    if (!v.ok) throw new WalletError(v.reason === 'expired' ? 'Este QR venció. Pedile uno nuevo a quien te cobra.' : 'El código QR no es válido.')
    const [w] = await db.select().from(walletAccount).where(eq(walletAccount.id, v.payload.w)).limit(1)
    if (!w) throw new WalletError('El QR apunta a una billetera que ya no existe.')
    const own = await ensureWallet(userId)
    return {
      token: extractQrToken(raw),
      payee: maskHolder(w.holderName),
      alias: w.alias,
      amount: v.payload.a ? fromCents(v.payload.a) : null,
      concept: v.payload.c ?? null,
      isOwn: own.id === w.id,
    }
  })
}

export async function payQr(input: { token: string; amount?: string; attemptId: string }) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-qr-pay:${userId}`, 20, 10 * 60 * 1000)
    await assertIdentityVerified(userId)
    if (isEmvText(input.token)) throw new WalletError(EMV_MESSAGE)
    const v = verifyQrToken(extractQrToken(input.token))
    if (!v.ok) throw new WalletError(v.reason === 'expired' ? 'Este QR venció. Pedile uno nuevo a quien te cobra.' : 'El código QR no es válido.')

    // Con importe fijo en el QR, manda el del QR (nadie puede pagar de menos); si no, el que eligió quien paga.
    const cents = v.payload.a ?? parseAmountToCents(input.amount ?? '')
    assertAmount(cents, MIN_TRANSFER_CENTS, MAX_TRANSFER_CENTS)
    const [to] = await db.select().from(walletAccount).where(eq(walletAccount.id, v.payload.w)).limit(1)
    if (!to) throw new WalletError('El QR apunta a una billetera que ya no existe.')

    const res = await transferInternal({
      fromUserId: userId,
      to,
      cents,
      concept: v.payload.c,
      channel: 'qr',
      reference: attemptRef('UC-QR', userId, input.attemptId),
    })
    revalidatePath('/dashboard/billetera')
    return { reference: res.reference, payee: maskHolder(to.holderName), amount: fromCents(cents), balance: fromCents(res.balanceAfterCents) }
  })
}

/* ------------------------- Cuentas y retiros propios ----------------------- */

export async function addBankAccount(identifier: string, manual?: { bankName?: string; holderName?: string }) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-bank-add:${userId}`, 10, 60 * 60 * 1000)
    let res: Awaited<ReturnType<typeof addOwnBankAccount>>
    try {
      res = await addOwnBankAccount(userId, identifier, manual)
    } catch (err) {
      // La validación bancaria no respondió: la pantalla ofrece cargar la cuenta a mano.
      if (err instanceof LookupUnavailableError) return { bankName: '', verified: false, needsManual: true }
      throw err
    }
    await recordAudit({
      actorUserId: userId,
      action: res.verified ? 'BANK_ACCOUNT_ADDED' : 'BANK_ACCOUNT_ADDED_MANUAL',
      entityType: 'bank_account',
      entityId: res.id,
      targetUserId: userId,
      severity: res.verified ? 'info' : 'warning',
      summary: res.verified
        ? `Cuenta propia registrada para retiros (${res.bankName})`
        : `Cuenta propia cargada a mano, pendiente de verificación (${res.bankName})`,
    })
    revalidatePath('/dashboard/billetera/cuentas')
    revalidatePath('/dashboard/billetera/retirar')
    return { bankName: res.bankName, verified: res.verified, needsManual: false }
  })
}

export async function removeBankAccount(accountId: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await removeOwnBankAccount(userId, accountId)
    revalidatePath('/dashboard/billetera/cuentas')
    revalidatePath('/dashboard/billetera/retirar')
    return {}
  })
}

export async function requestWithdrawal(input: {
  accountId: string
  amount: string
  conceptCode?: string
  concept?: string
  attemptId: string
}) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await assertRateLimit(`wallet-payout:${userId}`, 5, 10 * 60 * 1000)
    const cents = parseAmountToCents(input.amount)
    const res = await requestPayout({
      userId,
      accountId: input.accountId,
      cents,
      conceptCode: input.conceptCode,
      concept: input.concept,
      reference: attemptRef('UC-OUT', userId, input.attemptId),
    })
    revalidatePath('/dashboard/billetera')
    revalidatePath('/dashboard/billetera/retirar')
    return { reference: res.reference, amount: fromCents(cents), balance: fromCents(res.balanceAfterCents), formatted: formatMoney(fromCents(cents)) }
  })
}

export async function cancelWithdrawal(payoutId: string) {
  return guard(async () => {
    const userId = await assertCustomerId()
    await cancelOwnPayout(userId, payoutId)
    revalidatePath('/dashboard/billetera')
    revalidatePath('/dashboard/billetera/retirar')
    return {}
  })
}
