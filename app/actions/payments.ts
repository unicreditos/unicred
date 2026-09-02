'use server'

import { db } from '@/lib/db'
import {
  payment,
  installment,
  loan,
  paymentReceipt,
  savedPaymentMethod,
  profile,
  user as userTable,
} from '@/lib/db/schema'
import { assertRole, getSession, assertAdmin, getRoleForUser, requireUserId } from '@/lib/session'
import { canActivateOnCollection, canSettleOnCollection } from '@/lib/loan-state'
import { canViewOwnedRecord } from '@/lib/legal/access'
import { receiptBranding } from '@/lib/brand'
import { couponCode } from '@/lib/coupon'
import { treasuryForClient } from '@/lib/treasury'
import { recordAudit } from '@/lib/audit'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'
import { notifyPaymentReceived, notifyPaymentRejected } from '@/lib/notify-email'
import { and, eq, sql, desc, inArray, gte } from 'drizzle-orm'
import { sameInstallmentSet } from '@/lib/payments/settle-mp'
import { createPaymentLinkMP, ensureMercadoPagoCustomer, getMercadoPagoPublicKey, getSiteBaseUrl, MP_CONFIG, type MPPaymentChannel } from '@/lib/mercadopago'
import { attachMercadoPagoQr, qrDataFromGateway } from '@/lib/payments/installment-mp-qr'
import { computeEarlySettlement } from '@/lib/legal/settlement'
import { isPaywayConfigured, isPaywayMethod, lookupPaywayBin, paywayAllowsSimulate } from '@/lib/payway'
import { openPaywayCheckout } from '@/lib/payments/payway-checkout'
import { settlePaywayPayment } from '@/lib/payments/settle-payway'

export type PaymentMethod =
  | 'mercado_pago'
  | 'transferencia_bancaria'
  | 'debito_automatico'
  | 'efectivo'
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'link_pago'
  | 'mercadopago_wallet'
  | 'cvu'
  | 'pago_facil'
  | 'rapipago'
  | 'ticket'
  | 'transferencia_rm'
  | 'payway_qr'
  | 'payway_wallet'
  | 'payway_card'

const MP_CHANNELS: Record<string, MPPaymentChannel> = {
  mercado_pago: 'all',
  link_pago: 'all',
  ticket: 'ticket',
  efectivo: 'ticket',
  pago_facil: 'pago_facil',
  rapipago: 'rapipago',
  tarjeta_credito: 'credit_card',
  tarjeta_debito: 'debit_card',
  mercadopago_wallet: 'account_money',
  cvu: 'account_money',
}

function usesMercadoPagoCheckout(method: PaymentMethod) {
  return method in MP_CHANNELS
}

function usesPaywayCheckout(method: PaymentMethod) {
  return isPaywayMethod(method)
}

export async function getMyPayments(limit = 50) {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(desc(payment.createdAt))
    .limit(limit)
}

export async function getPaymentsForLoan(loanId: string) {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(payment)
    .where(and(eq(payment.loanId, loanId), eq(payment.userId, userId)))
    .orderBy(desc(payment.createdAt))
}

export async function getSavedPaymentMethods() {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(savedPaymentMethod)
    .where(and(eq(savedPaymentMethod.userId, userId), eq(savedPaymentMethod.isActive, true)))
    .orderBy(eq(savedPaymentMethod.isDefault, false))
}

