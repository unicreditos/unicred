'use server'

import { requireAdmin } from '@/app/actions/admin'
import { requirePermission } from '@/lib/rbac'
import { getAuditLogForEntity, recordAudit, diffFields } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  disbursement,
  installment,
  loan,
  loanContract,
  loanProduct,
  merchant,
  merchantDocument,
  payment,
  paymentReceipt,
  profile,
  user as userTable,
} from '@/lib/db/schema'
import { syncOverdueInstallments } from '@/lib/legal/expediente'
import { desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

function money(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export type AdminLoanCase = {
  loan: {
    id: string
    userId: string
    productId: string | null
    merchantId: string | null
    type: string
    principal: number
    term: number
    monthlyRate: number
    tna: number
    tea: number | null
    installmentAmount: number
    totalAmount: number
    cft: number | null
    status: string
    purpose: string | null
    scoreAtApproval: number | null
    rejectionReason: string | null
    disbursedAt: string | null
    createdAt: string
    updatedAt: string | null
  }
  product: { id: string; name: string; type: string } | null
  customer: {
    id: string
    name: string
    email: string
    banned: boolean
    cuil: string | null
    dni: string | null
    phone: string | null
    kycStatus: string | null
    province: string | null
    city: string | null
    creditScore: number | null
  }
  merchant: { id: string; businessName: string; cuit: string; status: string } | null
  contract: {
    id: string
    status: string
    acceptedAt: string | null
    signerName: string | null
  } | null
  disbursement: {
    id: string
    status: string
    amount: number
    receiptNumber: string
    creditedAt: string | null
    proofUrl: string | null
    failureReason: string | null
  } | null
  installments: Array<{
    id: string
    number: number
    amount: number
    dueDate: string
    status: string
    paidAt: string | null
  }>
  payments: Array<{
    id: string
    amount: number
    status: string
    method: string
    gateway: string | null
    paidAt: string | null
    createdAt: string
  }>
  receipts: Array<{
    id: string
    receiptNumber: string
    receiptType: string
    amount: number
    issuedAt: string | null
  }>
  audit: Array<{
    id: string
    action: string
    summary: string
    actorEmail: string | null
    createdAt: string
    severity: string
  }>
  timeline: Array<{ at: string; label: string; detail: string; tone: 'ok' | 'warn' | 'critical' | 'default' }>
  totals: { outstanding: number; paidCount: number; overdueCount: number; pendingCount: number }
}

export async function getAdminLoanCase(loanId: string): Promise<AdminLoanCase | null> {
  await requireAdmin()
  const [row] = await db.select().from(loan).where(eq(loan.id, loanId)).limit(1)
  if (!row) return null

  await syncOverdueInstallments({ loanId: row.id })

  const [person] = await db.select().from(userTable).where(eq(userTable.id, row.userId)).limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, row.userId)).limit(1)
  const [prod] = row.productId
    ? await db.select().from(loanProduct).where(eq(loanProduct.id, row.productId)).limit(1)
    : [null]
  const [shop] = row.merchantId
    ? await db.select().from(merchant).where(eq(merchant.id, row.merchantId)).limit(1)
    : [null]
  const [contract] = await db.select().from(loanContract).where(eq(loanContract.loanId, loanId)).limit(1)
  const [disb] = await db.select().from(disbursement).where(eq(disbursement.loanId, loanId)).limit(1)
  const [plan, payRows, receiptRows, auditRows] = await Promise.all([
    db.select().from(installment).where(eq(installment.loanId, loanId)),
    db.select().from(payment).where(eq(payment.loanId, loanId)).orderBy(desc(payment.createdAt)),
    db.select().from(paymentReceipt).where(eq(paymentReceipt.loanId, loanId)).orderBy(desc(paymentReceipt.issuedAt)),
    getAuditLogForEntity('loan', loanId, 40),
  ])

  const sorted = [...plan].sort((a, b) => a.number - b.number)
  const paid = sorted.filter((i) => i.status === 'paid')
  const overdue = sorted.filter((i) => i.status === 'overdue')
  const pending = sorted.filter((i) => i.status === 'pending')
  const outstanding = sorted.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + money(i.amount), 0)

  const createdAt = iso(row.createdAt) || new Date().toISOString()
  const timeline: AdminLoanCase['timeline'] = [
    { at: createdAt, label: 'Solicitud ingresada', detail: `Capital ${money(row.principal)} · ${row.term} cuotas`, tone: 'default' },
  ]
  if (row.status === 'rejected') {
    timeline.push({
      at: iso(row.updatedAt) || createdAt,
      label: 'Rechazado',
      detail: row.rejectionReason || 'Sin motivo cargado',
      tone: 'critical',
    })
  }
  if (row.status === 'approved' || row.status === 'active' || row.status === 'paid') {
    timeline.push({
      at: iso(row.updatedAt) || createdAt,
      label: 'Calificado',
      detail: row.scoreAtApproval != null ? `Score ${row.scoreAtApproval}` : 'Mesa de crédito',
      tone: 'ok',
    })
  }
  if (contract) {
    timeline.push({
      at: iso(contract.acceptedAt) || iso(contract.createdAt) || createdAt,
      label: contract.status === 'accepted' ? 'Contrato firmado' : 'Expediente emitido',
      detail: contract.signerName || contract.status,
      tone: contract.status === 'accepted' ? 'ok' : 'warn',
    })
  }
  if (disb) {
    timeline.push({
      at: iso(disb.creditedAt) || iso(row.disbursedAt) || iso(disb.createdAt) || createdAt,
      label: disb.status === 'credited' ? 'Desembolso acreditado' : 'Desembolso en cola',
      detail: disb.receiptNumber,
      tone: disb.status === 'credited' ? 'ok' : 'warn',
    })
  }
  for (const inst of paid) {
    if (!inst.paidAt) continue
    timeline.push({
      at: iso(inst.paidAt) || createdAt,
      label: `Cuota ${inst.number} cobrada`,
      detail: String(money(inst.amount)),
      tone: 'ok',
    })
  }
  if (row.status === 'paid') {
    timeline.push({
      at: iso(row.updatedAt) || createdAt,
      label: 'Crédito cancelado',
      detail: 'Saldo cero',
      tone: 'ok',
    })
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at))

  return {
    loan: {
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      merchantId: row.merchantId,
      type: row.type,
      principal: money(row.principal),
      term: row.term,
      monthlyRate: money(row.monthlyRate),
      tna: money(row.tna),
      tea: row.tea == null ? null : money(row.tea),
      installmentAmount: money(row.installmentAmount),
      totalAmount: money(row.totalAmount),
      cft: row.cft == null ? null : money(row.cft),
      status: row.status,
      purpose: row.purpose,
      scoreAtApproval: row.scoreAtApproval,
      rejectionReason: row.rejectionReason,
      disbursedAt: iso(row.disbursedAt),
      createdAt,
      updatedAt: iso(row.updatedAt),
    },
    product: prod ? { id: prod.id, name: prod.name, type: prod.type } : null,
    customer: {
      id: person?.id ?? row.userId,
      name: person?.name ?? 'Sin nombre',
      email: person?.email ?? '',
      banned: Boolean(person?.banned),
      cuil: prof?.cuil ?? null,
      dni: prof?.dni ?? null,
      phone: prof?.phone ?? person?.phoneNumber ?? null,
      kycStatus: prof?.kycStatus ?? null,
      province: prof?.province ?? null,
      city: prof?.city ?? null,
      creditScore: prof?.creditScore ?? null,
    },
    merchant: shop
      ? { id: shop.id, businessName: shop.businessName, cuit: shop.cuit, status: shop.status }
      : null,
    contract: contract
      ? {
          id: contract.id,
          status: contract.status,
          acceptedAt: iso(contract.acceptedAt),
          signerName: contract.signerName,
        }
      : null,
    disbursement: disb
      ? {
          id: disb.id,
          status: disb.status,
          amount: money(disb.amount),
          receiptNumber: disb.receiptNumber,
          creditedAt: iso(disb.creditedAt),
          proofUrl: disb.proofUrl,
          failureReason: disb.failureReason,
        }
      : null,
    installments: sorted.map((item) => ({
      id: item.id,
      number: item.number,
      amount: money(item.amount),
      dueDate: iso(item.dueDate) || '',
      status: item.status,
      paidAt: iso(item.paidAt),
    })),
    payments: payRows.map((item) => ({
      id: item.id,
      amount: money(item.amount),
      status: item.status,
      method: item.method,
      gateway: item.gateway,
      paidAt: iso(item.paidAt),
      createdAt: iso(item.createdAt) || createdAt,
    })),
    receipts: receiptRows.map((item) => ({
      id: item.id,
      receiptNumber: item.receiptNumber,
      receiptType: item.receiptType,
      amount: money(item.amount),
      issuedAt: iso(item.issuedAt),
    })),
    audit: auditRows.map((item) => ({
      id: item.id,
      action: item.action,
      summary: item.summary,
      actorEmail: item.actorEmail,
      createdAt: iso(item.createdAt) || createdAt,
      severity: item.severity,
    })),
    timeline,
    totals: {
      outstanding,
      paidCount: paid.length,
      overdueCount: overdue.length,
      pendingCount: pending.length,
    },
  }
}

