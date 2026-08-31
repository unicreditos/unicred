/**
 * Barre pagos pending/processing viejos y los marca expired. Sin esto, un
 * intento de checkout abandonado (el cliente eligió un medio y nunca
 * completó el pago) queda "Pendiente" en el panel para siempre: no hay
 * ningún otro código que lo reconcilie, porque reconcileOpenMercadoPagoPayments
 * solo mira pagos con un id real de Mercado Pago, y los intentos abandonados
 * nunca llegan a tener uno.
 *
 * Dos reglas:
 * 1. expiresAt ya pasó (cupón de red, checkout con vencimiento propio).
 * 2. No tiene expiresAt pero es más viejo que STALE_AFTER_MS — un intento
 *    donde ni siquiera llegó a generarse un link/cupón real del gateway. No
 *    toca 'pending_review' (transferencia a RM esperando revisión manual).
 */
import { db } from '@/lib/db'
import { payment } from '@/lib/db/schema'
import { and, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm'

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

export async function expireStalePayments() {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - STALE_AFTER_MS)
  const result = await db
    .update(payment)
    .set({
      status: 'expired',
      failureReason: 'Vencido sin completar el pago',
      updatedAt: now,
    })
    .where(
      and(
        inArray(payment.status, ['pending', 'processing']),
        or(
          and(isNotNull(payment.expiresAt), lt(payment.expiresAt, now)),
          and(isNull(payment.expiresAt), lt(payment.createdAt, staleCutoff)),
        ),
      ),
    )
    .returning({ id: payment.id })
  return result.length
}
