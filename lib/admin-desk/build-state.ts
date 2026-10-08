import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { BRAND } from '@/lib/brand'
import { db, isPlaceholderDbUrl } from '@/lib/db'
import {
  adminAuditLog,
  adminRole,
  bankAccount,
  bcraCheck,
  bcraVariable,
  disbursement,
  installment,
  kycVerification,
  loan,
  loanContract,
  loanProduct,
  merchant,
  payment,
  paymentReceipt,
  profile,
  supportCase,
  user,
} from '@/lib/db/schema'
import { TREASURY_ACCOUNT } from '@/lib/treasury'
import type {
  AdminDeskState,
  Approval,
  BankAccount,
  BcraVariable,
  CendeuReport,
  CendeuResult,
  Client,
  CollectionBucket,
  CollectionCase,
  CollectionContact,
  ContractTemplate,
  Credit,
  CreditProduct,
  DailyPoint,
  Disbursement,
  DisbursementStatus,
  Installment,
  KycCase,
  KycStatus,
  LedgerEntry,
  LoanApplication,
  Merchant,
  MerchantStatus,
  Operator,
  OperatorRole,
  Payment,
  PaymentChannel,
  PaymentStatus,
  ProductType,
  Receipt,
  SupportTicket,
  TicketStatus,
} from './types'

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null
  if (typeof d === 'string') {
    const parsed = new Date(d)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  return d.toISOString()
}