export async function createPaymentLink(
  installmentIds: string[],
  method: PaymentMethod,
  opts?: { returnPath?: string },
) {
  const userId = await assertRole('customer')
  if (!installmentIds.length) throw new Error('Elegí al menos una cuota')

  const session = await getSession()
  const insts = await db
    .select()
    .from(installment)
    .where(
      and(inArray(installment.id, installmentIds), eq(installment.userId, userId)),
    )

  if (insts.length !== installmentIds.length) {
    throw new Error('Cuota(s) no encontrada(s)')
  }
  if (insts.some((i) => i.status === 'paid')) {
    throw new Error('Alguna de las cuotas seleccionadas ya está pagada.')
  }

  const loanId = insts[0].loanId
  if (insts.some((i) => i.loanId !== loanId)) {
    throw new Error('Las cuotas deben pertenecer a un mismo crédito.')
  }

  const [loanRow] = await db
    .select({ status: loan.status })
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow) throw new Error('Crédito no encontrado')
  if (loanRow.status !== 'active') {
    throw new Error('Solo podés pagar cuotas de un crédito vigente (después del desembolso).')
  }

  const total = insts.reduce(
    (acc, i) => acc + (typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount) || 0),
    0,
  )
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Importe a pagar inválido.')
  }

  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const payerFullName = session?.user?.name ?? null
  const payerFirst = payerFullName?.split(' ')[0] ?? undefined
  const payerLast = payerFullName?.split(' ').slice(1).join(' ') || undefined

  const existing = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.loanId, loanId),
        eq(payment.gateway, 'mercado_pago'),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(12)

  const reusable = existing.find((row) => {
    if (row.method !== method) return false
    if (!row.paymentLinkId || !row.paymentLinkUrl) return false
    return sameInstallmentSet((row.gatewayResponse as { installment_ids?: unknown } | null)?.installment_ids, installmentIds)
  })
  if (reusable) {
    let qrData = qrDataFromGateway(reusable.gatewayResponse)
    if (!qrData && insts.length === 1) {
      try {
        const qr = await attachMercadoPagoQr({
          paymentId: reusable.id,
          amount: total,
          title: `UNICRÉDITOS · Cuota #${insts[0].number}`,
          description: `Pago cuota ${insts[0].number} · UNICRÉDITOS`,
          installmentIds,
          dueDate: insts[0].dueDate,
        })
        qrData = qr.qrData
      } catch (err) {
        console.error('[payments] QR Mercado Pago (reuso):', err)
      }
    }
    const vault = session?.user?.email ? await ensureMercadoPagoCustomer(session.user.email).catch(() => null) : null
    return {
      ok: true,
      paymentId: reusable.id,
      paymentLinkUrl: reusable.paymentLinkUrl,
      gateway: reusable.gateway,
      externalPreferenceId: reusable.paymentLinkId,
      publicKey: getMercadoPagoPublicKey(),
      amount: total,
      qrData,
      mpCustomerId: vault?.id ?? null,
      mpCardIds: vault?.cardIds ?? [],
      coupon:
        insts.length === 1
          ? couponCode({
              loanId,
              number: insts[0].number,
              dueDate: insts[0].dueDate,
              amount: insts[0].amount,
            })
          : null,
    }
  }

  const id = crypto.randomUUID()
  const linkId = `pay-${id.slice(0, 12)}`
  const internalRef = `LKP-${Date.now().toString().slice(-8)}`

  if (method === 'debito_automatico') {
    throw new Error(
      'El débito automático aún no está habilitado. Pagá con Mercado Pago, Payway, tarjeta, Pago Fácil, Rapipago o transferencia a RM.',
    )
  }

  if (method === 'transferencia_bancaria' || method === 'transferencia_rm') {
    throw new Error('Para transferir a RM usá el formulario de transferencia con comprobante.')
  }

  if (usesPaywayCheckout(method)) {
    const payway = await openPaywayCheckout({
      userId,
      loanId,
      installmentIds,
      method,
      amount: total,
      source: 'web',
      firstInstallmentId: insts[0].id,
      firstDueDate: insts[0].dueDate,
      coupon:
        insts.length === 1
          ? { loanId, number: insts[0].number, dueDate: insts[0].dueDate, amount: insts[0].amount }
          : undefined,
    })
    revalidateCustomer()
    return payway
  }

  if (!usesMercadoPagoCheckout(method)) {
    throw new Error('Método de pago no disponible. Elegí Mercado Pago, Payway, tarjeta, Pago Fácil o Rapipago.')
  }

  if (!MP_CONFIG.accessTokenSet) {
    throw new Error(
      'Mercado Pago no está configurado en este entorno. Pedile a soporte que cargue el Access Token TEST.',
    )
  }

  let mpPreferenceId: string | null = null
  let mpInitPoint: string | null = null
  let mpGatewayResponse: any = null
  let finalGateway: string | null = null
  let vault: Awaited<ReturnType<typeof ensureMercadoPagoCustomer>> = null

  try {
    const returnPath = opts?.returnPath?.trim().replace(/\/$/, '')
    const siteBase = getSiteBaseUrl()
    const res = await createPaymentLinkMP({
      amount: total,
      installmentsIds: installmentIds,
      loanId,
      userId,
      externalReference: internalRef,
      description: insts.length > 1
        ? `Pago de ${insts.length} cuotas · Préstamo ${loanId?.slice(0, 8) ?? ''}`
        : `Pago cuota ${insts[0].number} · Préstamo ${loanId?.slice(0, 8) ?? ''}`,
      itemsTitle: `UNICRÉDITOS · Cuota${insts.length > 1 ? 's' : ''} ${insts.map((i) => '#' + i.number).join(',')}`,
      payerEmail: session?.user?.email ?? undefined,
      payerFirstName: payerFirst,
      payerLastName: payerLast,
      payerIdentificationType: prof?.cuil ? 'CUIL' : undefined,
      payerIdentificationNumber: prof?.cuil ?? undefined,
      channel: MP_CHANNELS[method] ?? 'all',
      ...(returnPath
        ? {
            successUrl: `${siteBase}${returnPath}?mp_status=success`,
            failureUrl: `${siteBase}${returnPath}?mp_status=failure`,
            pendingUrl: `${siteBase}${returnPath}?mp_status=pending`,
          }
        : {}),
    })
    mpPreferenceId = res.preferenceId
    mpInitPoint = res.initPoint
    finalGateway = 'mercado_pago'
    const nextVault = session?.user?.email ? await ensureMercadoPagoCustomer(session.user.email).catch(() => null) : null
    vault = nextVault
    mpGatewayResponse = {
      preference_id: res.preferenceId,
      init_point: res.initPoint,
      sandbox_init_point: res.sandboxInitPoint,
      external_reference: res.externalReference,
      channel: MP_CHANNELS[method] ?? 'all',
      installment_ids: installmentIds,
      mp_customer_id: nextVault?.id ?? null,
    }
  } catch (err: any) {
    console.error('[payments] MP createPaymentLink error:', err?.message ?? err)
    throw new Error(err?.message ?? 'No se pudo crear el link de Mercado Pago.')
  }

  if (!mpInitPoint || !/^https?:\/\//i.test(mpInitPoint)) {
    throw new Error('Mercado Pago no devolvió un link de pago válido.')
  }

  const [pay] = await db
    .insert(payment)
    .values({
      id,
      userId,
      loanId,
      installmentId: insts[0].id,
      amount: String(total),
      currency: 'ARS',
      status: 'pending',
      method,
      source: 'web',
      gateway: finalGateway,
      gatewayResponse: mpGatewayResponse,
      externalId: mpPreferenceId ?? null,
      paymentLinkId: mpPreferenceId ?? linkId,
      paymentLinkUrl: mpInitPoint,
      referenceNumber: (mpGatewayResponse as any)?.external_reference ?? internalRef,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning()

  let qrData: string | null = null
  if (insts.length === 1) {
    try {
      const qr = await attachMercadoPagoQr({
        paymentId: pay.id,
        amount: total,
        title: `UNICRÉDITOS · Cuota #${insts[0].number}`,
        description: `Pago cuota ${insts[0].number} · UNICRÉDITOS`,
        installmentIds,
        dueDate: insts[0].dueDate,
      })
      qrData = qr.qrData
    } catch (err) {
      console.error('[payments] QR Mercado Pago:', err)
    }
  }

  revalidateCustomer()
  return {
    ok: true,
    paymentId: pay.id,
    paymentLinkUrl: pay.paymentLinkUrl,
    gateway: finalGateway,
    externalPreferenceId: mpPreferenceId,
    publicKey: getMercadoPagoPublicKey(),
    amount: total,
    qrData,
    mpCustomerId: vault?.id ?? null,
    mpCardIds: vault?.cardIds ?? [],
    coupon:
      insts.length === 1
        ? couponCode({
            loanId,
            number: insts[0].number,
            dueDate: insts[0].dueDate,
            amount: insts[0].amount,
          })
        : null,
  }
}

export async function getCouponInstallment(installmentId: string) {
  const id = String(installmentId ?? '').trim()
  if (!id) return null
  const [row] = await db
    .select({
      id: installment.id,
      number: installment.number,
      amount: installment.amount,
      dueDate: installment.dueDate,
      status: installment.status,
      paidAt: installment.paidAt,
      loanId: installment.loanId,
      userId: installment.userId,
    })
    .from(installment)
    .where(eq(installment.id, id))
    .limit(1)
  if (!row) return null
  const due = new Date(row.dueDate)
  const [loanRow] = await db
    .select({ status: loan.status, principal: loan.principal, term: loan.term })
    .from(loan)
    .where(eq(loan.id, row.loanId))
    .limit(1)
  return {
    id: row.id,
    number: row.number,
    amount: row.amount,
    dueDate: due.toISOString(),
    dueLabel: new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(due),
    status: row.status,
    paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
    paidLabel: row.paidAt
      ? new Intl.DateTimeFormat('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Argentina/Buenos_Aires',
        }).format(new Date(row.paidAt))
      : null,
    loanId: row.loanId,
    loanStatus: loanRow?.status ?? null,
    coupon: couponCode({
      loanId: row.loanId,
      number: row.number,
      dueDate: row.dueDate,
      amount: row.amount,
    }),
    treasury: treasuryForClient(),
  }
}

