'use server'

import { revalidatePath } from 'next/cache'
import { guard } from '@/lib/action-utils'
import { recordAudit } from '@/lib/audit'
import { mpConfigured } from '@/lib/mercadopago/client'
import { reconcileQr } from '@/lib/mercadopago/settle'
import { requirePermission } from '@/lib/rbac'
import { consumeRateLimit } from '@/lib/rate-limit'
import { WalletError, fromCents } from '@/lib/wallet/ledger'

/** Concilia con Mercado Pago los cobros QR abiertos de todas las cajas (red de seguridad de las notificaciones). */
export async function adminReconcileQr() {
  return guard(async () => {
    const adminId = await requirePermission('payments.reconcile')
    if (!mpConfigured()) throw new WalletError('Mercado Pago no está configurado en este entorno.')
    const gate = await consumeRateLimit(`admin-qr-sync:${adminId}`, 6, 10 * 60 * 1000)
    if (!gate.ok) throw new WalletError('Ya conciliaste hace un momento. Esperá unos minutos.')
    const r = await reconcileQr({ limit: 100 })
    await recordAudit({
      actorUserId: adminId,
      action: 'MP_QR_SYNC',
      entityType: 'mp_qr_payment',
      entityId: 'all',
      summary: `Conciliación de cobros QR: ${r.orders} órdenes, ${r.pos} cajas, ${fromCents(r.creditedCents)} acreditados`,
      changes: { ordenes: r.orders, cajas: r.pos, acreditado: fromCents(r.creditedCents), errores: r.errors },
    })
    revalidatePath('/admin/cobros-qr')
    revalidatePath('/admin/conciliacion')
    return { orders: r.orders, pos: r.pos, credited: fromCents(r.creditedCents), errors: r.errors }
  })
}