export type AdminMerchantCase = {
  merchant: {
    id: string
    userId: string
    businessName: string
    legalName: string | null
    cuit: string
    category: string | null
    province: string | null
    city: string | null
    address: string | null
    phone: string | null
    status: string
    personType: string | null
    taxCondition: string | null
    taxStatus: string | null
    kybStatus: string | null
    titularMatch: string | null
    kybBlockers: string[]
    commissionRate: number
    createdAt: string
  }
  owner: {
    id: string
    name: string
    email: string
    cuil: string | null
    dni: string | null
    kycStatus: string | null
    banned: boolean
  }
  documents: Array<{
    id: string
    type: string
    fileName: string
    status: string
    createdAt: string | null
  }>
  loans: Array<{
    id: string
    principal: number
    term: number
    status: string
    createdAt: string
  }>
  payments: Array<{
    id: string
    amount: number
    status: string
    createdAt: string
  }>
}

export async function getAdminMerchantCase(merchantId: string): Promise<AdminMerchantCase | null> {
  await requireAdmin()
  const [row] = await db.select().from(merchant).where(eq(merchant.id, merchantId)).limit(1)
  if (!row) return null

  const [person] = await db.select().from(userTable).where(eq(userTable.id, row.userId)).limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, row.userId)).limit(1)
  const [docs, loanRows, payRows] = await Promise.all([
    db.select().from(merchantDocument).where(eq(merchantDocument.merchantId, merchantId)),
    db.select().from(loan).where(eq(loan.merchantId, merchantId)).orderBy(desc(loan.createdAt)).limit(50),
    db.select().from(payment).where(eq(payment.merchantId, merchantId)).orderBy(desc(payment.createdAt)).limit(50),
  ])

  const blockers = Array.isArray(row.kybBlockers) ? row.kybBlockers : []

  return {
    merchant: {
      id: row.id,
      userId: row.userId,
      businessName: row.businessName,
      legalName: row.legalName,
      cuit: row.cuit,
      category: row.category,
      province: row.province,
      city: row.city,
      address: row.address,
      phone: row.phone,
      status: row.status,
      personType: row.personType,
      taxCondition: row.taxCondition,
      taxStatus: row.taxStatus,
      kybStatus: row.kybStatus,
      titularMatch: row.titularMatch,
      kybBlockers: blockers,
      commissionRate: money(row.commissionRate),
      createdAt: iso(row.createdAt) || new Date().toISOString(),
    },
    owner: {
      id: person?.id ?? row.userId,
      name: person?.name ?? 'Sin nombre',
      email: person?.email ?? '',
      cuil: prof?.cuil ?? null,
      dni: prof?.dni ?? null,
      kycStatus: prof?.kycStatus ?? null,
      banned: Boolean(person?.banned),
    },
    documents: docs.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      status: d.status,
      createdAt: iso(d.createdAt),
    })),
    loans: loanRows.map((item) => ({
      id: item.id,
      principal: money(item.principal),
      term: item.term,
      status: item.status,
      createdAt: iso(item.createdAt) || new Date().toISOString(),
    })),
    payments: payRows.map((item) => ({
      id: item.id,
      amount: money(item.amount),
      status: item.status,
      createdAt: iso(item.createdAt) || new Date().toISOString(),
    })),
  }
}