export async function createCouponCheckout(
  installmentId: string,
  method: PaymentMethod = 'mercado_pago',
) {
  if (method === 'debito_automatico') {
    throw new Error('El débito automático no está habilitado.')
  }
  if (method === 'transferencia_bancaria' || method === 'transferencia_rm') {
    throw new Error('Para transferir usá el CBU de RM que figura en esta página.')
  }
  if (!usesMercadoPagoCheckout(method) && !usesPaywayCheckout(method)) {
    throw new Error('Elegí Mercado Pago, Payway, tarjeta, Pago Fácil o Rapipago.')
  }

  const [inst] = await db.select().from(installment).where(eq(installment.id, installmentId)).limit(1)
  if (!inst) throw new Error('Cuota no encontrada.')
  if (inst.status === 'paid' || inst.status === 'cancelled') {
    throw new Error('Esta cuota ya no está abierta.')
  }
  const userId = inst.userId
  const loanId = inst.loanId
  const [loanRow] = await db
    .select({ status: loan.status })
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow || loanRow.status !== 'active') {
    throw new Error('Solo se puede pagar un crédito vigente, después del desembolso.')
  }

  const total = Number(inst.amount) || 0
  if (!Number.isFinite(total) || total <= 0) throw new Error('Importe inválido.')

  if (usesPaywayCheckout(method)) {
    return openPaywayCheckout({
      userId,
      loanId,
      installmentIds: [inst.id],
      method,
      amount: total,
      source: 'coupon',
      firstInstallmentId: inst.id,
      firstDueDate: inst.dueDate,
      coupon: { loanId, number: inst.number, dueDate: inst.dueDate, amount: inst.amount },
    })
  }

  if (!MP_CONFIG.accessTokenSet) {
    throw new Error('Mercado Pago no está configurado en este entorno.')
  }

  const [payer] = await db
    .select({ email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const payerFirst = payer?.name?.split(' ')[0]
  const payerLast = payer?.name?.split(' ').slice(1).join(' ') || undefined

  const existing = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.loanId, loanId),
        eq(payment.gateway, 'mercado_pago'),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(12)

  const reusable = existing.find((row) => {
    if (row.method !== method) return false
    if (!row.paymentLinkId || !row.paymentLinkUrl) return false
    return sameInstallmentSet((row.gatewayResponse as { installment_ids?: unknown } | null)?.installment_ids, [
      inst.id,
    ])
  })
  if (reusable) {
    let qrData = qrDataFromGateway(reusable.gatewayResponse)
    if (!qrData) {
      try {
        const qr = await attachMercadoPagoQr({
          paymentId: reusable.id,
          amount: total,
          title: `UNICRÉDITOS · Cuota #${inst.number}`,
          description: `Pago cuota ${inst.number} · UNICRÉDITOS`,
          installmentIds: [inst.id],
          dueDate: inst.dueDate,
        })
        qrData = qr.qrData
      } catch (err) {
        console.error('[payments] QR cupón (reuso):', err)
        throw new Error(
          err instanceof Error
            ? err.message
            : 'Mercado Pago no emitió un QR de pago válido para esta cuota.',
        )
      }
    }
    if (!qrData) {
      throw new Error('Mercado Pago no emitió un QR de pago válido para esta cuota.')
    }
    return {
      ok: true as const,
      paymentId: reusable.id,
      paymentLinkUrl: reusable.paymentLinkUrl,
      gateway: reusable.gateway,
      externalPreferenceId: reusable.paymentLinkId,
      publicKey: getMercadoPagoPublicKey(),
      amount: total,
      qrData,
      coupon: couponCode({
        loanId,
        number: inst.number,
        dueDate: inst.dueDate,
        amount: inst.amount,
      }),
    }
  }

  const id = crypto.randomUUID()
  const internalRef = `CUP-${Date.now().toString().slice(-8)}`
  const siteBase = getSiteBaseUrl()
  const returnPath = `/pagar/${inst.id}`
  const res = await createPaymentLinkMP({
    amount: total,
    installmentsIds: [inst.id],
    loanId,
    userId,
    externalReference: internalRef,
    description: `Pago cuota ${inst.number} · Préstamo ${loanId.slice(0, 8)}`,
    itemsTitle: `UNICRÉDITOS · Cuota #${inst.number}`,
    payerEmail: payer?.email ?? undefined,
    payerFirstName: payerFirst,
    payerLastName: payerLast,
    payerIdentificationType: prof?.cuil ? 'CUIL' : undefined,
    payerIdentificationNumber: prof?.cuil ?? undefined,
    channel: MP_CHANNELS[method] ?? 'all',
    successUrl: `${siteBase}${returnPath}?mp_status=success`,
    failureUrl: `${siteBase}${returnPath}?mp_status=failure`,
    pendingUrl: `${siteBase}${returnPath}?mp_status=pending`,
  })
  if (!res.initPoint || !/^https?:\/\//i.test(res.initPoint)) {
    throw new Error('Mercado Pago no devolvió un link de pago válido.')
  }

  const [pay] = await db
    .insert(payment)
    .values({
      id,
      userId,
      loanId,
      installmentId: inst.id,
      amount: String(total),
      currency: 'ARS',
      status: 'pending',
      method,
      source: 'coupon',
      gateway: 'mercado_pago',
      gatewayResponse: {
        preference_id: res.preferenceId,
        init_point: res.initPoint,
        sandbox_init_point: res.sandboxInitPoint,
        external_reference: res.externalReference,
        channel: MP_CHANNELS[method] ?? 'all',
        installment_ids: [inst.id],
        kind: 'coupon',
      },
      externalId: res.preferenceId,
      paymentLinkId: res.preferenceId,
      paymentLinkUrl: res.initPoint,
      referenceNumber: res.externalReference,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning()

  let qrData: string | null = qrDataFromGateway(pay.gatewayResponse)
  if (!qrData) {
    try {
      const qr = await attachMercadoPagoQr({
        paymentId: pay.id,
        amount: total,
        title: `UNICRÉDITOS · Cuota #${inst.number}`,
        description: `Pago cuota ${inst.number} · UNICRÉDITOS`,
        installmentIds: [inst.id],
        dueDate: inst.dueDate,
      })
      qrData = qr.qrData
    } catch (err) {
      console.error('[payments] QR cupón:', err)
      throw new Error(
        err instanceof Error
          ? err.message
          : 'Mercado Pago no emitió un QR de pago válido para esta cuota.',
      )
    }
  }

  return {
    ok: true as const,
    paymentId: pay.id,
    paymentLinkUrl: pay.paymentLinkUrl,
    gateway: 'mercado_pago',
    externalPreferenceId: res.preferenceId,
    publicKey: getMercadoPagoPublicKey(),
    amount: total,
    qrData,
    coupon: couponCode({
      loanId,
      number: inst.number,
      dueDate: inst.dueDate,
      amount: inst.amount,
    }),
  }
}

export async function getLoanCouponQrs(loanId: string) {
  const userId = await requireUserId()
  const id = String(loanId ?? '').trim()
  if (!id) throw new Error('Crédito inválido.')
  const [loanRow] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, id)).limit(1)
  if (!loanRow || !(await canViewOwnedRecord(userId, loanRow.userId))) {
    throw new Error('No podés ver la cuponera de este crédito.')
  }
  // No pre-emitir QR ni cupones de Pago Fácil/Rapipago: vencen y solo se
  // generan cuando el cliente elige ese medio al pagar la cuota.
  return { qrs: {}, tickets: {} }
}

