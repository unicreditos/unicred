/**
 * Operaciones de venta financiada en comercios: originación, anticipo, entrega y liquidación.
 * Las acciones (comercio, cliente, backoffice) validan permisos y llaman a estas funciones.
 */
import { persistBcraConsultation } from '@/lib/bcra-persist'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import {
  installment,
  kycVerification,
  loan,
  loanContract,
  loanProduct,
  merchant,
  merchantOrder,
  merchantPayoutAccount,
  merchantProduct,
  merchantSettlement,
  profile,
  user as userTable,
} from '@/lib/db/schema'
import { diditApprovedForUser } from '@/lib/didit'
import { computeFrenchAmortization } from '@/lib/finance'
import { loanPricingFields } from '@/lib/loan-rates'
import { catalogByType } from '@/lib/loan-catalog'
import { activateLoanAfterDisbursement } from '@/lib/loan-schedule'
import { canTransition } from '@/lib/loan-state'
import {
  computeCreditOffer,
  decideUnderwriting,
  OPEN_LOAN_STATUSES,
  type AppRepaymentHistory,
} from '@/lib/loan-underwriting'
import {
  DOWN_PAYMENT_RATE,
  newDeliveryCode,
  newOrderCode,
  orderStage,
  quoteOrder,
  settlementDateFor,
  type OrderStage,
} from '@/lib/merchant-orders/rules'
import { newId } from '@/lib/session'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export { isMerchantOrderLoan } from '@/lib/merchant-orders/detect'

export class OrderError extends Error {}

/* ------------------------------ Lectura ------------------------------ */

export type OrderView = typeof merchantOrder.$inferSelect & {
  stage: OrderStage
  loanStatus: string
  contractSigned: boolean
  contractId: string | null
  term: number
  installmentAmount: number
  monthlyRate: number
  cft: number | null
  rejectionReason: string | null
  customerName: string | null
  customerCuil: string | null
  customerEmail: string | null
  merchantName: string
  settlementStatus: string | null
  settlementPayDate: string | null
}

export async function loadOrders(where: {
  merchantId?: string
  customerUserId?: string
  orderId?: string
  loanId?: string
  settlementId?: string
  limit?: number
}): Promise<OrderView[]> {
  await ensureMerchantCommerceSchema()
  const conds = []
  if (where.merchantId) conds.push(eq(merchantOrder.merchantId, where.merchantId))
  if (where.customerUserId) conds.push(eq(merchantOrder.customerUserId, where.customerUserId))
  if (where.orderId) conds.push(eq(merchantOrder.id, where.orderId))
  if (where.loanId) conds.push(eq(merchantOrder.loanId, where.loanId))
  if (where.settlementId) conds.push(eq(merchantOrder.settlementId, where.settlementId))
  const rows = await db
    .select({
      o: merchantOrder,
      loanStatus: loan.status,
      term: loan.term,
      installmentAmount: loan.installmentAmount,
      monthlyRate: loan.monthlyRate,
      cft: loan.cft,
      rejectionReason: loan.rejectionReason,
      contractId: loanContract.id,
      contractStatus: loanContract.status,
      customerName: userTable.name,
      customerEmail: userTable.email,
      customerCuil: profile.cuil,
      merchantName: merchant.businessName,
      settlementStatus: merchantSettlement.status,
      settlementPayDate: merchantSettlement.payDate,
    })
    .from(merchantOrder)
    .innerJoin(loan, eq(loan.id, merchantOrder.loanId))
    .innerJoin(merchant, eq(merchant.id, merchantOrder.merchantId))
    .leftJoin(loanContract, eq(loanContract.loanId, merchantOrder.loanId))
    .leftJoin(userTable, eq(userTable.id, merchantOrder.customerUserId))
    .leftJoin(profile, eq(profile.userId, merchantOrder.customerUserId))
    .leftJoin(merchantSettlement, eq(merchantSettlement.id, merchantOrder.settlementId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(merchantOrder.createdAt))
    .limit(where.limit ?? 500)
  return rows.map((r) => {
    const contractSigned = r.contractStatus === 'accepted'
    return {
      ...r.o,
      stage: orderStage({
        loanStatus: r.loanStatus,
        contractSigned,
        downPaymentStatus: r.o.downPaymentStatus,
        deliveredAt: r.o.deliveredAt,
        cancelledAt: r.o.cancelledAt,
        settlementPaid: r.settlementStatus === 'paid',
      }),
      loanStatus: r.loanStatus,
      contractSigned,
      contractId: r.contractId,
      term: r.term,
      installmentAmount: Number(r.installmentAmount),
      monthlyRate: Number(r.monthlyRate),
      cft: r.cft == null ? null : Number(r.cft),
      rejectionReason: r.rejectionReason,
      customerName: r.customerName,
      customerCuil: r.customerCuil,
      customerEmail: r.customerEmail,
      merchantName: r.merchantName,
      settlementStatus: r.settlementStatus,
      settlementPayDate: r.settlementPayDate,
    }
  })
}

export async function getOrder(orderId: string) {
  const [o] = await loadOrders({ orderId, limit: 1 })
  return o ?? null
}

/* ------------------------------ Originación ------------------------------ */

async function repaymentHistory(userId: string): Promise<AppRepaymentHistory> {
  const [paid, overdue, completed] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(installment).where(and(eq(installment.userId, userId), eq(installment.status, 'paid'))),
    db.select({ n: sql<number>`count(*)::int` }).from(installment).where(and(eq(installment.userId, userId), eq(installment.status, 'overdue'))),
    db.select({ n: sql<number>`count(*)::int` }).from(loan).where(and(eq(loan.userId, userId), eq(loan.status, 'paid'))),
  ])
  return { paidCount: Number(paid[0]?.n ?? 0), overdueCount: Number(overdue[0]?.n ?? 0), completedLoans: Number(completed[0]?.n ?? 0) }
}

