'use server'

import { applyPaymentToInstallment } from '@/app/actions/payments'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  disbursement,
  installment,
  loan,
  loanContract,
  payment,
  paymentReceipt,
  user as userTable,
} from '@/lib/db/schema'
import { paymentMethodLabel } from '@/lib/labels'
import { syncOverdueInstallments } from '@/lib/legal/expediente'
import { cancelMercadoPagoPayment } from '@/lib/mercadopago'
import { isOpenNetworkCoupon, mercadoPagoNumericId } from '@/lib/payments/network-coupon'
import { reconcileOpenMercadoPagoPayments, settleMercadoPagoPayment } from '@/lib/payments/settle-mp'
import { paywayAllowsSimulate } from '@/lib/payway'
import { settlePaywayPayment } from '@/lib/payments/settle-payway'
import { revalidateOps } from '@/lib/revalidate'
import { assertAdmin, newId } from '@/lib/session'
import { and, desc, eq, inArray, or } from 'drizzle-orm'

function money(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

export type OpsInstallment = {
  id: string
  loanId: string
  userId: string
  customerName: string
  customerEmail: string
  number: number
  amount: number
  dueDate: string
  status: string
  paidAt: string | null
  daysLate: number
  loanStatus: string
  lastReceiptId: string | null
  lastReceiptNumber: string | null
  lastPaidAt: string | null
}

export type OpsReceipt = {
  id: string
  receiptNumber: string
  receiptType: string
  userId: string
  customerName: string
  loanId: string | null
  amount: number
  method: string | null
  statusHint: string
  issuedAt: string
  paidAt: string | null
  href: string
}

export type OpsMovement = {
  id: string
  at: string
  kind: 'pago' | 'desembolso' | 'cuota'
  title: string
  customerName: string
  userId: string
  loanId: string | null
  amount: number
  status: string
  href: string | null
}

export type OpsContract = {
  id: string
  loanId: string
  userId: string
  customerName: string
  status: string
  acceptedAt: string | null
  createdAt: string
  principal: number
  contractHref: string
  pagareHref: string
}

export type OpsOpenTicket = {
  id: string
  userId: string
  customerName: string
  loanId: string | null
  method: string
  amount: number
  status: string
  createdAt: string
  expiresAt: string | null
  operationNumber: string | null
  mpPaymentId: string | null
}

export type AdminOpsDesk = {
  generatedAt: string
  market: { country: string; currency: string }
  kpis: {
    overdueCount: number
    overdueAmount: number
    due7Count: number
    due7Amount: number
    collectedMonth: number
    receiptsMonth: number
    pendingReview: number
    openTickets: number
  }
  installments: OpsInstallment[]
  receipts: OpsReceipt[]
  movements: OpsMovement[]
  openTickets: OpsOpenTicket[]
  contracts: OpsContract[]
}

export async function getAdminOpsDesk(): Promise<AdminOpsDesk> {
  await assertAdmin()
  await syncOverdueInstallments()

  const [instRows, payRows, ticketRows, receiptRows, disbRows, contractRows] = await Promise.all([
    db
      .select({
        inst: installment,
        customerName: userTable.name,
        customerEmail: userTable.email,
        loanStatus: loan.status,
      })
      .from(installment)
      .innerJoin(userTable, eq(userTable.id, installment.userId))
      .innerJoin(loan, eq(loan.id, installment.loanId))
      .orderBy(installment.dueDate),
    db
      .select({
        pay: payment,
        customerName: userTable.name,
      })
      .from(payment)
      .innerJoin(userTable, eq(userTable.id, payment.userId))
      .where(inArray(payment.status, ['paid', 'pending_review', 'refunded', 'failed']))
      .orderBy(desc(payment.createdAt))
      .limit(400),
    db
      .select({
        pay: payment,
        customerName: userTable.name,
      })
      .from(payment)
      .innerJoin(userTable, eq(userTable.id, payment.userId))
      .where(
        and(
          inArray(payment.status, ['pending', 'processing']),
          or(inArray(payment.method, ['pago_facil', 'rapipago', 'ticket']), eq(payment.source, 'coupon_book')),
        ),
      )
      .orderBy(desc(payment.createdAt))
      .limit(500),
    db
      .select({
        rec: paymentReceipt,
        customerName: userTable.name,
      })
      .from(paymentReceipt)
      .innerJoin(userTable, eq(userTable.id, paymentReceipt.userId))
      .orderBy(desc(paymentReceipt.issuedAt))
      .limit(400),
    db
      .select({
        disb: disbursement,
        customerName: userTable.name,
      })
      .from(disbursement)
      .innerJoin(userTable, eq(userTable.id, disbursement.userId))
      .orderBy(desc(disbursement.createdAt))
      .limit(200),
    db
      .select({
        contract: loanContract,
        customerName: userTable.name,
        principal: loan.principal,
      })
      .from(loanContract)
      .innerJoin(userTable, eq(userTable.id, loanContract.userId))
      .innerJoin(loan, eq(loan.id, loanContract.loanId))
      .orderBy(desc(loanContract.createdAt))
      .limit(200),
  ])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const in7 = new Date(now)
  in7.setDate(in7.getDate() + 7)

  const receiptByInst = new Map<string, { id: string; number: string; paidAt: string | null }>()
  for (const row of receiptRows) {
    if (!row.rec.installmentId || receiptByInst.has(row.rec.installmentId)) continue
    receiptByInst.set(row.rec.installmentId, {
      id: row.rec.id,
      number: row.rec.receiptNumber,
      paidAt: iso(row.rec.paidAt || row.rec.issuedAt),
    })
  }

  const installments: OpsInstallment[] = instRows.map((row) => {
    const due = new Date(row.inst.dueDate)
    const unpaid = row.inst.status !== 'paid' && row.inst.status !== 'cancelled'
    const late = unpaid && due.getTime() < now.getTime() ? Math.max(0, daysBetween(due, now)) : 0
    const rec = receiptByInst.get(row.inst.id)
    return {
      id: row.inst.id,
      loanId: row.inst.loanId,
      userId: row.inst.userId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      number: row.inst.number,
      amount: money(row.inst.amount),
      dueDate: iso(row.inst.dueDate) || '',
      status: row.inst.status === 'pending' && late > 0 ? 'overdue' : row.inst.status,
      paidAt: iso(row.inst.paidAt),
      daysLate: late,
      loanStatus: row.loanStatus,
      lastReceiptId: rec?.id ?? null,
      lastReceiptNumber: rec?.number ?? null,
      lastPaidAt: rec?.paidAt ?? iso(row.inst.paidAt),
    }
  })

  const overdue = installments.filter((row) => row.status === 'overdue')
  const due7 = installments.filter((row) => {
    if (row.status === 'paid' || row.status === 'cancelled' || row.status === 'overdue') return false
    const due = new Date(row.dueDate)
    return due >= now && due <= in7
  })

  const paidThisMonth = payRows.filter((row) => {
    const at = row.pay.paidAt || row.pay.createdAt
    return row.pay.status === 'paid' && at && new Date(at) >= monthStart
  })
  const receiptsMonth = receiptRows.filter((row) => row.rec.issuedAt && new Date(row.rec.issuedAt) >= monthStart)

  const receipts: OpsReceipt[] = receiptRows.map((row) => ({
    id: row.rec.id,
    receiptNumber: row.rec.receiptNumber,
    receiptType: row.rec.receiptType,
    userId: row.rec.userId,
    customerName: row.customerName,
    loanId: row.rec.loanId,
    amount: money(row.rec.amount),
    method: row.rec.method,
    statusHint: row.rec.receiptType === 'disbursement' ? 'Desembolso' : 'Cobro',
    issuedAt: iso(row.rec.issuedAt) || '',
    paidAt: iso(row.rec.paidAt),
    href:
      row.rec.receiptType === 'disbursement' && row.rec.disbursementId
        ? `/dashboard/documentos/recibo/${row.rec.disbursementId}`
        : `/dashboard/documentos/recibo/${row.rec.id}`,
  }))

  const movements: OpsMovement[] = [
    ...payRows.map((row) => ({
      id: `pay-${row.pay.id}`,
      at: iso(row.pay.paidAt || row.pay.createdAt) || new Date().toISOString(),
      kind: 'pago' as const,
      title: `Pago · ${paymentMethodLabel(row.pay.method)}`,
      customerName: row.customerName,
      userId: row.pay.userId,
      loanId: row.pay.loanId,
      amount: money(row.pay.amount),
      status: row.pay.status,
      href: row.pay.userId ? `/admin?tab=usuarios&persona=${row.pay.userId}` : null,
    })),
    ...disbRows.map((row) => ({
      id: `disb-${row.disb.id}`,
      at: iso(row.disb.creditedAt || row.disb.createdAt) || new Date().toISOString(),
      kind: 'desembolso' as const,
      title: 'Desembolso a cuenta',
      customerName: row.customerName,
      userId: row.disb.userId,
      loanId: row.disb.loanId,
      amount: money(row.disb.netAmount ?? row.disb.amount),
      status: row.disb.status,
      href: row.disb.receiptNumber ? `/dashboard/documentos/recibo/${row.disb.id}` : `/admin?tab=desembolsos`,
    })),
    ...overdue.slice(0, 80).map((row) => ({
      id: `over-${row.id}`,
      at: row.dueDate,
      kind: 'cuota' as const,
      title: `Cuota #${row.number} vencida`,
      customerName: row.customerName,
      userId: row.userId,
      loanId: row.loanId,
      amount: row.amount,
      status: 'overdue',
      href: `/admin?tab=usuarios&persona=${row.userId}`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 250)

  const contracts: OpsContract[] = contractRows.map((row) => ({
    id: row.contract.id,
    loanId: row.contract.loanId,
    userId: row.contract.userId,
    customerName: row.customerName,
    status: row.contract.status,
    acceptedAt: iso(row.contract.acceptedAt),
    createdAt: iso(row.contract.createdAt) || '',
    principal: money(row.principal),
    contractHref: `/dashboard/documentos/contrato/${row.contract.id}`,
    pagareHref: `/dashboard/documentos/pagare/${row.contract.id}`,
  }))

  const openTickets: OpsOpenTicket[] = ticketRows
    .filter((row) => isOpenNetworkCoupon(row.pay))
    .map((row) => {
      const g =
        row.pay.gatewayResponse && typeof row.pay.gatewayResponse === 'object'
          ? (row.pay.gatewayResponse as Record<string, unknown>)
          : {}
      const operation =
        (typeof g.operation_number === 'string' && g.operation_number.trim()) ||
        (typeof row.pay.referenceNumber === 'string' && /^\d{8,16}$/.test(row.pay.referenceNumber.replace(/\s+/g, ''))
          ? row.pay.referenceNumber
          : null)
      return {
        id: row.pay.id,
        userId: row.pay.userId,
        customerName: row.customerName,
        loanId: row.pay.loanId,
        method: row.pay.method,
        amount: money(row.pay.amount),
        status: row.pay.status,
        createdAt: iso(row.pay.createdAt) || '',
        expiresAt: iso(row.pay.expiresAt),
        operationNumber: operation,
        mpPaymentId: mercadoPagoNumericId(row.pay),
      }
    })

  return {
    generatedAt: now.toISOString(),
    market: { country: 'Argentina', currency: 'ARS' },
    kpis: {
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, row) => sum + row.amount, 0),
      due7Count: due7.length,
      due7Amount: due7.reduce((sum, row) => sum + row.amount, 0),
      collectedMonth: paidThisMonth.reduce((sum, row) => sum + money(row.pay.amount), 0),
      receiptsMonth: receiptsMonth.length,
      pendingReview: payRows.filter((row) => row.pay.status === 'pending_review').length,
      openTickets: openTickets.length,
    },
    installments,
    receipts,
    movements,
    openTickets,
    contracts,
  }
}

export async function adminRegisterCollection(input: {
  installmentId: string
  amount: number
  method: 'transferencia_rm' | 'efectivo' | 'mercado_pago' | 'payway_qr'
  reference?: string
  notes?: string
}) {
  const adminId = await assertAdmin()
  const [inst] = await db.select().from(installment).where(eq(installment.id, input.installmentId)).limit(1)
  if (!inst) throw new Error('Cuota no encontrada.')
  if (inst.status === 'paid') throw new Error('La cuota ya está pagada.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Informá el monto cobrado.')

  const paymentId = newId('pay')
  await db.insert(payment).values({
    id: paymentId,
    userId: inst.userId,
    loanId: inst.loanId,
    installmentId: inst.id,
    amount: input.amount.toFixed(2),
    currency: 'ARS',
    status: 'pending',
    method: input.method,
    source: 'admin',
    referenceNumber: input.reference?.trim() || null,
    notes: input.notes?.trim() || 'Cobro registrado por mesa de cobranzas',
    processedBy: adminId,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const result = await applyPaymentToInstallment(paymentId, inst.id, input.amount, input.reference?.trim())
  await recordAudit({
    actorUserId: adminId,
    action: 'COLLECTION_REGISTERED',
    entityType: 'installment',
    entityId: inst.id,
    targetUserId: inst.userId,
    summary: `Cobro registrado · cuota #${inst.number} · ${input.amount.toFixed(2)} ARS`,
  })
  revalidateOps()
  return result
}

function gatewayRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function cancelOneOpenTicket(adminId: string, paymentId: string) {
  const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1)
  if (!row) throw new Error('Cupón no encontrado.')
  if (!isOpenNetworkCoupon(row)) throw new Error('Ese cupón ya no está abierto. Los cobros acreditados no se anulan.')

  const mpId = mercadoPagoNumericId(row)
  if (mpId) {
    const cancel = await cancelMercadoPagoPayment(mpId)
    if (!cancel.ok && cancel.reason === 'already_paid') {
      const settled = await settleMercadoPagoPayment({ mpPaymentId: mpId, localPaymentId: row.id })
      return { id: row.id, outcome: 'settled' as const, credited: settled.credited }
    }
    if (!cancel.ok) {
      throw new Error(`Mercado Pago no pudo anular el cupón (${cancel.reason}).`)
    }
  }

  const g = gatewayRecord(row.gatewayResponse)
  await db
    .update(payment)
    .set({
      status: 'cancelled',
      failureReason: 'Cupón anulado por tesorería',
      processedBy: adminId,
      notes: [row.notes, 'Anulado: el código de barras y el Nº de operación dejan de servir.']
        .filter(Boolean)
        .join(' · '),
      gatewayResponse: {
        ...g,
        cancelled_by: adminId,
        cancelled_at: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(payment.id, row.id))

  await recordAudit({
    actorUserId: adminId,
    action: 'NETWORK_TICKET_CANCELLED',
    entityType: 'payment',
    entityId: row.id,
    targetUserId: row.userId,
    summary: `Cupón ${paymentMethodLabel(row.method)} anulado · ${money(row.amount).toFixed(2)} ARS`,
  })

  return { id: row.id, outcome: 'cancelled' as const, credited: 0 }
}

export async function adminCancelNetworkTicket(paymentId: string) {
  const adminId = await assertAdmin()
  const result = await cancelOneOpenTicket(adminId, paymentId)
  revalidateOps()
  return result
}

export async function adminCancelOpenNetworkTickets() {
  const adminId = await assertAdmin()
  const rows = await db
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        inArray(payment.status, ['pending', 'processing']),
        inArray(payment.method, ['pago_facil', 'rapipago', 'ticket']),
      ),
    )
    .limit(500)

  const cancelled: string[] = []
  const settled: string[] = []
  const errors: { id: string; message: string }[] = []

  for (const row of rows) {
    try {
      const result = await cancelOneOpenTicket(adminId, row.id)
      if (result.outcome === 'settled') settled.push(row.id)
      else cancelled.push(row.id)
    } catch (err) {
      errors.push({ id: row.id, message: err instanceof Error ? err.message : 'Error' })
    }
  }

  revalidateOps()
  return { cancelled: cancelled.length, settled: settled.length, errors: errors.length, errorSamples: errors.slice(0, 8) }
}

export async function adminReconcileMercadoPago() {
  await assertAdmin()
  const results = await reconcileOpenMercadoPagoPayments(120)
  const credited = results.filter((row) => row.credited > 0).length
  const scanned = results.length
  revalidateOps()
  return { scanned, credited }
}

export async function adminSimulatePayway(paymentId: string, outcome: 'approved' | 'rejected' = 'approved') {
  await assertAdmin()
  if (!paywayAllowsSimulate()) throw new Error('La simulación Payway solo está habilitada en sandbox.')
  const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1)
  if (!row || row.gateway !== 'payway') throw new Error('Pago Payway no encontrado.')
  const result = await settlePaywayPayment({
    status: outcome,
    amount: money(row.amount),
    localPaymentId: row.id,
    paywayId: `adm-${row.id.replace(/-/g, '').slice(0, 12)}`,
    method: row.method,
    gatewayPayload: { simulated_by: 'admin', outcome },
  })
  revalidateOps()
  return { credited: result.credited, status: result.localStatus, receiptId: result.receiptId ?? null }
}