export async function reportCouponTransfer(installmentId: string, formData: FormData) {
  return reportBankTransfer([installmentId], formData)
}

export async function quoteEarlySettlement(loanId: string) {
  const userId = await assertRole('customer')
  const [loanRow] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!loanRow) throw new Error('Crédito no encontrado')

  const insts = await db
    .select()
    .from(installment)
    .where(and(eq(installment.loanId, loanId), eq(installment.userId, userId)))
    .orderBy(installment.number)

  const unpaid = insts.filter((row) => row.status !== 'paid' && row.status !== 'cancelled')
  const paidCount = insts.filter((row) => row.status === 'paid').length
  const settlement = computeEarlySettlement({
    principal: Number(loanRow.principal) || 0,
    monthlyRate: Number(loanRow.monthlyRate) || 0,
    term: loanRow.term,
    paidCount,
    unpaidAmounts: unpaid.map((row) => Number(row.amount) || 0),
  })

  return {
    ok: true as const,
    loanId: loanRow.id,
    loanStatus: loanRow.status,
    ...settlement,
    unpaidIds: unpaid.map((row) => row.id),
  }
}

export async function createEarlySettlementCheckout(loanId: string) {
  const userId = await assertRole('customer')
  const session = await getSession()
  const quote = await quoteEarlySettlement(loanId)
  if (quote.loanStatus !== 'active') {
    throw new Error('Solo se puede cancelar un crédito vigente, después del desembolso.')
  }
  if (!quote.unpaidIds.length || quote.settlementAmount <= 0) {
    throw new Error('Este crédito no tiene saldo de capital para cancelar.')
  }

  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const payerFullName = session?.user?.name ?? null
  const payerFirst = payerFullName?.split(' ')[0] ?? undefined
  const payerLast = payerFullName?.split(' ').slice(1).join(' ') || undefined

  const existing = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.userId, userId),
        eq(payment.loanId, loanId),
        eq(payment.gateway, 'mercado_pago'),
        inArray(payment.status, ['pending', 'processing']),
        gte(payment.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(8)

  const reusable = existing.find((row) => {
    const g = (row.gatewayResponse as { kind?: unknown; settlementAmount?: unknown } | null) ?? {}
    if (g.kind !== 'early_settlement') return false
    if (!row.paymentLinkId || !row.paymentLinkUrl) return false
    return Math.abs(Number(g.settlementAmount ?? row.amount) - quote.settlementAmount) < 0.02
  })
  if (reusable) {
    return {
      ok: true as const,
      paymentId: reusable.id,
      paymentLinkUrl: reusable.paymentLinkUrl,
      gateway: reusable.gateway,
      externalPreferenceId: reusable.paymentLinkId,
      publicKey: getMercadoPagoPublicKey(),
      amount: quote.settlementAmount,
    }
  }

  if (!MP_CONFIG.accessTokenSet) {
    throw new Error(
      'Mercado Pago no está configurado en este entorno. Pedile a soporte que cargue el Access Token.',
    )
  }

  const id = crypto.randomUUID()
  const internalRef = `CAN-${Date.now().toString().slice(-8)}`
  const siteBase = getSiteBaseUrl()
  const res = await createPaymentLinkMP({
    amount: quote.settlementAmount,
    installmentsIds: quote.unpaidIds,
    loanId,
    userId,
    externalReference: internalRef,
    description: `Cancelación anticipada · Crédito ${loanId.slice(0, 8)}`,
    itemsTitle: 'UNICRÉDITOS · Cancelación anticipada',
    payerEmail: session?.user?.email ?? undefined,
    payerFirstName: payerFirst,
    payerLastName: payerLast,
    payerIdentificationType: prof?.cuil ? 'CUIL' : undefined,
    payerIdentificationNumber: prof?.cuil ?? undefined,
    channel: 'all',
    kind: 'early_settlement',
    successUrl: `${siteBase}/dashboard?tab=cuotas&mp_status=success`,
    failureUrl: `${siteBase}/dashboard?tab=cuotas&mp_status=failure`,
    pendingUrl: `${siteBase}/dashboard?tab=cuotas&mp_status=pending`,
  })

  if (!res.initPoint || !/^https?:\/\//i.test(res.initPoint)) {
    throw new Error('Mercado Pago no devolvió un link de pago válido.')
  }

  const [pay] = await db
    .insert(payment)
    .values({
      id,
      userId,
      loanId,
      installmentId: quote.unpaidIds[0] ?? null,
      amount: String(quote.settlementAmount),
      currency: 'ARS',
      status: 'pending',
      method: 'mercado_pago',
      source: 'web',
      gateway: 'mercado_pago',
      gatewayResponse: {
        kind: 'early_settlement',
        loanId,
        settlementAmount: quote.settlementAmount,
        remainingCapital: quote.remainingCapital,
        contractualRemaining: quote.contractualRemaining,
        interestDeduction: quote.interestDeduction,
        preference_id: res.preferenceId,
        init_point: res.initPoint,
        sandbox_init_point: res.sandboxInitPoint,
        external_reference: res.externalReference,
        installment_ids: quote.unpaidIds,
      },
      externalId: res.preferenceId,
      paymentLinkId: res.preferenceId,
      paymentLinkUrl: res.initPoint,
      referenceNumber: res.externalReference,
      notes: 'Cancelación anticipada (capital remanente).',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning()

  revalidateCustomer()
  return {
    ok: true as const,
    paymentId: pay.id,
    paymentLinkUrl: pay.paymentLinkUrl,
    gateway: 'mercado_pago',
    externalPreferenceId: res.preferenceId,
    publicKey: getMercadoPagoPublicKey(),
    amount: quote.settlementAmount,
  }
}

export async function applyPaymentToInstallment(
  paymentId: string,
  installmentId: string,
  amountPaid: string | number,
  externalRef?: string,
  opts?: { notify?: boolean },
) {
  await assertAdmin()

  const [inst] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, installmentId))
    .limit(1)
  if (!inst) throw new Error('Cuota no encontrada')
  if (inst.status === 'paid') throw new Error('La cuota ya está pagada')

  const ownerId = inst.userId

  const instAmount = typeof inst.amount === 'number' ? inst.amount : parseFloat(String(inst.amount)) || 0
  const payAmountNum = typeof amountPaid === 'number' ? amountPaid : parseFloat(String(amountPaid)) || 0
  if (!Number.isFinite(instAmount) || instAmount <= 0) {
    throw new Error('Monto de cuota inválido')
  }
  if (!Number.isFinite(payAmountNum) || payAmountNum <= 0) {
    throw new Error('Monto abonado inválido: debe ser mayor a cero')
  }
  if (payAmountNum < instAmount - 0.01) {
    throw new Error(
      `Monto insuficiente: $${payAmountNum.toFixed(2)} es menor a la cuota $${instAmount.toFixed(2)}`,
    )
  }

  const payAmount = String(amountPaid)

  const loanRows = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, inst.loanId), eq(loan.userId, ownerId)))
    .limit(1)
  const loanObj = loanRows[0]
  if (!loanObj) throw new Error('Préstamo no encontrado')

  const allInstallments = await db
    .select()
    .from(installment)
    .where(eq(installment.loanId, inst.loanId))

  const principalTotal = allInstallments.reduce(
    (acc, i) =>
      acc + (typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount) || 0),
    0,
  )

  const receiptId = crypto.randomUUID()
  const receiptNumber = `REC-${Date.now().toString().slice(-8)}-${String(inst.number).padStart(2, '0')}`
  const now = new Date()

  let updatedPaymentRows: any[] = []

  await db.transaction(async (tx) => {
    updatedPaymentRows = await tx
      .update(payment)
      .set({
        status: 'paid',
        paidAt: now,
        externalId: externalRef,
        updatedAt: now,
      } as any)
      .where(and(eq(payment.id, paymentId), eq(payment.userId, ownerId)))
      .returning()
    if (!updatedPaymentRows.length) throw new Error('Pago no encontrado')

    await tx
      .update(installment)
      .set({ status: 'paid', paidAt: now, updatedAt: now } as any)
      .where(eq(installment.id, installmentId))

    const instsAfter = await tx.select().from(installment).where(eq(installment.loanId, inst.loanId))
    const paidCount = instsAfter.filter((i) => i.status === 'paid').length
    // Nunca reactivar ni cerrar un crédito cancelled/rejected por un cobro tardío:
    // solo transicionar si la máquina de estados lo permite desde el estado actual.
    if (paidCount === instsAfter.length) {
      if (canSettleOnCollection(loanObj.status)) {
        await tx.update(loan).set({ status: 'paid', updatedAt: now } as any).where(eq(loan.id, inst.loanId))
      }
    } else if (canActivateOnCollection(loanObj.status) && loanObj.status !== 'active') {
      await tx.update(loan).set({ status: 'active', updatedAt: now } as any).where(eq(loan.id, inst.loanId))
    }

    const instsForCalc = await tx.select().from(installment).where(eq(installment.loanId, inst.loanId))
    const pending = instsForCalc.filter((i) => i.status !== 'paid')
    const totalRemaining = pending.reduce(
      (acc, i) =>
        acc + (typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount) || 0),
      0,
    )
    const principalPaid = instsForCalc
      .filter((i) => i.status === 'paid')
      .reduce(
        (acc, i) =>
          acc + (typeof i.amount === 'string' ? parseFloat(i.amount) : Number(i.amount) || 0),
        0,
      )

    await tx.insert(paymentReceipt).values({
      id: receiptId,
      receiptNumber,
      receiptType: 'payment',
      userId: ownerId,
      paymentId,
      loanId: inst.loanId,
      installmentId,
      amount: payAmount,
      currency: 'ARS',
      loanSnapshot: JSON.parse(JSON.stringify(loanObj)),
      installmentSnapshot: JSON.parse(JSON.stringify(inst)),
      previousBalance: String(principalTotal),
      newBalance: String(totalRemaining),
      pendingInstallments: pending.length,
      totalPaidToDate: String(
        principalPaid + (typeof payAmount === 'string' ? parseFloat(payAmount) : Number(payAmount)),
      ),
      method: updatedPaymentRows[0].method,
      referenceNumber: externalRef ?? updatedPaymentRows[0].referenceNumber,
      paidAt: now,
      issuedAt: now,
      branding: JSON.parse(JSON.stringify(receiptBranding())),
      createdAt: now,
    })
  })

  const { enqueueInterestInvoices } = await import('@/lib/arca/invoice')
  enqueueInterestInvoices([installmentId])

  revalidateCustomer()
  if (opts?.notify !== false) {
    await notifyPaymentReceived({
      userId: ownerId,
      amount: payAmount,
      installmentNumber: inst.number,
      receiptId,
    })
  }
  return { ok: true, receiptId, receiptNumber }
}

