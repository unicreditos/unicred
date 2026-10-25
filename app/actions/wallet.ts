'use server'

import { notifyPaymentReceived } from '@/lib/notify-email'
import {
  ensureWalletAccount,
  payInstallmentsFromWallet,
} from '@/lib/payments/wallet'
import { revalidateCustomer } from '@/lib/revalidate'
import { assertRole } from '@/lib/session'

export async function getMyWallet() {
  const userId = await assertRole('customer')
  return ensureWalletAccount(userId)
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

