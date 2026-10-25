'use server'

/** Acciones del cliente sobre sus compras en comercios: anticipo (QR o transferencia) y pedido online. */
import { recordAudit } from '@/lib/audit'
import { downPaymentQr, reportDownPaymentTransfer } from '@/lib/merchant-orders/down-payment'
import { notifyOrderCreated } from '@/lib/merchant-orders/notify'
import { customerPendingSteps } from '@/lib/merchant-orders/rules'
import { loadOrders, OrderError, originateMerchantOrder } from '@/lib/merchant-orders/service'
import { fileToDbProof } from '@/lib/proof-storage'
import { consumeRateLimit } from '@/lib/rate-limit'
import { assertRole } from '@/lib/session'
import { TREASURY_ACCOUNT } from '@/lib/treasury'
import { touchDesk } from '@/lib/merchant-orders/desk-cache'
import { revalidatePath } from 'next/cache'

const fail = (err: unknown) => ({
  ok: false as const,
  error: err instanceof OrderError || err instanceof Error ? err.message : 'No se pudo completar la operación.',
})

/** Compras del cliente en comercios. El código de entrega solo se muestra cuando ya puede retirar. */
export async function getMyMerchantOrders() {
  const userId = await assertRole('customer')
  const orders = await loadOrders({ customerUserId: userId, limit: 50 })
  return {
    treasury: {
      bank: TREASURY_ACCOUNT.bank,
      holder: TREASURY_ACCOUNT.holder,
      cuit: TREASURY_ACCOUNT.cuit,
      cbu: TREASURY_ACCOUNT.cbu,
      alias: TREASURY_ACCOUNT.alias,
      accountType: TREASURY_ACCOUNT.accountType,
    },
    orders: orders.map(({ deliveryCode, downPaymentProof: _proof, mpQrData, mpQrExpiresAt, ...o }) => ({
      ...o,
      deliveryCode: o.stage === 'lista_para_entregar' ? deliveryCode : null,
      qr: mpQrData && mpQrExpiresAt && new Date(mpQrExpiresAt).getTime() > Date.now() && o.downPaymentStatus !== 'confirmed'
        ? { data: mpQrData, expiresAt: mpQrExpiresAt }
        : null,
      pendingSteps: o.loanStatus === 'approved' ? customerPendingSteps(o) : [],
    })),
  }
}

export async function createDownPaymentQr(orderId: string) {
  try {
    const userId = await assertRole('customer')
    const limit = await consumeRateLimit(`down-qr:${userId}`, 10, 60 * 60 * 1000)
    if (!limit.ok) throw new OrderError('Generaste demasiados QR. Esperá unos minutos.')
    const qr = await downPaymentQr(orderId, userId)
    revalidatePath('/dashboard/creditos')
    return { ok: true as const, qr: { data: qr.qrData, expiresAt: qr.expiresAt.toISOString() } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (/credential|token|unauthorized|access/i.test(msg)) {
      return { ok: false as const, error: 'El cobro con QR no está disponible en este momento. Pagá el anticipo por transferencia.' }
    }
    return fail(err)
  }
}

export async function reportDownPayment(formData: FormData) {
  try {
    const userId = await assertRole('customer')
    const orderId = String(formData.get('orderId') ?? '')
    const reference = String(formData.get('reference') ?? '')
    const file = formData.get('proof')
    const proof = await fileToDbProof(file as File)
    await reportDownPaymentTransfer({ orderId, customerUserId: userId, reference, proofDataUrl: proof.dataUrl })
    await recordAudit({
      actorUserId: userId,
      action: 'DOWN_PAYMENT_REPORTED',
      entityType: 'merchant_order',
      entityId: orderId,
      targetUserId: userId,
      summary: `Transferencia informada · ref. ${reference.trim()}`,
    })
    revalidatePath('/dashboard/creditos')
    touchDesk()
    return { ok: true as const }
  } catch (err) {
    return fail(err)
  }
}

/** Pedido online desde el catálogo público de un comercio. Mismo circuito: mesa, anticipo y entrega. */
export async function requestOnlineOrder(input: { merchantId: string; term: number; items: Array<{ productId: string; quantity: number }> }) {
  try {
    const userId = await assertRole('customer')
    const limit = await consumeRateLimit(`online-order:${userId}`, 5, 60 * 60 * 1000)
    if (!limit.ok) throw new OrderError('Hiciste varios pedidos seguidos. Esperá un rato.')
    const res = await originateMerchantOrder({
      merchantId: input.merchantId,
      customerUserId: userId,
      items: input.items,
      term: input.term,
      origin: 'online',
      createdBy: userId,
    })
    await recordAudit({
      actorUserId: userId,
      action: 'MERCHANT_ORDER_CREATED',
      entityType: 'merchant_order',
      entityId: res.orderId,
      targetUserId: userId,
      summary: `${res.code} pedido online en ${res.merchantName} · total $ ${res.quote.total.toLocaleString('es-AR')}`,
    })
    await notifyOrderCreated(res.orderId)
    revalidatePath('/dashboard/creditos')
    revalidatePath('/merchant')
    touchDesk()
    return { ok: true as const, code: res.code }
  } catch (err) {
    return fail(err)
  }
}