function dayKey(d: Date | string | null | undefined): string | null {
  const s = iso(d)
  return s ? s.slice(0, 10) : null
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

function initialsFromName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function mapProductType(raw: string | null | undefined): ProductType {
  const t = (raw || '').toLowerCase()
  if (t.includes('refinanc')) return 'refinanciacion'
  if (t.includes('consum')) return 'consumo'
  return 'personal'
}

function mapKycStatus(raw: string | null | undefined): KycStatus {
  switch ((raw || '').toLowerCase()) {
    case 'approved':
    case 'verified':
      return 'verified'
    case 'reviewing':
    case 'in_review':
    case 'in-review':
      return 'in_review'
    case 'rejected':
      return 'rejected'
    case 'expired':
      return 'expired'
    default:
      return 'pending'
  }
}

function mapMerchantStatus(raw: string | null | undefined): MerchantStatus {
  switch ((raw || '').toLowerCase()) {
    case 'active':
      return 'active'
    case 'paused':
      return 'paused'
    case 'rejected':
      return 'rejected'
    case 'pending':
    case 'onboarding':
    default:
      return 'onboarding'
  }
}

function mapOperatorRole(key: string | null | undefined): OperatorRole {
  if (!key) return 'director'
  const k = key.toLowerCase()
  const map: Record<string, OperatorRole> = {
    director: 'director',
    super_admin: 'director',
    gerente: 'director',
    originacion: 'originacion',
    creditos: 'originacion',
    comercial: 'originacion',
    tesoreria: 'tesoreria',
    finanzas: 'tesoreria',
    cobranzas: 'tesoreria',
    riesgo: 'riesgo',
    soporte: 'soporte',
    auditor: 'auditor',
  }
  return map[k] ?? 'director'
}

function mapPaymentChannel(method: string | null | undefined): PaymentChannel {
  const m = (method || '').toLowerCase()
  return m.includes('mercado') ? 'mercadopago' : 'transferencia'
}

function mapPaymentStatus(raw: string | null | undefined): PaymentStatus {
  switch ((raw || '').toLowerCase()) {
    case 'paid':
    case 'reconciled':
      return 'reconciled'
    case 'matched':
      return 'matched'
    case 'failed':
    case 'cancelled':
    case 'canceled':
    case 'rejected':
      return 'rejected'
    case 'refunded':
      return 'refunded'
    case 'pending':
    case 'pending_review':
    default:
      return 'pending'
  }
}

function mapDisbursementStatus(raw: string | null | undefined): DisbursementStatus {
  switch ((raw || '').toLowerCase()) {
    case 'credited':
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'processing':
      return 'processing'
    case 'pending':
    case 'queued':
    default:
      return 'queued'
  }
}

function mapInstallmentStatus(
  raw: string | null | undefined,
  dueDate: Date,
  now: Date,
): Installment['status'] {
  const s = (raw || '').toLowerCase()
  if (s === 'paid') return 'paid'
  if (s === 'partial') return 'partial'
  if (s === 'overdue') return 'overdue'
  if (dueDate.getTime() < now.getTime() && s !== 'paid') return 'overdue'
  return 'pending'
}

function bucketFromDays(days: number): CollectionBucket {
  if (days <= 0) return 'al_dia'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

function mapTicketStatus(raw: string | null | undefined): TicketStatus {
  switch ((raw || '').toLowerCase()) {
    case 'resolved':
      return 'resolved'
    case 'closed':
      return 'closed'
    case 'pending':
    case 'waiting':
      return 'pending'
    default:
      return 'open'
  }
}

function mapTicketChannel(
  raw: string | null | undefined,
): SupportTicket['channel'] {
  switch ((raw || '').toLowerCase()) {
    case 'email':
      return 'email'
    case 'whatsapp':
      return 'whatsapp'
    case 'telefono':
    case 'phone':
      return 'telefono'
    default:
      return 'interno'
  }
}

function mapContractStatus(raw: string | null | undefined): ContractTemplate['status'] {
  switch ((raw || '').toLowerCase()) {
    case 'accepted':
    case 'active':
    case 'signed':
      return 'active'
    case 'archived':
    case 'rejected':
    case 'expired':
      return 'archived'
    default:
      return 'draft'
  }
}

function mapCendeuResult(worst: number | null | undefined): CendeuResult {
  if (worst == null) return 'sin_info'
  if (worst <= 1) return 'ok'
  if (worst === 2) return 'novedad'
  return 'irregular'
}

function emptySeries(): DailyPoint[] {
  const out: DailyPoint[] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({
      date: d.toISOString().slice(0, 10),
      solicitudes: 0,
      aprobadas: 0,
      rechazadas: 0,
      cobrado: 0,
      desembolsado: 0,
    })
  }
  return out
}

function emptyState(): AdminDeskState {
  return {
    products: [],
    operators: [],
    merchants: [],
    clients: [],
    kyc: [],
    applications: [],
    credits: [],
    payments: [],
    disbursements: [],
    collections: [],
    approvals: [],
    receipts: [],
    accounts: [],
    ledger: [],
    cendeu: [],
    bcra: [],
    contracts: [
      {
        id: 'ct-default',
        name: 'Mutuo personal ARS',
        version: '1.0',
        productId: null,
        status: 'active',
        updatedAt: new Date().toISOString(),
        clauses: 0,
      },
    ],
    tickets: [],
    audit: [],
    config: defaultConfig(),
    series: emptySeries(),
  }
}

function defaultConfig(): AdminDeskState['config'] {
  return {
    companyName: 'UNICRÉDITOS',
    cuit: BRAND.cuit,
    timezone: 'America/Argentina/Buenos_Aires',
    locale: 'es-AR',
    currency: 'ARS',
    manualDisbursement: true,
    punitiveInterest: false,
    kycProvider: 'didit',
    mpCollectorId: process.env.MP_COLLECTOR_ID || process.env.MERCADOPAGO_COLLECTOR_ID || '',
    supportEmail: process.env.SUPPORT_EMAIL || 'soporte@unicreditos.com',
    collectionsSlaHours: 24,
  }
}

function buildTreasuryAccounts(): BankAccount[] {
  const cbu = TREASURY_ACCOUNT.cbu || ''
  const bank = TREASURY_ACCOUNT.bank || 'Tesorería'
  const alias = TREASURY_ACCOUNT.alias || ''
  if (!cbu) return []
  return [
    {
      id: 'acc-treasury-desembolsos',
      label: 'Tesorería Desembolsos',
      bank,
      cbu,
      alias: alias || 'UNICRED.DESEMBOLSOS',
      currency: 'ARS',
      purpose: 'desembolsos',
      balance: 0,
      active: true,
    },
    {
      id: 'acc-treasury-cobranzas',
      label: 'Tesorería Cobranzas',
      bank,
      cbu,
      alias: alias || 'UNICRED.COBROS',
      currency: 'ARS',
      purpose: 'cobranzas',
      balance: 0,
      active: true,
    },
    {
      id: 'acc-treasury-operativa',
      label: 'Tesorería Operativa',
      bank,
      cbu,
      alias: alias || 'UNICRED.OPERATIVA',
      currency: 'ARS',
      purpose: 'operativa',
      balance: 0,
      active: true,
    },
  ]
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T, label?: string): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (label) {
      console.warn(
        `[admin-desk] safeQuery ${label}:`,
        err instanceof Error ? err.message : err,
      )
    }
    return fallback
  }
}