export async function getReceiptsForLoan(loanId: string) {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(paymentReceipt)
    .where(and(eq(paymentReceipt.loanId, loanId), eq(paymentReceipt.userId, userId)))
    .orderBy(desc(paymentReceipt.issuedAt))
}

export async function getReceipt(id: string) {
  const userId = await assertRole('customer')
  const rows = await db
    .select()
    .from(paymentReceipt)
    .where(and(eq(paymentReceipt.id, id), eq(paymentReceipt.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function markReceiptDownloaded(id: string) {
  const userId = await assertRole('customer')
  await db
    .update(paymentReceipt)
    .set({
      downloadCount: sql`${paymentReceipt.downloadCount} + 1`,
      downloadedAt: new Date(),
    } as any)
    .where(and(eq(paymentReceipt.id, id), eq(paymentReceipt.userId, userId)))
  revalidateCustomer()
  return { ok: true }
}

export async function saveCardMethod(input: {
  brand: string
  last4: string
  expirationMonth: number
  expirationYear: number
  cardholderName: string
  cardholderDocument: string
  gateway: string
  gatewayCustomerId: string
  gatewayPaymentMethodId: string
  nickname?: string
  setAsDefault?: boolean
}) {
  const userId = await assertRole('customer')
  const id = crypto.randomUUID()
  const now = new Date()
  const setAsDefault = input.setAsDefault ?? false

  await db.transaction(async (tx) => {
    if (setAsDefault) {
      await tx
        .update(savedPaymentMethod)
        .set({ isDefault: false, updatedAt: now } as any)
        .where(eq(savedPaymentMethod.userId, userId))
    }

    await tx.insert(savedPaymentMethod).values({
      id,
      userId,
      type: 'card',
      brand: input.brand,
      nickname: input.nickname,
      isDefault: setAsDefault,
      isActive: true,
      last4: input.last4,
      expirationMonth: input.expirationMonth,
      expirationYear: input.expirationYear,
      cardholderName: input.cardholderName,
      cardholderDocument: input.cardholderDocument,
      gateway: input.gateway,
      gatewayCustomerId: input.gatewayCustomerId,
      gatewayPaymentMethodId: input.gatewayPaymentMethodId,
      createdAt: now,
      updatedAt: now,
    } as any)
  })

  revalidateCustomer()
  return { ok: true, id }
}

export async function saveWalletMethod(input: {
  type: 'cvu' | 'alias'
  brand?: string
  walletName?: string
  cvu?: string
  alias?: string
  nickname?: string
  setAsDefault?: boolean
}) {
  const userId = await assertRole('customer')
  const id = crypto.randomUUID()
  const now = new Date()
  const setAsDefault = input.setAsDefault ?? false

  await db.transaction(async (tx) => {
    if (setAsDefault) {
      await tx
        .update(savedPaymentMethod)
        .set({ isDefault: false, updatedAt: now } as any)
        .where(eq(savedPaymentMethod.userId, userId))
    }

    await tx.insert(savedPaymentMethod).values({
      id,
      userId,
      type: input.type,
      brand: input.brand,
      nickname: input.nickname,
      isDefault: setAsDefault,
      isActive: true,
      walletName: input.walletName,
      cvu: input.cvu,
      alias: input.alias,
      createdAt: now,
      updatedAt: now,
    } as any)
  })

  revalidateCustomer()
  return { ok: true, id }
}

export async function getPublicTreasury() {
  return treasuryForClient()
}

export async function getCollectionAccount() {
  await assertRole('customer', 'admin')
  return treasuryForClient()
}

export async function getCheckoutPublicKey() {
  await assertRole('customer', 'admin')
  return { publicKey: getMercadoPagoPublicKey(), test: MP_CONFIG.isTestToken }
}

export async function reportBankTransfer(installmentIds: string[], formData: FormData) {
  if (!installmentIds.length) throw new Error('Elegí al menos una cuota.')
  const sessionUser = await getSession().then((s) => s?.user?.id ?? null)
  const [first] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, installmentIds[0]))
    .limit(1)
  if (!first) throw new Error('Cuota no encontrada.')
  if (sessionUser && sessionUser !== first.userId) {
    throw new Error('Esta cuota no corresponde a tu cuenta.')
  }
  const userId = first.userId

  const insts = await db
    .select()
    .from(installment)
    .where(and(inArray(installment.id, installmentIds), eq(installment.userId, userId)))
  if (insts.length !== installmentIds.length) throw new Error('Cuota(s) no encontrada(s).')
  if (insts.some((row) => row.status === 'paid')) throw new Error('Alguna cuota ya está pagada.')
  const loanId = insts[0].loanId
  if (insts.some((row) => row.loanId !== loanId)) throw new Error('Las cuotas deben ser del mismo crédito.')

  const declared = Number(String(formData.get('amount') || '').replace(',', '.'))
  const expected = insts.reduce((sum, row) => sum + Number(row.amount), 0)
  if (!Number.isFinite(declared) || declared <= 0) throw new Error('Informá el importe transferido.')
  if (Math.abs(declared - expected) > 0.05) {
    throw new Error(`El importe informado debe ser ${expected.toFixed(2)} (suma de las cuotas).`)
  }

  const transferDate = String(formData.get('transferDate') || '').trim()
  const reference = String(formData.get('reference') || '').trim()
  const file = formData.get('proof')
  if (!(file instanceof File)) {
    throw new Error('Subí el comprobante de la transferencia (PDF o imagen).')
  }
  const { fileToDbProof } = await import('@/lib/proof-storage')
  const { dataUrl: proofUrl } = await fileToDbProof(file)
  const id = crypto.randomUUID()
  const treasury = treasuryForClient()
  const coupons = insts.map((row) =>
    couponCode({ loanId, number: row.number, dueDate: row.dueDate, amount: row.amount }),
  )

  await db.insert(payment).values({
    id,
    userId,
    loanId,
    installmentId: insts[0].id,
    amount: declared.toFixed(2),
    currency: 'ARS',
    status: 'pending_review',
    method: 'transferencia_rm',
    source: 'web',
    gateway: 'brubank',
    referenceNumber: reference || coupons[0],
    notes: `Transferencia informada a CBU ${treasury.cbu}`,
    gatewayResponse: {
      installment_ids: installmentIds,
      proofUrl,
      declaredAmount: declared,
      transferDate: transferDate || null,
      reference: reference || null,
      coupons,
      treasury,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)

  await recordAudit({
    actorUserId: userId,
    action: 'TRANSFER_REPORTED',
    entityType: 'payment',
    entityId: id,
    targetUserId: userId,
    summary: `Transferencia informada · ${declared.toFixed(2)} ARS · ${insts.length} cuota(s)`,
  })

  revalidateCustomer()
  revalidateOps()
  return { ok: true, paymentId: id, proofUrl }
}

export async function listPendingBankTransfers() {
  await assertAdmin()
  const rows = await db
    .select({
      payment,
      customerName: userTable.name,
      customerEmail: userTable.email,
    })
    .from(payment)
    .innerJoin(userTable, eq(userTable.id, payment.userId))
    .where(eq(payment.status, 'pending_review'))
    .orderBy(desc(payment.createdAt))
    .limit(80)

  return rows.map((row) => {
    const meta = (row.payment.gatewayResponse ?? {}) as {
      proofUrl?: string
      declaredAmount?: number
      transferDate?: string | null
      reference?: string | null
      installment_ids?: string[]
      coupons?: string[]
    }
    return {
      id: row.payment.id,
      userId: row.payment.userId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      loanId: row.payment.loanId,
      amount: Number(row.payment.amount),
      reference: row.payment.referenceNumber,
      createdAt: row.payment.createdAt,
      proofUrl: meta.proofUrl ?? null,
      transferDate: meta.transferDate ?? null,
      declaredAmount: meta.declaredAmount ?? Number(row.payment.amount),
      installmentIds: meta.installment_ids ?? (row.payment.installmentId ? [row.payment.installmentId] : []),
      coupons: meta.coupons ?? [],
    }
  })
}

export async function reviewBankTransfer(
  paymentId: string,
  action: 'approve' | 'reject',
  creditedAmount?: number,
  reason?: string,
) {
  const adminId = await assertAdmin()
  const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1)
  if (!row) throw new Error('Pago no encontrado.')
  if (row.status !== 'pending_review') throw new Error('Este cobro ya fue resuelto.')
  if (row.method !== 'transferencia_rm') throw new Error('No es una transferencia a RM.')

  if (action === 'reject') {
    await db
      .update(payment)
      .set({
        status: 'failed',
        failureReason: reason?.trim() || 'Comprobante rechazado: no se verificó la acreditación.',
        processedBy: adminId,
        updatedAt: new Date(),
      } as any)
      .where(eq(payment.id, paymentId))
    await recordAudit({
      actorUserId: adminId,
      action: 'TRANSFER_REJECTED',
      entityType: 'payment',
      entityId: paymentId,
      targetUserId: row.userId,
      summary: reason?.trim() || 'Transferencia rechazada',
    })
    await notifyPaymentRejected({
      userId: row.userId,
      amount: row.amount,
      reason: reason?.trim() || 'Comprobante rechazado: no se verificó la acreditación.',
    })
    revalidateOps()
    revalidateCustomer()
    return { ok: true, status: 'failed' }
  }

  const meta = (row.gatewayResponse ?? {}) as { installment_ids?: string[] }
  const ids = meta.installment_ids?.length ? meta.installment_ids : row.installmentId ? [row.installmentId] : []
  if (!ids.length) throw new Error('El pago no tiene cuotas asociadas.')

  const insts = await db.select().from(installment).where(inArray(installment.id, ids))
  const expected = insts.reduce((sum, item) => sum + Number(item.amount), 0)
  const credited = creditedAmount ?? Number(row.amount)
  if (!Number.isFinite(credited) || credited <= 0) throw new Error('Informá el monto acreditado en Brubank.')
  if (credited + 0.01 < expected) {
    throw new Error(`El monto acreditado (${credited.toFixed(2)}) no cubre las cuotas (${expected.toFixed(2)}).`)
  }

  for (const inst of insts) {
    if (inst.status === 'paid') continue
    await applyPaymentToInstallment(row.id, inst.id, inst.amount, row.referenceNumber ?? undefined, {
      notify: false,
    })
  }

  await db
    .update(payment)
    .set({
      processedBy: adminId,
      notes: `${row.notes ?? ''} · Acreditado ${credited.toFixed(2)}`.trim(),
      updatedAt: new Date(),
    } as any)
    .where(eq(payment.id, paymentId))

  await recordAudit({
    actorUserId: adminId,
    action: 'TRANSFER_APPROVED',
    entityType: 'payment',
    entityId: paymentId,
    targetUserId: row.userId,
    summary: `Transferencia acreditada · ${credited.toFixed(2)} ARS`,
  })

  const [rcpt] = await db
    .select({ id: paymentReceipt.id })
    .from(paymentReceipt)
    .where(eq(paymentReceipt.paymentId, row.id))
    .limit(1)
  await notifyPaymentReceived({
    userId: row.userId,
    amount: credited,
    receiptId: rcpt?.id,
  })

  revalidateOps()
  return { ok: true, status: 'paid' }
}

export async function getInstallmentCoupons(loanId: string) {
  const userId = await assertRole('customer', 'admin')
  const role = await getRoleForUser(userId)
  const [loanRow] = await db.select().from(loan).where(eq(loan.id, loanId)).limit(1)
  if (!loanRow) throw new Error('Crédito no encontrado.')
  if (role !== 'admin' && loanRow.userId !== userId) throw new Error('No autorizado.')

  const rows = await db
    .select()
    .from(installment)
    .where(eq(installment.loanId, loanId))
    .orderBy(installment.number)

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    amount: Number(row.amount),
    dueDate: row.dueDate,
    status: row.status,
    paidAt: row.paidAt,
    code: couponCode({
      loanId,
      number: row.number,
      dueDate: row.dueDate,
      amount: row.amount,
    }),
  }))
}