export type OriginateInput = {
  merchantId: string
  /** Cliente: por CUIL (venta en el local) o por usuario (pedido online desde el catálogo). */
  customerCuil?: string
  customerUserId?: string
  items: Array<{ productId: string; quantity: number }>
  term: number
  origin: 'local' | 'online'
  createdBy: string
}

/**
 * Crea la operación y el crédito por el 70% financiado. La mesa decide siempre a mano: el crédito nace
 * 'pending' con el score como recomendación. Topes y KYC se validan acá para no cargar operaciones inviables.
 */
export async function originateMerchantOrder(input: OriginateInput) {
  await ensureMerchantCommerceSchema()
  const [m] = await db.select().from(merchant).where(eq(merchant.id, input.merchantId)).limit(1)
  if (!m) throw new OrderError('Comercio no encontrado.')
  if (m.status !== 'active') throw new OrderError('El comercio todavía no está habilitado por UNICRÉDITOS para vender en cuotas.')
  if (!(await diditApprovedForUser(m.userId))) throw new OrderError('El titular del comercio tiene que tener la identidad verificada (Didit).')

  // Cliente
  let customer: typeof profile.$inferSelect | undefined
  if (input.customerUserId) {
    ;[customer] = await db.select().from(profile).where(eq(profile.userId, input.customerUserId)).limit(1)
  } else {
    const cuil = normalizeCuit(input.customerCuil ?? '')
    if (!isValidCuit(cuil)) throw new OrderError('El CUIL del cliente no es válido. Revisá los 11 dígitos.')
    ;[customer] = await db.select().from(profile).where(eq(profile.cuil, cuil)).limit(1)
    if (!customer) {
      throw new OrderError('Ese CUIL no tiene cuenta en UNICRÉDITOS. Pedile al cliente que se registre en unicreditos.com y verifique su identidad; después cargás la venta.')
    }
  }
  if (!customer) throw new OrderError('Completá tu perfil antes de comprar en cuotas.')
  if (customer.userId === m.userId) throw new OrderError('El titular del comercio no puede financiarse en su propio local.')
  if (!customer.cuil) throw new OrderError('El cliente tiene que tener el CUIL cargado en su perfil.')
  const [kyc] = await db
    .select({ status: kycVerification.status, provider: kycVerification.provider })
    .from(kycVerification)
    .where(eq(kycVerification.userId, customer.userId))
    .limit(1)
  if (kyc?.provider !== 'didit' || kyc.status !== 'approved' || customer.kycStatus !== 'approved') {
    throw new OrderError('El cliente no tiene la identidad verificada (DNI y prueba de vida). Tiene que completarla desde su cuenta antes de financiar.')
  }
  const monthlyIncome = Number(customer.monthlyIncome ?? 0)
  if (monthlyIncome <= 0) throw new OrderError('El cliente tiene que declarar sus ingresos en el perfil.')
  const open = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, customer.userId), inArray(loan.status, [...OPEN_LOAN_STATUSES])))
    .limit(1)
  if (open.length) throw new OrderError('El cliente ya tiene un crédito en curso. Puede tener uno a la vez.')

  // Productos del catálogo (precio vigente del servidor, nunca el del navegador)
  const wanted = input.items.filter((i) => Number(i.quantity) > 0)
  if (!wanted.length) throw new OrderError('Agregá al menos un producto del catálogo.')
  const ids = [...new Set(wanted.map((i) => i.productId))]
  const products = await db
    .select()
    .from(merchantProduct)
    .where(and(eq(merchantProduct.merchantId, m.id), inArray(merchantProduct.id, ids)))
  const byId = new Map(products.map((p) => [p.id, p]))
  const lines = wanted.map((i) => {
    const p = byId.get(i.productId)
    if (!p || !p.active) throw new OrderError('Uno de los productos ya no está disponible en el catálogo.')
    const qty = Math.floor(Number(i.quantity))
    if (qty < 1 || qty > 99) throw new OrderError('Cantidad inválida.')
    if (p.stock != null && p.stock < qty) throw new OrderError(`No hay stock suficiente de "${p.name}" (quedan ${p.stock}).`)
    return { productId: p.id, name: p.name, unitPrice: Number(p.price), quantity: qty }
  })

  const catalog = catalogByType('consumo')
  const [product] = await db.select().from(loanProduct).where(eq(loanProduct.id, catalog.id)).limit(1)
  if (!product?.active) throw new OrderError('El producto de consumo no está activo. Avisá a UNICRÉDITOS.')
  const term = Math.round(Number(input.term))
  if (!Number.isFinite(term) || term < product.minTerm || term > product.maxTerm) {
    throw new OrderError(`El plazo debe estar entre ${product.minTerm} y ${product.maxTerm} cuotas.`)
  }
  const monthlyRate = Number(product.monthlyRate)
  const quote = quoteOrder({ items: lines, term, monthlyRate, commissionRate: Number(m.commissionRate) })
  if (quote.financed < Number(product.minAmount) || quote.financed > Number(product.maxAmount)) {
    throw new OrderError(
      `El monto a financiar (70%) tiene que estar entre $ ${Number(product.minAmount).toLocaleString('es-AR')} y $ ${Number(product.maxAmount).toLocaleString('es-AR')}.`,
    )
  }

  // Evaluación: BCRA + score + tope por ingreso. Es recomendación; decide la mesa.
  const consulted = await persistBcraConsultation({ userId: customer.userId, cuil: customer.cuil, monthlyIncome })
  if (!consulted.ok) throw new OrderError(consulted.error)
  const offer = computeCreditOffer({
    score: consulted.score.score,
    monthlyIncome,
    term,
    monthlyRate,
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    history: await repaymentHistory(customer.userId),
  })
  if (!offer.eligible || quote.financed > offer.maxAmount) {
    throw new OrderError(
      `El cliente puede financiar hasta $ ${offer.maxAmount.toLocaleString('es-AR')} en ${term} cuotas. ${offer.reason}`.trim(),
    )
  }
  const decision = decideUnderwriting({
    score: consulted.score,
    installmentAmount: quote.installmentAmount,
    monthlyIncome,
    worstSituation: consulted.snapshot.deudas.worstSituation,
    rejectedChecksCount: Number(consulted.snapshot.chequesRechazados?.count ?? 0),
  })

  const now = new Date()
  const loanId = newId('loan')
  const orderId = newId('mord')
  const code = newOrderCode()
  const summary = quote.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(', ')
  await db.transaction(async (tx) => {
    await tx.insert(loan).values({
      id: loanId,
      userId: customer!.userId,
      productId: product.id,
      merchantId: m.id,
      type: 'consumo',
      principal: quote.financed.toFixed(2),
      term,
      monthlyRate: String(monthlyRate),
      ...loanPricingFields(computeFrenchAmortization(quote.financed, term, monthlyRate)),
      status: 'pending',
      purpose: `Compra en ${m.businessName} (${code}): ${summary}`.slice(0, 480),
      scoreAtApproval: consulted.score.score,
      rejectionReason: decision.outcome === 'qualified' ? null : decision.reason,
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(merchantOrder).values({
      id: orderId,
      code,
      merchantId: m.id,
      customerUserId: customer!.userId,
      loanId,
      origin: input.origin,
      items: quote.items,
      totalAmount: quote.total.toFixed(2),
      downPaymentRate: DOWN_PAYMENT_RATE.toFixed(4),
      downPaymentAmount: quote.downPayment.toFixed(2),
      financedAmount: quote.financed.toFixed(2),
      commissionRate: Number(m.commissionRate).toFixed(2),
      commissionAmount: quote.commission.toFixed(2),
      netAmount: quote.netToMerchant.toFixed(2),
      deliveryCode: newDeliveryCode(),
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
  })
  return { orderId, loanId, code, quote, customerUserId: customer.userId, merchantName: m.businessName, recommendation: decision }
}

/* ------------------------------ Anticipo ------------------------------ */

/** Acredita el anticipo (tesorería o webhook de Mercado Pago). Idempotente. */
export async function confirmDownPayment(input: {
  orderId: string
  by: string
  method: 'mp_qr' | 'transferencia'
  reference?: string | null
  mpPaymentId?: string | null
  paidAmount?: number | null
}) {
  await ensureMerchantCommerceSchema()
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(merchantOrder).where(eq(merchantOrder.id, input.orderId)).for('update').limit(1)
    if (!o) throw new OrderError('Operación no encontrada.')
    if (o.downPaymentStatus === 'confirmed') return { changed: false, order: o }
    if (o.cancelledAt) throw new OrderError('La operación está anulada: el anticipo se devuelve, no se acredita.')
    if (input.paidAmount != null && input.paidAmount + 0.005 < Number(o.downPaymentAmount)) {
      throw new OrderError(`El pago ($ ${input.paidAmount}) es menor al anticipo ($ ${o.downPaymentAmount}).`)
    }
    const now = new Date()
    const [updated] = await tx
      .update(merchantOrder)
      .set({
        downPaymentStatus: 'confirmed',
        downPaymentMethod: input.method,
        downPaymentReference: input.reference ?? o.downPaymentReference,
        mpPaymentId: input.mpPaymentId ?? o.mpPaymentId,
        downPaidAt: now,
        downPaymentReviewedBy: input.by,
        updatedAt: now,
      })
      .where(eq(merchantOrder.id, o.id))
      .returning()
    return { changed: true, order: updated }
  })
}

export async function rejectDownPayment(input: { orderId: string; by: string; note: string }) {
  await ensureMerchantCommerceSchema()
  const now = new Date()
  const res = await db
    .update(merchantOrder)
    .set({ downPaymentStatus: 'rejected', downPaymentNote: input.note, downPaymentReviewedBy: input.by, updatedAt: now })
    .where(and(eq(merchantOrder.id, input.orderId), eq(merchantOrder.downPaymentStatus, 'reported')))
    .returning({ id: merchantOrder.id })
  if (!res.length) throw new OrderError('Solo se puede rechazar un anticipo informado y no acreditado.')
}

/* ------------------------------ Entrega ------------------------------ */

/**
 * El comercio entrega el producto: valida el código del cliente, activa el crédito (cuotas desde hoy),
 * descuenta stock y suma la operación a la liquidación del viernes que corresponde.
 */
export async function deliverOrder(input: { orderId: string; merchantId: string; code: string; by: string; note?: string }) {
  await ensureMerchantCommerceSchema()
  const code = String(input.code ?? '').replace(/\D/g, '')
  const order = await getOrder(input.orderId)
  if (!order || order.merchantId !== input.merchantId) throw new OrderError('Operación no encontrada.')
  if (order.stage !== 'lista_para_entregar') {
    throw new OrderError(
      order.stage === 'entregada' || order.stage === 'liquidada'
        ? 'Esta operación ya figura entregada.'
        : 'Todavía no se puede entregar: el crédito tiene que estar aprobado, el contrato firmado y el anticipo acreditado.',
    )
  }
  if (code.length !== 6 || code !== order.deliveryCode) throw new OrderError('El código de entrega no coincide. Pedile al cliente el código que ve en su cuenta.')

  const now = new Date()
  const payDate = settlementDateFor(now)
  let effectivePayDate = payDate
  await db.transaction(async (tx) => {
    const [fresh] = await tx.select().from(merchantOrder).where(eq(merchantOrder.id, order.id)).for('update').limit(1)
    if (!fresh || fresh.deliveredAt || fresh.cancelledAt) throw new OrderError('La operación cambió. Recargá la página.')
    const [l] = await tx.select().from(loan).where(eq(loan.id, order.loanId)).limit(1)
    if (!l || !canTransition(l.status, 'active')) throw new OrderError('El crédito no está en condiciones de activarse.')
    await activateLoanAfterDisbursement(tx, {
      loanId: l.id,
      userId: l.userId,
      principal: Number(l.principal),
      term: l.term,
      monthlyRate: Number(l.monthlyRate),
      now,
    })
    for (const item of fresh.items) {
      await tx
        .update(merchantProduct)
        .set({ stock: sql`greatest(${merchantProduct.stock} - ${item.quantity}, 0)`, updatedAt: now })
        .where(and(eq(merchantProduct.id, item.productId), sql`${merchantProduct.stock} is not null`))
    }
    const settlementId = await upsertScheduledSettlement(tx, fresh.merchantId, payDate, now)
    await tx
      .update(merchantOrder)
      .set({ deliveredAt: now, deliveredBy: input.by, deliveryNote: input.note?.trim() || null, settlementId, updatedAt: now })
      .where(eq(merchantOrder.id, fresh.id))
    await recomputeSettlement(tx, settlementId)
    const [lot] = await tx.select({ payDate: merchantSettlement.payDate }).from(merchantSettlement).where(eq(merchantSettlement.id, settlementId)).limit(1)
    effectivePayDate = lot?.payDate ?? payDate
  })
  return { payDate: effectivePayDate }
}

/* ------------------------------ Anulación ------------------------------ */

/**
 * Anula una operación no entregada. Si el anticipo ya está acreditado solo puede anularla UNICRÉDITOS
 * (hay que devolver el dinero al cliente y dejarlo registrado).
 */
export async function cancelOrder(input: { orderId: string; by: string; reason: string; asAdmin: boolean; merchantId?: string }) {
  await ensureMerchantCommerceSchema()
  const reason = input.reason.trim()
  if (reason.length < 5) throw new OrderError('Contá el motivo de la anulación.')
  const order = await getOrder(input.orderId)
  if (!order || (input.merchantId && order.merchantId !== input.merchantId)) throw new OrderError('Operación no encontrada.')
  if (order.deliveredAt) throw new OrderError('La operación ya se entregó: no se anula, se gestiona como devolución con UNICRÉDITOS.')
  if (order.cancelledAt) return
  if (order.downPaymentStatus === 'confirmed' && !input.asAdmin) {
    throw new OrderError('El cliente ya pagó el anticipo. Pedí la anulación a UNICRÉDITOS para que se le devuelva.')
  }
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(merchantOrder)
      .set({ cancelledAt: now, cancelledBy: input.by, cancelReason: reason, updatedAt: now })
      .where(and(eq(merchantOrder.id, order.id), isNull(merchantOrder.deliveredAt)))
    const [l] = await tx.select({ status: loan.status }).from(loan).where(eq(loan.id, order.loanId)).limit(1)
    if (l && canTransition(l.status, 'cancelled') && l.status !== 'cancelled') {
      await tx.update(loan).set({ status: 'cancelled', rejectionReason: `Venta anulada: ${reason}`, updatedAt: now }).where(eq(loan.id, order.loanId))
    }
  })
}