/**
 * Builds a JSON-serializable AdminState-compatible snapshot from the live DB.
 * Direct Drizzle access only (no server actions). Empty / missing tables → empty arrays.
 */
export type AdminDeskSnapshot = {
  state: AdminDeskState
  degraded: boolean
  error?: string
}

export async function buildAdminDeskSnapshot(): Promise<AdminDeskSnapshot> {
  if (isPlaceholderDbUrl(process.env.DATABASE_URL)) {
    return {
      state: emptyState(),
      degraded: true,
      error: 'DATABASE_URL no configurada (placeholder)',
    }
  }

  try {
    const state = await buildFromDb()
    return { state, degraded: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[admin-desk] buildAdminDeskState failed:', message)
    return { state: emptyState(), degraded: true, error: message }
  }
}

/** @deprecated Prefer buildAdminDeskSnapshot for degraded signaling. */
export async function buildAdminDeskState(): Promise<AdminDeskState> {
  const snap = await buildAdminDeskSnapshot()
  return snap.state
}

async function buildFromDb(): Promise<AdminDeskState> {
  const now = new Date()

  const [
    productRows,
    operatorRows,
    merchantRows,
    clientRows,
    kycRows,
    loanRows,
    paymentRows,
    disbursementRows,
    receiptRows,
    bankAccountRows,
    bcraCheckRows,
    bcraVarRows,
    contractRows,
    ticketRows,
    auditRows,
  ] = await Promise.all([
    safeQuery(() => db.select().from(loanProduct).limit(100), []),
    safeQuery(
      () =>
        db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            banned: user.banned,
            updatedAt: user.updatedAt,
            userRole: user.role,
            profileRole: profile.role,
            adminRoleKey: adminRole.key,
          })
          .from(user)
          .leftJoin(profile, eq(profile.userId, user.id))
          .leftJoin(adminRole, eq(profile.adminRoleId, adminRole.id))
          .where(or(eq(profile.role, 'admin'), eq(user.role, 'admin')))
          .limit(100),
      [],
    ),
    safeQuery(
      () =>
        db
          .select({
            merchant,
            email: user.email,
          })
          .from(merchant)
          .leftJoin(user, eq(merchant.userId, user.id))
          .orderBy(desc(merchant.createdAt))
          .limit(200),
      [],
    ),
    safeQuery(
      () =>
        db
          .select({
            profile,
            userId: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
          })
          .from(profile)
          .innerJoin(user, eq(profile.userId, user.id))
          .where(
            or(
              eq(profile.role, 'customer'),
              eq(user.role, 'customer'),
              and(sql`${profile.role} <> 'admin'`, sql`${user.role} <> 'admin'`),
            ),
          )
          .orderBy(desc(user.createdAt))
          .limit(300),
      [],
    ),
    safeQuery(
      () =>
        db
          .select({
            id: kycVerification.id,
            userId: kycVerification.userId,
            status: kycVerification.status,
            providerReferenceId: kycVerification.providerReferenceId,
            cuilVerified: kycVerification.cuilVerified,
            faceMatchScore: kycVerification.faceMatchScore,
            createdAt: kycVerification.createdAt,
            reviewedAt: kycVerification.reviewedAt,
            rejectionReason: kycVerification.rejectionReason,
            reviewedBy: kycVerification.reviewedBy,
          })
          .from(kycVerification)
          .orderBy(desc(kycVerification.updatedAt))
          .limit(300),
      [],
    ),
    safeQuery(() => db.select().from(loan).orderBy(desc(loan.createdAt)).limit(400), []),
    safeQuery(
      () =>
        db
          .select({
            id: payment.id,
            loanId: payment.loanId,
            userId: payment.userId,
            method: payment.method,
            status: payment.status,
            amount: payment.amount,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt,
            externalId: payment.externalId,
            referenceNumber: payment.referenceNumber,
            processedBy: payment.processedBy,
            notes: payment.notes,
            failureReason: payment.failureReason,
          })
          .from(payment)
          .orderBy(desc(payment.createdAt))
          .limit(400),
      [],
    ),
    safeQuery(() => db.select().from(disbursement).orderBy(desc(disbursement.createdAt)).limit(200), []),
    safeQuery(
      () =>
        db
          .select({
            id: paymentReceipt.id,
            paymentId: paymentReceipt.paymentId,
            disbursementId: paymentReceipt.disbursementId,
            userId: paymentReceipt.userId,
            receiptNumber: paymentReceipt.receiptNumber,
            amount: paymentReceipt.amount,
            issuedAt: paymentReceipt.issuedAt,
          })
          .from(paymentReceipt)
          .orderBy(desc(paymentReceipt.issuedAt))
          .limit(200),
      [],
    ),
    safeQuery(
      () =>
        db
          .select()
          .from(bankAccount)
          .where(eq(bankAccount.isActive, true))
          .limit(500),
      [],
    ),
    safeQuery(
      () =>
        db
          .select({
            id: bcraCheck.id,
            userId: bcraCheck.userId,
            worstSituation: bcraCheck.worstSituation,
            entitiesCount: bcraCheck.entitiesCount,
            computedScore: bcraCheck.computedScore,
            consultedAt: bcraCheck.consultedAt,
            createdAt: bcraCheck.createdAt,
          })
          .from(bcraCheck)
          .orderBy(desc(bcraCheck.createdAt))
          .limit(400),
      [],
    ),
    safeQuery(() => db.select().from(bcraVariable).limit(100), []),
    safeQuery(
      () =>
        db
          .select({
            id: loanContract.id,
            loanId: loanContract.loanId,
            templateName: loanContract.templateName,
            version: loanContract.version,
            status: loanContract.status,
            updatedAt: loanContract.updatedAt,
          })
          .from(loanContract)
          .orderBy(desc(loanContract.updatedAt))
          .limit(100),
      [],
    ),
    safeQuery(() => db.select().from(supportCase).orderBy(desc(supportCase.updatedAt)).limit(100), []),
    safeQuery(() => db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(200), [], 'adminAuditLog'),
  ])

  const primaryBankByUser = new Map<string, (typeof bankAccountRows)[number]>()
  for (const ba of bankAccountRows) {
    const prev = primaryBankByUser.get(ba.userId)
    if (!prev || ba.isPrimary) primaryBankByUser.set(ba.userId, ba)
  }

  const bankById = new Map(bankAccountRows.map((b) => [b.id, b]))

  // --- products ---
  const loansByProduct = new Map<string, typeof loanRows>()
  for (const l of loanRows) {
    if (!l.productId) continue
    const list = loansByProduct.get(l.productId) || []
    list.push(l)
    loansByProduct.set(l.productId, list)
  }

  const products: CreditProduct[] = productRows.map((p) => {
    const tna = num(p.tna)
    const related = loansByProduct.get(p.id) || []
    const avgTea =
      related.length > 0
        ? related.reduce((a, l) => a + num(l.tea || l.tna) * (l.tea ? 1 : 1.1), 0) / related.length
        : tna * 1.1
    const avgCft =
      related.length > 0
        ? related.reduce((a, l) => a + num(l.cft || l.tna) * (l.cft ? 1 : 1.3), 0) / related.length
        : tna * 1.3
    return {
      id: p.id,
      name: p.name,
      type: mapProductType(p.type),
      tna,
      tea: Math.round(avgTea * 1000) / 1000,
      cft: Math.round(avgCft * 1000) / 1000,
      minAmount: num(p.minAmount),
      maxAmount: num(p.maxAmount),
      minInstallments: p.minTerm,
      maxInstallments: p.maxTerm,
      active: Boolean(p.active),
      description: `${p.name} · TNA ${tna}%`,
    }
  })

  // --- operators ---
  const operators: Operator[] = operatorRows.map((o) => ({
    id: o.id,
    name: o.name,
    email: o.email,
    role: mapOperatorRole(o.adminRoleKey),
    initials: initialsFromName(o.name),
    active: !o.banned,
    lastSeen: iso(o.updatedAt) || new Date().toISOString(),
  }))
  const defaultOperatorId = operators[0]?.id || ''

  // --- merchants ---
  const merchants: Merchant[] = merchantRows.map((row) => {
    const m = row.merchant
    return {
      id: m.id,
      name: m.businessName,
      cuit: m.cuit,
      category: m.category || '',
      status: mapMerchantStatus(m.status),
      commissionPct: 0,
      city: m.city || '',
      province: m.province || '',
      contact: m.legalName || m.businessName,
      email: row.email || '',
      phone: m.phone || '',
      originations: 0,
      volume: 0,
      onboardedAt: iso(m.createdAt) || new Date().toISOString(),
    }
  })

  // --- clients ---
  const clients: Client[] = clientRows.map((row) => {
    const { firstName, lastName } = splitName(row.name || '')
    const ba = primaryBankByUser.get(row.userId)
    return {
      id: row.userId,
      firstName,
      lastName,
      dni: row.profile.dni || '',
      cuit: row.profile.cuil || '',
      email: row.email || '',
      phone: row.profile.phone || '',
      address: {
        street: row.profile.address || '',
        city: row.profile.city || '',
        province: row.profile.province || '',
        postalCode: row.profile.postalCode || '',
      },
      cbu: ba?.cbu || ba?.cvu || '',
      bank: ba?.bankName || '',
      kycStatus: mapKycStatus(row.profile.kycStatus),
      score: row.profile.creditScore ?? 500,
      createdAt: iso(row.createdAt) || new Date().toISOString(),
      occupation: row.profile.employmentStatus || '',
      employer: '',
      declaredIncome: num(row.profile.monthlyIncome),
    }
  })
  const clientById = new Map(clients.map((c) => [c.id, c]))

  // --- kyc ---
  const kyc: KycCase[] = kycRows.map((k) => {
    const status = mapKycStatus(k.status)
    return {
      id: k.id,
      clientId: k.userId,
      provider: 'didit' as const,
      status,
      sessionId: k.providerReferenceId || k.id,
      documentType: 'dni' as const,
      liveness: status === 'verified',
      documentMatch: Boolean(k.cuilVerified) || status === 'verified',
      faceMatchScore: k.faceMatchScore == null ? null : num(k.faceMatchScore),
      startedAt: iso(k.createdAt) || new Date().toISOString(),
      completedAt: iso(k.reviewedAt),
      notes: k.rejectionReason || '',
      operatorId: k.reviewedBy || null,
    }
  })

  // --- loans → applications / credits ---
  const appStatuses = new Set(['pending', 'approved', 'rejected', 'cancelled', 'active', 'paid'])
  const creditStatuses = new Set(['approved', 'active', 'paid', 'cancelled'])

  const applications: LoanApplication[] = loanRows
    .filter((l) => appStatuses.has(l.status))
    .map((l) => {
      const status: LoanApplication['status'] =
        l.status === 'pending'
          ? 'pending'
          : l.status === 'rejected'
            ? 'rejected'
            : l.status === 'cancelled'
              ? 'cancelled'
              : 'approved'
      return {
        id: l.id,
        clientId: l.userId,
        productId: l.productId || '',
        merchantId: l.merchantId,
        amount: num(l.principal),
        installments: l.term,
        status,
        purpose: l.purpose || '',
        createdAt: iso(l.createdAt) || new Date().toISOString(),
        decidedAt: l.status === 'pending' ? null : iso(l.updatedAt) || iso(l.disbursedAt),
        operatorId: null,
        notes: l.rejectionReason || '',
      }
    })

  const creditLoans = loanRows.filter((l) => creditStatuses.has(l.status))
  const creditLoanIds = creditLoans.map((l) => l.id)

  const installmentRows =
    creditLoanIds.length === 0
      ? []
      : await safeQuery(
          () =>
            db
              .select()
              .from(installment)
              .where(inArray(installment.loanId, creditLoanIds))
              .orderBy(installment.number),
          [],
        )

  const installmentsByLoan = new Map<string, typeof installmentRows>()
  for (const inst of installmentRows) {
    const list = installmentsByLoan.get(inst.loanId) || []
    list.push(inst)
    installmentsByLoan.set(inst.loanId, list)
  }

  const overdueAmountByCredit = new Map<string, number>()

  const credits: Credit[] = creditLoans.map((l) => {
    const rawSchedule = installmentsByLoan.get(l.id) || []
    const schedule: Installment[] = rawSchedule.map((inst) => {
      const due = inst.dueDate instanceof Date ? inst.dueDate : new Date(inst.dueDate)
      const status = mapInstallmentStatus(inst.status, due, now)
      const amount = num(inst.amount)
      const paidAmount = status === 'paid' ? amount : status === 'partial' ? amount / 2 : 0
      return {
        number: inst.number,
        dueDate: iso(due) || new Date().toISOString(),
        amount,
        paidAmount,
        paidAt: iso(inst.paidAt),
        status,
      }
    })

    let daysPastDue = 0
    let overdueAmount = 0
    for (const s of schedule) {
      if (s.status === 'overdue' || (s.status === 'pending' && new Date(s.dueDate) < now)) {
        const days = Math.max(
          0,
          Math.floor((now.getTime() - new Date(s.dueDate).getTime()) / 86_400_000),
        )
        daysPastDue = Math.max(daysPastDue, days)
        overdueAmount += s.amount - s.paidAmount
      }
    }
    overdueAmountByCredit.set(l.id, overdueAmount)

    const principalOutstanding = schedule
      .filter((s) => s.status !== 'paid')
      .reduce((a, s) => a + (s.amount - s.paidAmount), 0)

    const tna = num(l.tna)
    const tea = l.tea != null ? num(l.tea) : tna * 1.1
    const cft = l.cft != null ? num(l.cft) : tna * 1.3
    const firstDue =
      schedule[0]?.dueDate ||
      iso(l.disbursedAt) ||
      iso(l.createdAt) ||
      new Date().toISOString()

    return {
      id: l.id,
      applicationId: l.id,
      clientId: l.userId,
      productId: l.productId || '',
      merchantId: l.merchantId,
      amount: num(l.principal),
      principalOutstanding,
      installments: l.term,
      installmentAmount: num(l.installmentAmount),
      tna,
      tea,
      cft,
      status: l.status as Credit['status'],
      disbursedAt: iso(l.disbursedAt),
      firstDueDate: firstDue,
      schedule,
      daysPastDue,
      bucket: bucketFromDays(daysPastDue),
    }
  })

  // --- payments ---
  const payments: Payment[] = paymentRows.map((p) => ({
    id: p.id,
    creditId: p.loanId || '',
    clientId: p.userId,
    channel: mapPaymentChannel(p.method),
    status: mapPaymentStatus(p.status),
    amount: num(p.amount),
    paidAt: iso(p.paidAt) || iso(p.createdAt) || new Date().toISOString(),
    mpPaymentId: mapPaymentChannel(p.method) === 'mercadopago' ? p.externalId : null,
    transferCbu: null,
    transferRef: p.referenceNumber,
    matchedBy: p.processedBy,
    notes: p.notes || p.failureReason || '',
  }))

  // --- disbursements ---
  const disbursements: Disbursement[] = disbursementRows.map((d) => {
    const ba = d.bankAccountId ? bankById.get(d.bankAccountId) : primaryBankByUser.get(d.userId)
    return {
      id: d.id,
      creditId: d.loanId,
      clientId: d.userId,
      amount: num(d.amount),
      status: mapDisbursementStatus(d.status),
      cbu: ba?.cbu || ba?.cvu || '',
      bank: ba?.bankName || '',
      requestedAt: iso(d.createdAt) || new Date().toISOString(),
      completedAt: iso(d.creditedAt),
      operatorId: d.processedBy,
      reference: d.referenceNumber,
    }
  })

  // --- audit (needed for collections contacts) ---
  const audit: AdminDeskState['audit'] = auditRows.map((a) => ({
    id: a.id,
    at: iso(a.createdAt) || new Date().toISOString(),
    actorId: a.actorUserId || '',
    action: a.action,
    entity: a.entityType,
    entityId: a.entityId || '',
    detail: a.summary || '',
  }))

  const collectionContactsByCredit = new Map<string, CollectionContact[]>()
  for (const a of auditRows) {
    if (a.action !== 'COLLECTION_CONTACT') continue
    const creditId = a.entityId || ''
    if (!creditId) continue
    const list = collectionContactsByCredit.get(creditId) || []
    const channelRaw = String((a.changes as { channel?: string } | null)?.channel || 'otro')
    const channel: CollectionContact['channel'] =
      channelRaw === 'whatsapp' ||
      channelRaw === 'telefono' ||
      channelRaw === 'email' ||
      channelRaw === 'visita'
        ? channelRaw
        : 'otro'
    list.push({
      at: iso(a.createdAt) || new Date().toISOString(),
      operatorId: a.actorUserId || defaultOperatorId,
      note: a.summary || '',
      channel,
    })
    collectionContactsByCredit.set(creditId, list)
  }

  // --- collections ---
  const collections: CollectionCase[] = []
  for (const c of credits) {
    if (c.status !== 'active') continue
    const hasOverdue = c.schedule.some((s) => s.status === 'overdue') || c.daysPastDue > 0
    if (!hasOverdue) continue
    const contacts = collectionContactsByCredit.get(c.id) || []
    const lastContactAt = contacts.length
      ? [...contacts].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0]?.at || null
      : null
    const lastAudit = auditRows.find(
      (a) => a.action === 'COLLECTION_CONTACT' && a.entityId === c.id,
    )
    const nextFromAudit = String((lastAudit?.changes as { nextAction?: string } | null)?.nextAction || '')
    collections.push({
      id: `col-${c.id}`,
      creditId: c.id,
      clientId: c.clientId,
      bucket: c.bucket,
      overdueAmount:
        overdueAmountByCredit.get(c.id) ??
        c.schedule.filter((s) => s.status === 'overdue').reduce((a, s) => a + s.amount, 0),
      daysPastDue: c.daysPastDue,
      lastContactAt,
      nextAction:
        nextFromAudit ||
        (c.daysPastDue > 90
          ? 'Propuesta de refinanciación'
          : c.daysPastDue > 60
            ? 'Escalamiento cobranza'
            : c.daysPastDue > 30
              ? 'Llamado de gestión'
              : 'WhatsApp de recordatorio'),
      ownerId: defaultOperatorId,
      contacts: [...contacts].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    })
  }

  // --- approvals (pending loans) ---
  const kycByUser = new Map(kyc.map((k) => [k.clientId, k]))
  const approvals: Approval[] = applications
    .filter((a) => a.status === 'pending')
    .map((a) => {
      const client = clientById.get(a.clientId)
      const kycCase = kycByUser.get(a.clientId)
      const score = client?.score ?? 500
      const kycStatus = kycCase?.status || client?.kycStatus || 'pending'
      const policyFlags: string[] = []
      if (kycStatus !== 'verified') policyFlags.push('kyc_incomplete')
      if (score < 500) policyFlags.push('low_score')
      if (score < 400) policyFlags.push('score_reject_zone')
      if (a.amount > 500_000) policyFlags.push('high_ticket')
      return {
        id: `appr-${a.id}`,
        applicationId: a.id,
        clientId: a.clientId,
        decision: 'pending' as const,
        policyFlags,
        assignedTo: defaultOperatorId,
        createdAt: a.createdAt,
        decidedAt: null,
        comment: '',
      }
    })

  // --- receipts ---
  const receipts: Receipt[] = receiptRows.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    disbursementId: r.disbursementId,
    clientId: r.userId,
    type: r.paymentId ? 'cobro' : 'desembolso',
    number: r.receiptNumber,
    amount: num(r.amount),
    issuedAt: iso(r.issuedAt) || new Date().toISOString(),
    cae: null,
  }))

  // --- accounts ---
  const accounts = buildTreasuryAccounts()
  if (accounts.length === 0) {
    const seen = new Set<string>()
    for (const ba of bankAccountRows) {
      const cbu = ba.cbu || ba.cvu || ''
      if (!cbu || seen.has(cbu)) continue
      seen.add(cbu)
      const purpose: BankAccount['purpose'] =
        accounts.length === 0 ? 'desembolsos' : accounts.length === 1 ? 'cobranzas' : 'operativa'
      accounts.push({
        id: ba.id,
        label: ba.bankName || 'Cuenta',
        bank: ba.bankName,
        cbu,
        alias: ba.alias || '',
        currency: 'ARS',
        purpose,
        balance: 0,
        active: Boolean(ba.isActive),
      })
      if (accounts.length >= 3) break
    }
  }

  // --- ledger (last 50 payments as ingreso) ---
  const ledgerAccountId = accounts.find((a) => a.purpose === 'cobranzas')?.id || accounts[0]?.id || 'acc-treasury-cobranzas'
  const ledger: LedgerEntry[] = payments.slice(0, 50).map((p) => ({
    id: `led-${p.id}`,
    date: p.paidAt,
    type: 'ingreso' as const,
    accountId: ledgerAccountId,
    amount: p.amount,
    concept: `Cobro ${p.channel}`,
    counterparty: clientById.get(p.clientId)
      ? `${clientById.get(p.clientId)!.firstName} ${clientById.get(p.clientId)!.lastName}`.trim()
      : p.clientId,
  }))

  // --- cendeu (latest bcraCheck per user) ---
  const latestBcraByUser = new Map<string, (typeof bcraCheckRows)[number]>()
  for (const row of bcraCheckRows) {
    if (!latestBcraByUser.has(row.userId)) latestBcraByUser.set(row.userId, row)
  }
  const cendeu: CendeuReport[] = [...latestBcraByUser.values()].map((row) => {
    const result = mapCendeuResult(row.worstSituation)
    const sit = row.worstSituation ?? 0
    return {
      id: row.id,
      clientId: row.userId,
      consultedAt: iso(row.consultedAt) || iso(row.createdAt) || new Date().toISOString(),
      result,
      score: row.computedScore ?? clientById.get(row.userId)?.score ?? 500,
      sit1: sit === 1 ? 1 : 0,
      sit2: sit === 2 ? 1 : 0,
      sit3: sit === 3 ? 1 : 0,
      sit4: sit === 4 ? 1 : 0,
      sit5: sit >= 5 ? 1 : 0,
      entities: row.entitiesCount ?? 0,
      observations:
        result === 'irregular'
          ? `Situación ${sit} en BCRA`
          : result === 'novedad'
            ? 'Novedad crediticia'
            : result === 'sin_info'
              ? 'Sin información BCRA'
              : 'Sin novedades',
    }
  })

  // --- bcra variables ---
  const bcra: BcraVariable[] = bcraVarRows.map((v) => {
    const nameLower = (v.variableName || '').toLowerCase()
    const unit: BcraVariable['unit'] =
      nameLower.includes('bps') ? 'bps' : nameLower.includes('índice') || nameLower.includes('indice') || nameLower.includes('uva') || nameLower.includes('cer') || nameLower.includes('tipo de cambio')
        ? 'index'
        : '%'
    return {
      id: v.id,
      code: v.idVariable,
      name: v.variableName,
      value: num(v.value),
      unit,
      asOf: iso(v.effectiveDate) || iso(v.updatedAt) || new Date().toISOString(),
      previous: num(v.value),
      source: v.source || 'BCRA',
    }
  })

  // --- contracts ---
  let contracts: ContractTemplate[] = contractRows.map((c) => {
    const relatedLoan = loanRows.find((l) => l.id === c.loanId)
    return {
      id: c.id,
      name: c.templateName || 'Contrato',
      version: c.version || '1.0',
      productId: relatedLoan?.productId || null,
      status: mapContractStatus(c.status),
      updatedAt: iso(c.updatedAt) || new Date().toISOString(),
      clauses: 0,
    }
  })
  if (contracts.length === 0) {
    contracts = [
      {
        id: 'ct-default',
        name: 'Mutuo personal ARS',
        version: '1.0',
        productId: products[0]?.id || null,
        status: 'active',
        updatedAt: new Date().toISOString(),
        clauses: 0,
      },
    ]
  }

  // --- tickets ---
  const tickets: SupportTicket[] = ticketRows.map((t) => ({
    id: t.id,
    clientId: t.userId,
    subject: t.subject,
    channel: mapTicketChannel(t.channel),
    status: mapTicketStatus(t.status),
    priority: 'medium',
    assigneeId: t.assignedAdminId || defaultOperatorId,
    createdAt: iso(t.createdAt) || new Date().toISOString(),
    updatedAt: iso(t.updatedAt) || new Date().toISOString(),
    messages: 1,
  }))

  // --- series (last 31 days) ---
  const series = emptySeries()
  const seriesIndex = new Map(series.map((p, i) => [p.date, i]))

  for (const l of loanRows) {
    const key = dayKey(l.createdAt)
    if (!key) continue
    const idx = seriesIndex.get(key)
    if (idx == null) continue
    series[idx]!.solicitudes += 1
    if (l.status === 'approved' || l.status === 'active' || l.status === 'paid') {
      series[idx]!.aprobadas += 1
    }
    if (l.status === 'rejected') {
      series[idx]!.rechazadas += 1
    }
  }
  for (const p of paymentRows) {
    if ((p.status || '').toLowerCase() !== 'paid' && mapPaymentStatus(p.status) !== 'reconciled') continue
    const key = dayKey(p.paidAt || p.createdAt)
    if (!key) continue
    const idx = seriesIndex.get(key)
    if (idx == null) continue
    series[idx]!.cobrado += num(p.amount)
  }
  for (const d of disbursementRows) {
    const st = mapDisbursementStatus(d.status)
    if (st !== 'completed') continue
    const key = dayKey(d.creditedAt || d.updatedAt || d.createdAt)
    if (!key) continue
    const idx = seriesIndex.get(key)
    if (idx == null) continue
    series[idx]!.desembolsado += num(d.amount)
  }

  return {
    products,
    operators,
    merchants,
    clients,
    kyc,
    applications,
    credits,
    payments,
    disbursements,
    collections,
    approvals,
    receipts,
    accounts,
    ledger,
    cendeu,
    bcra,
    contracts,
    tickets,
    audit,
    config: defaultConfig(),
    series,
  }
}
