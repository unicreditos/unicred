'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/session'
import { listServicePayments, payServiceFromWallet } from '@/lib/payments/services'
import { SERVICE_CATEGORIES, SERVICE_PROVIDERS } from '@/lib/services/catalog'

export async function getServicesCatalogAction() {
  await requireUserId()
  return { categories: SERVICE_CATEGORIES, providers: SERVICE_PROVIDERS }
}

export async function listMyServicePaymentsAction() {
  const userId = await requireUserId()
  return listServicePayments(userId)
}

export async function payServiceAction(input: {
  providerId: string
  accountRef: string
  amount: number
}) {
  const userId = await requireUserId()
  try {
    const result = await payServiceFromWallet({
      userId,
      providerId: input.providerId,
      accountRef: input.accountRef,
      amount: input.amount,
    })
    revalidatePath('/dashboard')
    return { ok: true as const, ...result }
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : 'No se pudo procesar el pago.',
    }
  }
}
