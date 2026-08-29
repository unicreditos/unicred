'use server'

import { notifyPaymentReceived } from '@/lib/notify-email'
import {
  ensureWalletAccount,
  listQueuedPayouts,
  markTreasuryPayoutExecuted,
  payInstallmentsFromWallet,
  reportWalletInbound,
  requestTreasuryPayout,
  transferFromWallet,
  transferInternalP2P,
} from '@/lib/payments/wallet'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'
import { assertRole, requireAdmin } from '@/lib/session'

export async function getMyWallet() {
  const userId = await assertRole('customer')
  return ensureWalletAccount(userId)
}

export async function topUpWalletSandbox(_amount: number) {
  throw new Error(
    'Las cargas de prueba están deshabilitadas. Transferí a tu CVU o alias; el saldo se acredita con Payway.',
  )
}

export async function depositToWallet(amount: number, origin: string) {
  const userId = await assertRole('customer')
  const wallet = await reportWalletInbound(userId, amount, origin)
  revalidateCustomer()
  return wallet
}

/** API propia: envía a billetera interna o ordena egreso por tesorería RM. */
export async function sendFromWallet(amount: number, destination: string, concept?: string) {
  const userId = await assertRole('customer')
  const wallet = await transferFromWallet(userId, amount, destination, concept)
  revalidateCustomer()
  return wallet
}

export async function sendInternalP2P(amount: number, destination: string, concept?: string) {
  const userId = await assertRole('customer')
  const wallet = await transferInternalP2P(userId, amount, destination, concept)
  revalidateCustomer()
  return wallet
}

export async function sendExternalViaTreasury(amount: number, destination: string, concept?: string) {
  const userId = await assertRole('customer')
  const wallet = await requestTreasuryPayout(userId, amount, destination, concept)
  revalidateCustomer()
  return wallet
}

export async function payWithWallet(installmentIds: string[]) {
  const userId = await assertRole('customer')
  const result = await payInstallmentsFromWallet(userId, installmentIds)
  if (result.credited > 0) {
    await notifyPaymentReceived({
      userId,
      amount: result.amount,
      receiptId: result.receiptId,
    })
  }
  revalidateCustomer()
  return result
}

export async function getQueuedTreasuryPayouts() {
  await requireAdmin()
  return listQueuedPayouts(100)
}

export async function confirmTreasuryPayout(payoutId: string) {
  const adminId = await requireAdmin()
  const result = await markTreasuryPayoutExecuted(payoutId, adminId)
  revalidateOps()
  revalidateCustomer()
  return result
}