export type AdminPaymentRow = {
  id: string
  userId: string
  loanId: string | null
  installmentId: string | null
  merchantId: string | null
  amount: number
  status: string
  method: string
  gateway: string | null
  externalId: string | null
  referenceNumber: string | null
  failureReason: string | null
  paidAt: string | null
  createdAt: string
  userName: string | null
  userEmail: string | null
}

export type AdminPaymentsDesk = {
  kpis: { total: number; volume: number; pending: number; failed: number }
  rows: AdminPaymentRow[]
}

export async function listAdminPayments(limit = 200): Promise<AdminPaymentsDesk> {
  await requireAdmin()
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      volume: sql<number>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'paid'), 0)`,
      pending: sql<number>`count(*) filter (where ${payment.status} in ('pending','processing','pending_review'))::int`,
      failed: sql<number>`count(*) filter (where ${payment.status} in ('failed','cancelled','expired'))::int`,
    })
    .from(payment)

  const rows = await db
    .select({
      id: payment.id,
      userId: payment.userId,
      loanId: payment.loanId,
      installmentId: payment.installmentId,
      merchantId: payment.merchantId,
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
      gateway: payment.gateway,
      externalId: payment.externalId,
      referenceNumber: payment.referenceNumber,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      userName: userTable.name,
      userEmail: userTable.email,
    })
    .from(payment)
    .leftJoin(userTable, eq(payment.userId, userTable.id))
    .orderBy(desc(payment.createdAt))
    .limit(limit)

  return {
    kpis: {
      total: Number(totals?.total ?? 0),
      volume: money(totals?.volume),
      pending: Number(totals?.pending ?? 0),
      failed: Number(totals?.failed ?? 0),
    },
    rows: rows.map((item) => ({
      id: item.id,
      userId: item.userId,
      loanId: item.loanId,
      installmentId: item.installmentId,
      merchantId: item.merchantId,
      amount: money(item.amount),
      status: item.status,
      method: item.method,
      gateway: item.gateway,
      externalId: item.externalId,
      referenceNumber: item.referenceNumber,
      failureReason: item.failureReason,
      paidAt: iso(item.paidAt),
      createdAt: iso(item.createdAt) || new Date().toISOString(),
      userName: item.userName,
      userEmail: item.userEmail,
    })),
  }
}

export type AdminPaymentCase = {
  payment: AdminPaymentRow & { notes: string | null; source: string; currency: string }
  customer: { id: string; name: string; email: string; cuil: string | null }
  loan: { id: string; status: string; principal: number; term: number } | null
  installment: { id: string; number: number; status: string; dueDate: string | null } | null
  receipts: Array<{ id: string; receiptNumber: string; receiptType: string; amount: number }>
}

export async function getAdminPaymentCase(paymentId: string): Promise<AdminPaymentCase | null> {
  await requireAdmin()
  const [row] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1)
  if (!row) return null

  const [person] = await db.select().from(userTable).where(eq(userTable.id, row.userId)).limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, row.userId)).limit(1)
  const [loanRow] = row.loanId ? await db.select().from(loan).where(eq(loan.id, row.loanId)).limit(1) : [null]
  const [inst] = row.installmentId
    ? await db.select().from(installment).where(eq(installment.id, row.installmentId)).limit(1)
    : [null]
  const receipts = await db.select().from(paymentReceipt).where(eq(paymentReceipt.paymentId, paymentId))

  return {
    payment: {
      id: row.id,
      userId: row.userId,
      loanId: row.loanId,
      installmentId: row.installmentId,
      merchantId: row.merchantId,
      amount: money(row.amount),
      status: row.status,
      method: row.method,
      gateway: row.gateway,
      externalId: row.externalId,
      referenceNumber: row.referenceNumber,
      failureReason: row.failureReason,
      paidAt: iso(row.paidAt),
      createdAt: iso(row.createdAt) || new Date().toISOString(),
      userName: person?.name ?? null,
      userEmail: person?.email ?? null,
      notes: row.notes,
      source: row.source,
      currency: row.currency,
    },
    customer: {
      id: person?.id ?? row.userId,
      name: person?.name ?? 'Sin nombre',
      email: person?.email ?? '',
      cuil: prof?.cuil ?? null,
    },
    loan: loanRow
      ? {
          id: loanRow.id,
          status: loanRow.status,
          principal: money(loanRow.principal),
          term: loanRow.term,
        }
      : null,
    installment: inst
      ? {
          id: inst.id,
          number: inst.number,
          status: inst.status,
          dueDate: iso(inst.dueDate),
        }
      : null,
    receipts: receipts.map((item) => ({
      id: item.id,
      receiptNumber: item.receiptNumber,
      receiptType: item.receiptType,
      amount: money(item.amount),
    })),
  }
}

export async function updateLoanProductAdmin(
  id: string,
  input: {
    name?: string
    minAmount?: string
    maxAmount?: string
    minTerm?: number
    maxTerm?: number
    monthlyRate?: string
    tna?: string
    active?: boolean
  },
) {
  const adminUserId = await requirePermission('config.write')
  const [existing] = await db.select().from(loanProduct).where(eq(loanProduct.id, id)).limit(1)
  if (!existing) throw new Error('Producto no encontrado')

  const minAmount =
    input.minAmount !== undefined ? Number(String(input.minAmount).replace(',', '.')) : money(existing.minAmount)
  const maxAmount =
    input.maxAmount !== undefined ? Number(String(input.maxAmount).replace(',', '.')) : money(existing.maxAmount)
  const minTerm = input.minTerm !== undefined ? Number(input.minTerm) : existing.minTerm
  const maxTerm = input.maxTerm !== undefined ? Number(input.maxTerm) : existing.maxTerm
  const monthlyRate =
    input.monthlyRate !== undefined
      ? Number(String(input.monthlyRate).replace(',', '.'))
      : money(existing.monthlyRate)
  const tna =
    input.tna !== undefined ? Number(String(input.tna).replace(',', '.')) : money(existing.tna)

  if (!Number.isFinite(minAmount) || minAmount <= 0) throw new Error('Monto mínimo inválido')
  if (!Number.isFinite(maxAmount) || maxAmount < minAmount) throw new Error('Monto máximo inválido')
  if (!Number.isInteger(minTerm) || minTerm < 1) throw new Error('Plazo mínimo inválido')
  if (!Number.isInteger(maxTerm) || maxTerm < minTerm || maxTerm > 120) {
    throw new Error('Plazo máximo inválido (1 a 120)')
  }
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) throw new Error('Tasa mensual inválida')
  if (!Number.isFinite(tna) || tna <= 0) throw new Error('TNA inválida')

  const next = {
    name: input.name?.trim() || existing.name,
    minAmount: minAmount.toFixed(2),
    maxAmount: maxAmount.toFixed(2),
    minTerm,
    maxTerm,
    monthlyRate: monthlyRate.toFixed(3),
    tna: tna.toFixed(3),
    active: input.active ?? existing.active,
  }

  await db.update(loanProduct).set(next).where(eq(loanProduct.id, id))

  await recordAudit({
    actorUserId: adminUserId,
    action: input.active !== undefined && input.active !== existing.active
      ? input.active
        ? 'PRODUCT_ACTIVATED'
        : 'PRODUCT_DEACTIVATED'
      : 'PRODUCT_UPDATED',
    entityType: 'loan_product',
    entityId: id,
    severity: 'warning',
    summary: `Producto ${next.name} actualizado`,
    changes: diffFields(
      {
        name: existing.name,
        minAmount: existing.minAmount,
        maxAmount: existing.maxAmount,
        minTerm: existing.minTerm,
        maxTerm: existing.maxTerm,
        monthlyRate: existing.monthlyRate,
        tna: existing.tna,
        active: existing.active,
      },
      next,
    ),
  })

  revalidatePath('/admin')
  return { ok: true as const }
}
