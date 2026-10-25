'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { guard, parseAmountToCents } from '@/lib/action-utils'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { walletAccount } from '@/lib/db/schema'
import { requirePermission } from '@/lib/rbac'
import { disburseLoanToWallet } from '@/lib/wallet/disbursement'
import { MAX_ADJUST_CENTS, MAX_REASON, MIN_ADJUST_CENTS, MIN_REASON, isValidAttemptId } from '@/lib/wallet/adjustment'
import {
  WalletError,
  assertAmount,
  ensureAllWallets,
  ensureWallet,
  formatMoney,
  fromCents,
  lockWallets,
  postMovement,
} from '@/lib/wallet/ledger'
import { approveExecutedPayout, rejectPayout } from '@/lib/wallet/payouts'


function reasonOf(value: string) {
  const reason = String(value ?? '').trim()
  if (reason.length < MIN_REASON) throw new WalletError(`Contá el motivo (mínimo ${MIN_REASON} caracteres): queda en la auditoría.`)
  return reason.slice(0, MAX_REASON)
}

/** Crea la billetera de una persona que todavía no la tiene. */
export async function adminCreateWallet(userId: string) {
  return guard(async () => {
    const adminId = await requirePermission('clients.write')
    const w = await ensureWallet(userId)
    await recordAudit({
      actorUserId: adminId,
      action: 'WALLET_CREATED',
      entityType: 'wallet_account',
      entityId: w.id,
      targetUserId: userId,
      summary: 'Billetera creada desde administración',
    })
    revalidatePath('/admin/billeteras')
    return { alias: w.alias }
  })
}

/** Crea de una vez las billeteras que falten (una por cuenta). */
export async function adminCreateMissingWallets() {
  return guard(async () => {
    const adminId = await requirePermission('clients.write')
    const { created } = await ensureAllWallets()
    await recordAudit({
      actorUserId: adminId,
      action: 'WALLET_BULK_CREATED',
      entityType: 'wallet_account',
      summary: `Billeteras creadas en lote: ${created}`,
    })
    revalidatePath('/admin/billeteras')
    return { created }
  })
}

/** Bloquea o reactiva una billetera. Bloqueada: no puede enviar ni recibir (sí se devuelven retiros). */
export async function adminSetWalletStatus(input: { userId: string; status: 'active' | 'blocked'; reason: string }) {
  return guard(async () => {
    const adminId = await requirePermission('clients.write')
    const reason = reasonOf(input.reason)
    if (input.status !== 'active' && input.status !== 'blocked') throw new WalletError('Estado inválido.')
    if (input.userId === adminId) throw new WalletError('No podés cambiar el estado de tu propia billetera.')
    const rows = await db
      .update(walletAccount)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(walletAccount.userId, input.userId))
      .returning({ id: walletAccount.id })
    if (!rows.length) throw new WalletError('Esa persona no tiene billetera.')
    await recordAudit({
      actorUserId: adminId,
      action: input.status === 'blocked' ? 'WALLET_BLOCKED' : 'WALLET_UNBLOCKED',
      entityType: 'wallet_account',
      entityId: rows[0].id,
      targetUserId: input.userId,
      severity: 'warning',
      summary: `Billetera ${input.status === 'blocked' ? 'bloqueada' : 'reactivada'}: ${reason}`,
    })
    revalidatePath(`/admin/billeteras/${input.userId}`)
    revalidatePath('/admin/billeteras')
    return {}
  })
}

/** Ajuste manual de saldo (acreditar o debitar) con motivo obligatorio. Queda como asiento y en la auditoría. */
export async function adminAdjustWallet(input: { userId: string; direction: 'credit' | 'debit'; amount: string; reason: string; attemptId: string }) {
  return guard(async () => {
    const adminId = await requirePermission('disbursements.credit')
    const reason = reasonOf(input.reason)
    if (input.direction !== 'credit' && input.direction !== 'debit') throw new WalletError('Tipo de ajuste inválido.')
    if (input.userId === adminId) throw new WalletError('No podés ajustar tu propia billetera: pedíselo a otro administrador.')
    // Identificador del intento: lo genera la pantalla al confirmar. Un doble clic repite el mismo y no duplica el asiento.
    if (!isValidAttemptId(input.attemptId)) throw new WalletError('Recargá la página e intentá de nuevo.')
    const cents = parseAmountToCents(input.amount)
    assertAmount(cents, MIN_ADJUST_CENTS, MAX_ADJUST_CENTS)

    const wallet = await ensureWallet(input.userId)
    const result = await db.transaction(async (tx) => {
      const locked = await lockWallets(tx, [wallet.id])
      const w = locked.get(wallet.id)
      if (!w) throw new WalletError('Billetera no encontrada.')
      return postMovement(tx, w, {
        direction: input.direction,
        kind: 'admin_adjustment',
        cents,
        externalId: `adj-${input.attemptId}`,
        reference: `ADJ-${Date.now().toString(36).toUpperCase()}`,
        notes: `Ajuste de administración: ${reason}`,
        allowBlocked: true,
      })
    })
    // Mismo intento ya registrado: se devuelve el resultado original sin duplicar el asiento ni la auditoría.
    if (result.duplicate) return { balance: fromCents(result.balanceAfterCents), duplicate: true as const }
    await recordAudit({
      actorUserId: adminId,
      action: input.direction === 'credit' ? 'WALLET_ADJUST_CREDIT' : 'WALLET_ADJUST_DEBIT',
      entityType: 'wallet_account',
      entityId: wallet.id,
      targetUserId: input.userId,
      severity: 'critical',
      summary: `Ajuste ${input.direction === 'credit' ? 'a favor' : 'en contra'} de ${formatMoney(fromCents(cents))}: ${reason}`,
      changes: { balanceAfter: fromCents(result.balanceAfterCents) },
    })
    revalidatePath(`/admin/billeteras/${input.userId}`)
    revalidatePath('/admin/billeteras')
    return { balance: fromCents(result.balanceAfterCents), duplicate: false as const }
  })
}

/** Retiro: la transferencia ya se envió. Se aprueba con la referencia bancaria. */
export async function adminApprovePayout(input: { payoutId: string; bankReference: string }) {
  return guard(async () => {
    const adminId = await requirePermission('disbursements.credit')
    await approveExecutedPayout({ adminId, payoutId: input.payoutId, bankReference: input.bankReference })
    revalidatePath('/admin/retiros')
    revalidatePath('/admin/billeteras')
    return {}
  })
}

/** Retiro: se rechaza y el dinero vuelve a la billetera. */
export async function adminRejectPayout(input: { payoutId: string; reason: string }) {
  return guard(async () => {
    const adminId = await requirePermission('disbursements.credit')
    await rejectPayout({ adminId, payoutId: input.payoutId, reason: input.reason })
    revalidatePath('/admin/retiros')
    revalidatePath('/admin/billeteras')
    return {}
  })
}

/** Acredita el capital de un crédito aprobado en la billetera y lo activa. */
export async function adminDisburseLoan(loanId: string) {
  return guard(async () => {
    const adminId = await requirePermission('disbursements.credit')
    const out = await disburseLoanToWallet({ adminId, loanId })
    revalidatePath('/admin/desembolsos')
    revalidatePath('/admin/creditos')
    revalidatePath('/admin/billeteras')
    return { receiptNumber: out.receiptNumber, balance: fromCents(out.balanceAfterCents) }
  })
}