export async function getCheckoutStatus(paymentId: string) {
  const userId = await assertRole('customer')
  const [row] = await db
    .select({ id: payment.id, status: payment.status, amount: payment.amount })
    .from(payment)
    .where(and(eq(payment.id, paymentId), eq(payment.userId, userId)))
    .limit(1)
  if (!row) throw new Error('Pago no encontrado.')
  const [rcpt] = await db
    .select({ id: paymentReceipt.id })
    .from(paymentReceipt)
    .where(eq(paymentReceipt.paymentId, row.id))
    .limit(1)
  return {
    status: row.status,
    amount: row.amount,
    receiptId: rcpt?.id ?? null,
    settled: row.status === 'paid',
  }
}

export async function simulatePaywayCheckout(paymentId: string, outcome: 'approved' | 'rejected' = 'approved') {
  const userId = await assertRole('customer')
  if (!paywayAllowsSimulate()) {
    throw new Error('La simulación de Payway solo está habilitada en sandbox.')
  }
  const id = String(paymentId ?? '').trim()
  if (!id) throw new Error('Pago no encontrado.')
  const [row] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.id, id), eq(payment.userId, userId), eq(payment.gateway, 'payway')))
    .limit(1)
  if (!row) throw new Error('Pago Payway no encontrado.')
  const result = await settlePaywayPayment({
    status: outcome,
    amount: Number(row.amount) || 0,
    localPaymentId: row.id,
    paywayId: `sim-${row.id.replace(/-/g, '').slice(0, 12)}`,
    method: row.method,
    gatewayPayload: { simulated: true, outcome, at: new Date().toISOString() },
  })
  if (result.matched && result.credited > 0 && result.userId) {
    await notifyPaymentReceived({
      userId: result.userId,
      amount: result.amount ?? 0,
      installmentNumber: result.installmentNumber,
      receiptId: result.receiptId,
    })
  } else if (result.matched && result.rejected && result.userId) {
    await notifyPaymentRejected({
      userId: result.userId,
      amount: result.amount ?? 0,
      reason: result.reason,
    })
  }
  revalidateCustomer()
  return {
    settled: result.localStatus === 'paid',
    status: result.localStatus ?? row.status,
    credited: result.credited,
    receiptId: result.receiptId ?? null,
    reason: result.reason ?? null,
  }
}

export async function consultPaywayBin(bin: string) {
  await assertRole('customer')
  if (!isPaywayConfigured()) throw new Error('Payway no está configurado.')
  const info = await lookupPaywayBin(bin)
  if (!info) throw new Error('BIN no reconocido en sandbox. Probá 450799 o 529991.')
  return info
}

/*
 * Se eliminó la acreditación automática de cuotas desde el cliente: permitía dar
 * por pagado un crédito sin cobro real. La acreditación llega por el webhook de
 * Mercado Pago, la conciliación del Brick o por aprobación admin de una transferencia a RM.
 */
