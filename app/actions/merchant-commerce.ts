'use server'

/** Acciones del comercio: catálogo, ventas financiadas con anticipo, entregas, anulaciones y cuenta de cobro. */
import { getMyMerchant } from '@/app/actions/merchant'
import { validateCBU } from '@/lib/argenapi'
import { recordAudit } from '@/lib/audit'
import { normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import { loanProduct, merchantPayoutAccount, merchantProduct } from '@/lib/db/schema'
import { catalogByType } from '@/lib/loan-catalog'
import { notifyDelivered, notifyOrderCancelled, notifyOrderCreated } from '@/lib/merchant-orders/notify'
import { loadBankHolidays } from '@/lib/merchant-orders/holidays'
import { DOWN_PAYMENT_RATE, nextSettlementDate } from '@/lib/merchant-orders/rules'
import {
  cancelOrder,
  deliverOrder,
  getPayoutAccount,
  listProducts,
  listSettlements,
  loadOrders,
  OrderError,
  originateMerchantOrder,
} from '@/lib/merchant-orders/service'
import { isValidCbuOrCvu } from '@/lib/payments/cvu'
import { consumeRateLimit } from '@/lib/rate-limit'
import { assertRole, newId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { touchDesk } from '@/lib/merchant-orders/desk-cache'
import { revalidatePath } from 'next/cache'

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const fail = (err: unknown): { ok: false; error: string } => ({
  ok: false,
  error: err instanceof OrderError || err instanceof Error ? err.message : 'No se pudo completar la operación.',
})

async function activeMerchant() {
  const userId = await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) throw new OrderError('Registrá tu comercio primero.')
  if (m.status !== 'active') throw new OrderError('Tu comercio todavía no está habilitado por UNICRÉDITOS.')
  return { userId, m }
}

/* ------------------------------ Lectura ------------------------------ */

export async function getMerchantCommerce() {
  await assertRole('customer', 'merchant')
  const m = await getMyMerchant()
  if (!m) return null
  await Promise.all([ensureMerchantCommerceSchema(), loadBankHolidays()])
  const catalog = catalogByType('consumo')
  const [[product], products, orders, settlements, payout] = await Promise.all([
    db.select().from(loanProduct).where(eq(loanProduct.id, catalog.id)).limit(1),
    listProducts(m.id),
    loadOrders({ merchantId: m.id, limit: 300 }),
    listSettlements({ merchantId: m.id, limit: 60 }),
    getPayoutAccount(m.id),
  ])
  return {
    commissionRate: Number(m.commissionRate),
    downPaymentRate: DOWN_PAYMENT_RATE,
    nextPayDate: nextSettlementDate(),
    credit: {
      monthlyRate: Number(product?.monthlyRate ?? catalog.monthlyRate),
      minAmount: Number(product?.minAmount ?? catalog.minAmount),
      maxAmount: Number(product?.maxAmount ?? catalog.maxAmount),
      minTerm: product?.minTerm ?? catalog.minTerm,
      maxTerm: product?.maxTerm ?? catalog.maxTerm,
      active: Boolean(product?.active),
    },
    products: products.map((p) => ({ ...p, price: Number(p.price) })),
    // El código de entrega es del cliente: el comercio nunca lo ve.
    orders: orders.map(({ deliveryCode: _code, downPaymentProof: _proof, mpQrData: _qr, ...o }) => o),
    settlements: settlements.map((r) => ({ ...r.s })),
    payout,
  }
}

/* ------------------------------ Catálogo ------------------------------ */

const IMAGE_RX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

export async function saveProduct(input: {
  id?: string
  name: string
  sku?: string
  description?: string
  category?: string
  price: number
  stock?: number | null
  image?: string | null
  active?: boolean
}): Promise<Result<{ id: string }>> {
  try {
    const { userId, m } = await activeMerchant()
    await ensureMerchantCommerceSchema()
    const name = input.name.trim()
    if (name.length < 2 || name.length > 120) throw new OrderError('El nombre debe tener entre 2 y 120 caracteres.')
    const price = Math.round(Number(input.price) * 100) / 100
    if (!Number.isFinite(price) || price <= 0 || price > 50_000_000) throw new OrderError('Precio inválido.')
    const stock = input.stock == null || String(input.stock) === '' ? null : Math.floor(Number(input.stock))
    if (stock != null && (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000)) throw new OrderError('Stock inválido.')
    const image = input.image ? String(input.image) : null
    if (image && (!IMAGE_RX.test(image) || image.length > 450_000)) throw new OrderError('La foto tiene que ser JPG, PNG o WebP de hasta 300 KB.')
    const values = {
      name,
      sku: input.sku?.trim().slice(0, 40) || null,
      description: input.description?.trim().slice(0, 600) || null,
      category: input.category?.trim().slice(0, 60) || null,
      price: price.toFixed(2),
      stock,
      image,
      active: input.active ?? true,
      updatedAt: new Date(),
    }
    let id = input.id
    if (id) {
      const res = await db
        .update(merchantProduct)
        .set(values)
        .where(and(eq(merchantProduct.id, id), eq(merchantProduct.merchantId, m.id)))
        .returning({ id: merchantProduct.id })
      if (!res.length) throw new OrderError('Producto no encontrado.')
    } else {
      id = newId('mprod')
      await db.insert(merchantProduct).values({ id, merchantId: m.id, ...values })
    }
    await recordAudit({
      actorUserId: userId,
      action: input.id ? 'MERCHANT_PRODUCT_UPDATED' : 'MERCHANT_PRODUCT_CREATED',
      entityType: 'merchant_product',
      entityId: id,
      summary: `${name} · $ ${price.toLocaleString('es-AR')}`,
    })
    revalidatePath('/merchant')
    revalidatePath(`/red-comercios/${m.id}`)
    return { ok: true, data: { id } }
  } catch (err) {
    return fail(err)
  }
}

export async function setProductActive(id: string, active: boolean): Promise<Result> {
  try {
    const { m } = await activeMerchant()
    await ensureMerchantCommerceSchema()
    await db
      .update(merchantProduct)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(merchantProduct.id, id), eq(merchantProduct.merchantId, m.id)))
    revalidatePath('/merchant')
    revalidatePath(`/red-comercios/${m.id}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/* ------------------------------ Ventas ------------------------------ */

export async function createFinancedSale(input: {
  customerCuil: string
  term: number
  items: Array<{ productId: string; quantity: number }>
}): Promise<Result<{ orderId: string; code: string }>> {
  try {
    const { userId, m } = await activeMerchant()
    const limit = await consumeRateLimit(`merchant-sale:${m.id}`, 30, 60 * 60 * 1000)
    if (!limit.ok) throw new OrderError('Demasiadas ventas cargadas en poco tiempo. Esperá unos minutos.')
    const res = await originateMerchantOrder({
      merchantId: m.id,
      customerCuil: normalizeCuit(input.customerCuil),
      items: input.items,
      term: input.term,
      origin: 'local',
      createdBy: userId,
    })
    await recordAudit({
      actorUserId: userId,
      action: 'MERCHANT_ORDER_CREATED',
      entityType: 'merchant_order',
      entityId: res.orderId,
      targetUserId: res.customerUserId,
      summary: `${res.code} · total $ ${res.quote.total.toLocaleString('es-AR')} · anticipo $ ${res.quote.downPayment.toLocaleString('es-AR')} · financiado $ ${res.quote.financed.toLocaleString('es-AR')}`,
    })
    await notifyOrderCreated(res.orderId)
    revalidatePath('/merchant')
    touchDesk()
    return { ok: true, data: { orderId: res.orderId, code: res.code } }
  } catch (err) {
    return fail(err)
  }
}

export async function confirmOrderDelivery(input: { orderId: string; code: string; note?: string }): Promise<Result<{ payDate: string }>> {
  try {
    const { userId, m } = await activeMerchant()
    const limit = await consumeRateLimit(`merchant-deliver:${m.id}`, 12, 15 * 60 * 1000)
    if (!limit.ok) throw new OrderError('Demasiados intentos con códigos de entrega. Esperá unos minutos.')
    const res = await deliverOrder({ orderId: input.orderId, merchantId: m.id, code: input.code, by: userId, note: input.note })
    await recordAudit({
      actorUserId: userId,
      action: 'MERCHANT_ORDER_DELIVERED',
      entityType: 'merchant_order',
      entityId: input.orderId,
      severity: 'warning',
      summary: `Entrega confirmada con código del cliente · liquida el ${res.payDate}`,
    })
    await notifyDelivered(input.orderId)
    revalidatePath('/merchant')
    revalidatePath('/dashboard')
    touchDesk()
    return { ok: true, data: res }
  } catch (err) {
    return fail(err)
  }
}

export async function cancelMerchantOrder(input: { orderId: string; reason: string }): Promise<Result> {
  try {
    const { userId, m } = await activeMerchant()
    await cancelOrder({ orderId: input.orderId, by: userId, reason: input.reason, asAdmin: false, merchantId: m.id })
    await recordAudit({
      actorUserId: userId,
      action: 'MERCHANT_ORDER_CANCELLED',
      entityType: 'merchant_order',
      entityId: input.orderId,
      severity: 'warning',
      summary: input.reason.trim(),
    })
    await notifyOrderCancelled(input.orderId)
    revalidatePath('/merchant')
    revalidatePath('/dashboard')
    touchDesk()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/* ------------------------------ Cuenta de cobro ------------------------------ */

export async function savePayoutAccount(input: { cbu: string; alias?: string }): Promise<Result<{ verified: boolean }>> {
  try {
    const { userId, m } = await activeMerchant()
    await ensureMerchantCommerceSchema()
    const cbu = String(input.cbu ?? '').replace(/\D/g, '')
    if (!isValidCbuOrCvu(cbu)) throw new OrderError('CBU/CVU inválido: revisá los 22 dígitos.')
    const alias = input.alias?.trim().toLowerCase().slice(0, 20) || null
    // Titularidad: la cuenta tiene que ser del CUIT del comercio. Si la red bancaria responde, se exige coincidencia.
    const lookup = await validateCBU(cbu).catch(() => null)
    const ownerCuit = normalizeCuit(String(lookup?.data?.cuit ?? lookup?.data?.cuil ?? lookup?.data?.numeroDocumento ?? ''))
    let verifiedAt: Date | null = null
    if (lookup?.ok && ownerCuit.length === 11) {
      if (ownerCuit !== normalizeCuit(m.cuit)) {
        throw new OrderError('La cuenta no está a nombre del CUIT del comercio. Cargá una cuenta de la que el comercio sea titular.')
      }
      verifiedAt = new Date()
    }
    const now = new Date()
    const values = {
      cbu,
      alias,
      holder: m.legalName || m.businessName,
      holderCuit: normalizeCuit(m.cuit),
      bankName: lookup?.data?.banco || lookup?.data?.entidad || null,
      verifiedAt,
      updatedAt: now,
    }
    await db
      .insert(merchantPayoutAccount)
      .values({ merchantId: m.id, ...values, createdAt: now })
      .onConflictDoUpdate({ target: merchantPayoutAccount.merchantId, set: values })
    await recordAudit({
      actorUserId: userId,
      action: 'MERCHANT_PAYOUT_ACCOUNT_SET',
      entityType: 'merchant',
      entityId: m.id,
      severity: 'warning',
      summary: `Cuenta de cobro …${cbu.slice(-4)} ${verifiedAt ? '(titularidad verificada)' : '(a verificar por tesorería)'}`,
    })
    revalidatePath('/merchant')
    return { ok: true, data: { verified: Boolean(verifiedAt) } }
  } catch (err) {
    return fail(err)
  }
}