/* ------------------------------ Liquidaciones ------------------------------ */

function settlementCode(payDate: string) {
  return `LIQ-${payDate.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

/**
 * Lote programado del comercio para esa fecha. Si tesorería ya pagó el de esa fecha (pago anticipado), la venta
 * pasa al viernes siguiente: un lote pagado nunca se modifica.
 */
async function upsertScheduledSettlement(tx: Tx, merchantId: string, payDate: string, now: Date) {
  let date = payDate
  for (let i = 0; i < 8; i++) {
    const [existing] = await tx
      .select({ id: merchantSettlement.id, status: merchantSettlement.status })
      .from(merchantSettlement)
      .where(and(eq(merchantSettlement.merchantId, merchantId), eq(merchantSettlement.payDate, date)))
      .for('update')
      .limit(1)
    if (!existing) break
    if (existing.status === 'scheduled') return existing.id
    date = settlementDateFor(new Date(`${date}T15:00:00Z`))
  }
  const [payout] = await tx.select().from(merchantPayoutAccount).where(eq(merchantPayoutAccount.merchantId, merchantId)).limit(1)
  const id = newId('mliq')
  await tx.insert(merchantSettlement).values({
    id,
    code: settlementCode(date),
    merchantId,
    payDate: date,
    status: 'scheduled',
    payoutCbu: payout?.cbu ?? null,
    payoutHolder: payout?.holder ?? null,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

/** Los totales del lote siempre se recalculan desde sus operaciones (nunca se acumulan a mano). */
async function recomputeSettlement(tx: Tx, settlementId: string) {
  const [agg] = await tx
    .select({
      n: sql<number>`count(*)::int`,
      gross: sql<string>`coalesce(sum(${merchantOrder.totalAmount}),0)`,
      down: sql<string>`coalesce(sum(${merchantOrder.downPaymentAmount}),0)`,
      financed: sql<string>`coalesce(sum(${merchantOrder.financedAmount}),0)`,
      commission: sql<string>`coalesce(sum(${merchantOrder.commissionAmount}),0)`,
      net: sql<string>`coalesce(sum(${merchantOrder.netAmount}),0)`,
    })
    .from(merchantOrder)
    .where(eq(merchantOrder.settlementId, settlementId))
  await tx
    .update(merchantSettlement)
    .set({
      orderCount: Number(agg?.n ?? 0),
      grossAmount: String(agg?.gross ?? 0),
      downPaymentsAmount: String(agg?.down ?? 0),
      financedAmount: String(agg?.financed ?? 0),
      commissionAmount: String(agg?.commission ?? 0),
      netAmount: String(agg?.net ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(merchantSettlement.id, settlementId))
}

export async function listSettlements(where: { merchantId?: string; status?: 'scheduled' | 'paid'; limit?: number }) {
  await ensureMerchantCommerceSchema()
  const conds = []
  if (where.merchantId) conds.push(eq(merchantSettlement.merchantId, where.merchantId))
  if (where.status) conds.push(eq(merchantSettlement.status, where.status))
  return db
    .select({
      s: merchantSettlement,
      merchantName: merchant.businessName,
      merchantCuit: merchant.cuit,
      payoutCbu: merchantPayoutAccount.cbu,
      payoutAlias: merchantPayoutAccount.alias,
      payoutHolder: merchantPayoutAccount.holder,
      payoutBank: merchantPayoutAccount.bankName,
    })
    .from(merchantSettlement)
    .innerJoin(merchant, eq(merchant.id, merchantSettlement.merchantId))
    .leftJoin(merchantPayoutAccount, eq(merchantPayoutAccount.merchantId, merchantSettlement.merchantId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(merchantSettlement.payDate))
    .limit(where.limit ?? 200)
}

export async function markSettlementPaid(input: { settlementId: string; by: string; transferReference: string; notes?: string }) {
  await ensureMerchantCommerceSchema()
  const ref = input.transferReference.trim()
  if (ref.length < 4) throw new OrderError('Cargá el número de operación de la transferencia.')
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(merchantSettlement).where(eq(merchantSettlement.id, input.settlementId)).for('update').limit(1)
    if (!s) throw new OrderError('Liquidación no encontrada.')
    if (s.status === 'paid') return s
    if (Number(s.netAmount) <= 0) throw new OrderError('El lote no tiene importe a pagar.')
    const [payout] = await tx.select().from(merchantPayoutAccount).where(eq(merchantPayoutAccount.merchantId, s.merchantId)).limit(1)
    if (!payout) throw new OrderError('El comercio no cargó su cuenta de cobro (CBU/CVU).')
    const now = new Date()
    const [paid] = await tx
      .update(merchantSettlement)
      .set({
        status: 'paid',
        transferReference: ref,
        notes: input.notes?.trim() || null,
        payoutCbu: payout.cbu,
        payoutHolder: payout.holder,
        paidAt: now,
        paidBy: input.by,
        updatedAt: now,
      })
      .where(and(eq(merchantSettlement.id, s.id), eq(merchantSettlement.status, 'scheduled')))
      .returning()
    return paid ?? s
  })
}

/* ------------------------------ Catálogo ------------------------------ */

export async function listProducts(merchantId: string, opts?: { onlyActive?: boolean }) {
  await ensureMerchantCommerceSchema()
  const conds = [eq(merchantProduct.merchantId, merchantId)]
  if (opts?.onlyActive) conds.push(eq(merchantProduct.active, true))
  return db.select().from(merchantProduct).where(and(...conds)).orderBy(desc(merchantProduct.active), merchantProduct.name)
}

export async function getPayoutAccount(merchantId: string) {
  await ensureMerchantCommerceSchema()
  const [row] = await db.select().from(merchantPayoutAccount).where(eq(merchantPayoutAccount.merchantId, merchantId)).limit(1)
  return row ?? null
}
