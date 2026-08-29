import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  installment,
  kycVerification,
  loan,
  loanContract,
  loanProduct,
  payment,
  paymentReceipt,
  profile,
  supportCase,
  user as userTable,
} from '@/lib/db/schema'
import { ensureLoanContract } from '@/lib/legal/expediente'
import { ensureInstallmentPlan, ensurePendingDisbursement } from '@/lib/loan-schedule'
import { getInbox } from '@/lib/notifications'
import {
  loadWalletSandbox,
  payInstallmentsFromWallet,
  transferFromWallet,
  ensureWalletAccount,
} from '@/lib/payments/wallet'
import { listServicePayments, payServiceFromWallet } from '@/lib/payments/services'
import { SERVICE_CATEGORIES, SERVICE_PROVIDERS } from '@/lib/services/catalog'
import { getRoleForUser, newId } from '@/lib/session'
import { createDiditSession, diditApprovedForUser, isDiditConfigured } from '@/lib/didit'
import { computeFrenchAmortization, frenchAmortizationSchedule } from '@/lib/finance'
import {
  computeCreditOffer,
  decideUnderwriting,
  type AppRepaymentHistory,
} from '@/lib/loan-underwriting'
import { persistBcraConsultation } from '@/lib/bcra-persist'
import { createPaymentLinkMP } from '@/lib/mercadopago'
import { TREASURY_ACCOUNT } from '@/lib/treasury'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'

type OcrBag = Record<string, unknown>

async function loadAppRepaymentHistory(userId: string): Promise<AppRepaymentHistory> {
  const paidRows = await db
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.userId, userId), eq(installment.status, 'paid')))
  const overdueRows = await db
    .select({ id: installment.id })
    .from(installment)
    .where(and(eq(installment.userId, userId), eq(installment.status, 'overdue')))
  const completedRows = await db
    .select({ id: loan.id })
    .from(loan)
    .where(and(eq(loan.userId, userId), eq(loan.status, 'paid')))
  return {
    paidCount: paidRows.length,
    overdueCount: overdueRows.length,
    completedLoans: completedRows.length,
  }
}

async function requireCustomerReadyForCredit(userId: string) {
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!prof) return { ok: false as const, error: 'Completá tu perfil antes de solicitar.', prof: null }
  if (!prof.cuil || !isValidCuit(normalizeCuit(prof.cuil))) {
    return { ok: false as const, error: 'Completá tu CUIL válido antes de solicitar.', prof }
  }
  if (!prof.dni || Number(prof.monthlyIncome ?? 0) <= 0) {
    return { ok: false as const, error: 'Completá DNI e ingresos declarados antes de solicitar.', prof }
  }
  if (prof.kycStatus === 'rejected') {
    return { ok: false as const, error: 'Tu verificación fue rechazada. Reintentá KYC.', prof }
  }
  if (!(await diditApprovedForUser(userId))) {
    return {
      ok: false as const,
      error: 'Verificá tu identidad con Didit antes de solicitar un crédito.',
      prof,
    }
  }
  return { ok: true as const, prof }
}

async function readOcr(userId: string): Promise<OcrBag> {
  const [kyc] = await db
    .select({ ocrData: kycVerification.ocrData })
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  return ((kyc?.ocrData as OcrBag) || {}) as OcrBag
}

async function writeMobileMeta(userId: string, patch: OcrBag) {
  const [kyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const previous = ((kyc?.ocrData as OcrBag) || {}) as OcrBag
  const mobile = { ...((previous.mobile as OcrBag) || {}), ...patch }
  const next = { ...previous, mobile }
  const now = new Date()
  if (kyc) {
    await db
      .update(kycVerification)
      .set({ ocrData: next, updatedAt: now })
      .where(eq(kycVerification.id, kyc.id))
  } else {
    await db.insert(kycVerification).values({
      id: newId('kyc'),
      userId,
      provider: 'mobile',
      status: 'pending',
      ocrData: next,
      createdAt: now,
      updatedAt: now,
    })
  }
  return mobile
}

async function getMobileMeta(userId: string): Promise<OcrBag> {
  const ocr = await readOcr(userId)
  return ((ocr.mobile as OcrBag) || {}) as OcrBag
}

export async function requireMobileAdmin(userId: string) {
  const role = await getRoleForUser(userId)
  if (role !== 'admin') throw new Error('No autorizado')
  return role
}

/* ----------------------------- Loans ------------------------------------ */

export async function mobileListLoans(userId: string, status?: string) {
  const rows = await db.select().from(loan).where(eq(loan.userId, userId)).orderBy(desc(loan.createdAt))
  const filtered = status ? rows.filter((r) => r.status.toLowerCase() === status.toLowerCase()) : rows
  const productIds = [...new Set(filtered.map((l) => l.productId).filter(Boolean))] as string[]
  const products = productIds.length
    ? await db.select().from(loanProduct).where(inArray(loanProduct.id, productIds))
    : []
  const pmap = new Map(products.map((p) => [p.id, p]))
  return {
    items: filtered.map((l) => ({
      id: l.id,
      productName: (l.productId && pmap.get(l.productId)?.name) || l.type || 'Préstamo',
      requestedAmount: Number(l.principal),
      approvedAmount: Number(l.principal),
      termMonths: l.term,
      monthlyPayment: Number(l.installmentAmount),
      status: String(l.status).toUpperCase(),
      applicationDate: l.createdAt ? new Date(l.createdAt).toISOString() : null,
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
    })),
  }
}

export async function mobileLoanDetail(userId: string, id: string) {
  const [l] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, id), eq(loan.userId, userId)))
    .limit(1)
  if (!l) throw new Error('Préstamo no encontrado')
  const [prod] = l.productId
    ? await db.select().from(loanProduct).where(eq(loanProduct.id, l.productId)).limit(1)
    : [null]
  const insts = await db
    .select()
    .from(installment)
    .where(eq(installment.loanId, id))
    .orderBy(asc(installment.number))
  const [contract] = await db.select().from(loanContract).where(eq(loanContract.loanId, id)).limit(1)
  const pending = insts.filter((i) => i.status === 'pending' || i.status === 'overdue')
  const remaining = pending.reduce((s, i) => s + Number(i.amount), 0)
  return {
    id: l.id,
    productName: prod?.name ?? l.type,
    creditProductId: l.productId,
    requestedAmount: Number(l.principal),
    approvedAmount: Number(l.principal),
    termMonths: l.term,
    monthlyPayment: Number(l.installmentAmount),
    interestRate: Number(l.tna),
    cftRate: l.cft != null ? Number(l.cft) : null,
    totalPayment: Number(l.totalAmount),
    remainingBalance: Math.round(remaining * 100) / 100,
    status: String(l.status).toUpperCase(),
    applicationDate: l.createdAt ? new Date(l.createdAt).toISOString() : null,
    approvalDate: null,
    disbursementDate: l.disbursedAt ? new Date(l.disbursedAt).toISOString() : null,
    contractSigned: contract?.status === 'accepted',
    contractSignedAt: contract?.acceptedAt ? new Date(contract.acceptedAt).toISOString() : null,
    rejectionReason: l.rejectionReason,
    installments: insts.map((i) => ({
      id: i.id,
      number: i.number,
      amount: Number(i.amount),
      principal: null,
      interest: null,
      dueDate: i.dueDate ? new Date(i.dueDate as Date).toISOString() : null,
      paidDate: i.paidAt ? new Date(i.paidAt as Date).toISOString() : null,
      paidAmount: i.status === 'paid' ? Number(i.amount) : null,
      status: String(i.status).toUpperCase(),
    })),
    createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
  }
}

export async function mobileLoanContract(userId: string, loanId: string) {
  const [l] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!l) throw new Error('Préstamo no encontrado')
  let [contract] = await db.select().from(loanContract).where(eq(loanContract.loanId, loanId)).limit(1)
  if (!contract && (l.status === 'approved' || l.status === 'active')) {
    await db.transaction(async (tx) => {
      await ensureLoanContract(
        tx,
        { id: loanId, userId, type: l.type, status: l.status },
        { generatedBy: 'mobile', now: new Date() },
      )
    })
    ;[contract] = await db.select().from(loanContract).where(eq(loanContract.loanId, loanId)).limit(1)
  }
  return {
    contractText: `Contrato de mutuo UNICRÉDITOS · préstamo ${loanId} · ver PDF en /dashboard/documentos/contrato/${contract?.id ?? ''}`,
    contractId: contract?.id ?? null,
    documentUrl: contract?.id ? `/dashboard/documentos/contrato/${contract.id}` : null,
    signed: contract?.status === 'accepted',
    signedAt: contract?.acceptedAt ? new Date(contract.acceptedAt).toISOString() : null,
  }
}

export async function mobileSignLoan(userId: string, loanId: string, opts?: { ip?: string; ua?: string }) {
  const [contract] = await db
    .select()
    .from(loanContract)
    .where(and(eq(loanContract.loanId, loanId), eq(loanContract.userId, userId)))
    .limit(1)
  if (!contract) throw new Error('Contrato no encontrado. Esperá la aprobación.')
  if (contract.status === 'accepted') {
    return { success: true, signedAt: contract.acceptedAt ? new Date(contract.acceptedAt).toISOString() : new Date().toISOString() }
  }

  const [ident] = await db
    .select({ cuil: profile.cuil, fullName: userTable.name })
    .from(profile)
    .innerJoin(userTable, eq(userTable.id, profile.userId))
    .where(eq(profile.userId, userId))
    .limit(1)

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(loanContract)
      .set({
        status: 'accepted',
        acceptedAt: now,
        acceptedIp: opts?.ip ?? null,
        acceptedUserAgent: opts?.ua ?? null,
        signatureType: 'clickwrap',
        signerName: ident?.fullName ?? null,
        signerCuil: ident?.cuil ?? null,
        updatedAt: now,
      })
      .where(eq(loanContract.id, contract.id))

    const [loanFull] = await tx
      .select()
      .from(loan)
      .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
      .limit(1)
    if (loanFull && loanFull.status === 'approved') {
      await ensureInstallmentPlan(tx, {
        loanId: loanFull.id,
        userId,
        principal: Number(loanFull.principal),
        term: loanFull.term,
        monthlyRate: Number(loanFull.monthlyRate),
        from: now,
      })
      await ensurePendingDisbursement(tx, {
        loanId: loanFull.id,
        userId,
        amount: Number(loanFull.principal),
        now,
      })
    }
  })

  return { success: true, signedAt: now.toISOString() }
}

export async function mobileApplyLoan(
  userId: string,
  input: {
    creditProductId: string
    requestedAmount: number
    termMonths: number
    employmentType?: string
    monthlyIncome?: number
    purpose?: string
    bankName?: string
    cbu?: string
    employer?: string
    documentFileIds?: string[]
  },
) {
  const ready = await requireCustomerReadyForCredit(userId)
  if (!ready.ok) throw new Error(ready.error || 'Completá tu perfil y KYC antes de solicitar.')

  const purpose = (input.purpose || 'Crédito personal solicitado desde la app').trim()
  const productId = input.creditProductId
  const [product] = await db.select().from(loanProduct).where(eq(loanProduct.id, productId)).limit(1)
  if (!product?.active) throw new Error('Producto no disponible')

  const amount = Math.round(Number(input.requestedAmount))
  const term = Math.round(Number(input.termMonths))
  if (term < product.minTerm || term > product.maxTerm) {
    throw new Error(`Plazo fuera de rango (${product.minTerm}-${product.maxTerm})`)
  }

  if (input.monthlyIncome && Number(input.monthlyIncome) > 0) {
    await db
      .update(profile)
      .set({
        monthlyIncome: String(Number(input.monthlyIncome)),
        employmentStatus: input.employmentType || undefined,
        updatedAt: new Date(),
      })
      .where(eq(profile.userId, userId))
  }

  if (input.bankName || input.cbu || input.employer) {
    await writeMobileMeta(userId, {
      disbursement: {
        bankName: input.bankName || null,
        cbu: input.cbu || null,
        employer: input.employer || null,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const monthlyIncome = Number(prof?.monthlyIncome ?? input.monthlyIncome ?? 0)
  const monthlyRate = Number(product.monthlyRate)
  const consulted = await persistBcraConsultation({
    userId,
    cuil: prof!.cuil!,
    monthlyIncome,
  })
  if (!consulted.ok) throw new Error(consulted.error)

  const score = consulted.score
  const history = await loadAppRepaymentHistory(userId)
  const offer = computeCreditOffer({
    score: score.score,
    monthlyIncome,
    term,
    monthlyRate,
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    history,
  })

  if (!offer.eligible || amount < Number(product.minAmount) || amount > offer.maxAmount) {
    const loanId = newId('loan')
    const amort = computeFrenchAmortization(Number(product.minAmount), term, monthlyRate)
    await db.insert(loan).values({
      id: loanId,
      userId,
      productId: product.id,
      type: product.type,
      principal: String(amount || product.minAmount),
      term,
      monthlyRate: String(monthlyRate),
      tna: String(amort.tna),
      installmentAmount: String(amort.installmentAmount),
      totalAmount: String(amort.totalAmount),
      cft: String(amort.cft),
      status: 'rejected',
      purpose,
      scoreAtApproval: score.score,
      rejectionReason: offer.reason || 'Fuera de oferta',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return { id: loanId, status: 'REJECTED', applicationDate: new Date().toISOString() }
  }

  const amort = computeFrenchAmortization(amount, term, monthlyRate)
  const decision = decideUnderwriting({
    score,
    installmentAmount: amort.installmentAmount,
    monthlyIncome,
    worstSituation: consulted.snapshot.deudas.worstSituation,
    rejectedChecksCount: consulted.snapshot.chequesRechazados.count,
  })
  const status =
    decision.outcome === 'rejected' ? 'rejected' : decision.outcome === 'pending_review' ? 'pending' : 'approved'
  const loanId = newId('loan')
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(loan).values({
      id: loanId,
      userId,
      productId: product.id,
      type: product.type,
      principal: String(amount),
      term,
      monthlyRate: String(monthlyRate),
      tna: String(amort.tna),
      installmentAmount: String(amort.installmentAmount),
      totalAmount: String(amort.totalAmount),
      cft: String(amort.cft),
      status,
      purpose,
      scoreAtApproval: score.score,
      rejectionReason: status === 'rejected' ? decision.reason : null,
      createdAt: now,
      updatedAt: now,
    })
    if (status === 'approved') {
      await ensureLoanContract(
        tx,
        { id: loanId, userId, type: product.type, status: 'approved' },
        { generatedBy: 'mobile_auto', now },
      )
    }
  })

  return { id: loanId, status: status.toUpperCase(), applicationDate: now.toISOString() }
}

export async function mobileCalculateCredit(input: {
  creditProductId: string
  amount: number
  termMonths: number
}) {
  const [product] = await db.select().from(loanProduct).where(eq(loanProduct.id, input.creditProductId)).limit(1)
  if (!product) throw new Error('Producto no encontrado')
  const amount = Number(input.amount)
  const termMonths = Number(input.termMonths)
  const monthlyRate = Number(product.monthlyRate)
  const amort = computeFrenchAmortization(amount, termMonths, monthlyRate)
  const schedule = frenchAmortizationSchedule(amount, monthlyRate, termMonths)
  return {
    monthlyPayment: amort.installmentAmount,
    totalPayment: amort.totalAmount,
    totalInterest: amort.totalInterest,
    tnaRate: amort.tna / 100,
    cftRate: amort.cft / 100,
    adminFee: 0,
    amortizationSchedule: schedule.map((row) => ({
      number: row.number,
      payment: row.installment,
      principal: row.capital,
      interest: row.interest,
      remainingBalance: row.balance,
    })),
  }
}

/* ----------------------------- Payments --------------------------------- */

export async function mobileCreatePayment(
  userId: string,
  input: { installmentId: string; loanId: string; amount: number; method: string },
) {
  const [inst] = await db
    .select()
    .from(installment)
    .where(and(eq(installment.id, input.installmentId), eq(installment.userId, userId)))
    .limit(1)
  if (!inst) throw new Error('Cuota no encontrada')

  const method = String(input.method || 'mercado_pago')
  if (method === 'payway_wallet' || method === 'wallet') {
    const result = await payInstallmentsFromWallet(userId, [input.installmentId])
    return {
      id: result.paymentId,
      status: 'APPROVED',
      externalReference: null,
      externalPaymentUrl: null,
      qrCodeData: null,
      bankCbu: null,
      bankReference: null,
      credited: result.credited,
    }
  }

  const amount = Number(input.amount) || Number(inst.amount)
  const paymentId = newId('pay')
  const now = new Date()
  await db.insert(payment).values({
    id: paymentId,
    userId,
    loanId: input.loanId || inst.loanId,
    installmentId: inst.id,
    amount: String(amount),
    method: 'mercado_pago',
    gateway: 'mercado_pago',
    status: 'pending',
    currency: 'ARS',
    source: 'mobile',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    gatewayResponse: { installment_ids: [inst.id], source: 'mobile' },
  })

  try {
    const [usr] = await db.select({ email: userTable.email, name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1)
    const pref = await createPaymentLinkMP({
      amount,
      userId,
      externalReference: paymentId,
      payerEmail: usr?.email,
      installmentsIds: [inst.id],
      loanId: inst.loanId,
      itemsTitle: `UNICRÉDITOS · Cuota #${inst.number}`,
    })
    await db
      .update(payment)
      .set({
        paymentLinkId: pref.preferenceId,
        paymentLinkUrl: pref.initPoint || pref.sandboxInitPoint,
        updatedAt: new Date(),
      })
      .where(eq(payment.id, paymentId))
    return {
      id: paymentId,
      status: 'PENDING',
      externalReference: pref.preferenceId,
      externalPaymentUrl: pref.initPoint || pref.sandboxInitPoint,
      qrCodeData: null,
      bankCbu: TREASURY_ACCOUNT.cbu,
      bankReference: paymentId.slice(-8).toUpperCase(),
    }
  } catch {
    return {
      id: paymentId,
      status: 'PENDING',
      externalReference: paymentId,
      externalPaymentUrl: `https://www.unicreditos.com/pagar/${inst.id}`,
      qrCodeData: null,
      bankCbu: TREASURY_ACCOUNT.cbu,
      bankReference: paymentId.slice(-8).toUpperCase(),
    }
  }
}

export async function mobilePaymentHistory(userId: string, page = 1, limit = 20) {
  const offset = (Math.max(1, page) - 1) * limit
  const rows = await db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(desc(payment.createdAt))
    .limit(limit)
    .offset(offset)
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payment)
    .where(eq(payment.userId, userId))
  return {
    items: rows.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      status: String(p.status).toUpperCase(),
      installmentNumber: null,
      loanProductName: 'Préstamo',
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    })),
    total: Number(n),
    page,
    totalPages: Math.max(1, Math.ceil(Number(n) / limit)),
  }
}

export async function mobilePaymentReceipt(userId: string, id: string) {
  const [rcpt] = await db
    .select()
    .from(paymentReceipt)
    .where(and(eq(paymentReceipt.id, id), eq(paymentReceipt.userId, userId)))
    .limit(1)
  if (rcpt) {
    return {
      id: rcpt.id,
      amount: Number(rcpt.amount),
      method: rcpt.method,
      status: 'PAID',
      externalReference: rcpt.receiptNumber,
      installmentNumber: null,
      loanProductName: 'UNICRÉDITOS',
      paidAt: rcpt.paidAt
        ? new Date(rcpt.paidAt).toISOString()
        : rcpt.createdAt
          ? new Date(rcpt.createdAt).toISOString()
          : null,
      receiptFileUrl: `/dashboard/documentos/recibo/${rcpt.id}`,
    }
  }
  const [pay] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.id, id), eq(payment.userId, userId)))
    .limit(1)
  if (!pay) throw new Error('Comprobante no encontrado')
  return {
    id: pay.id,
    amount: Number(pay.amount),
    method: pay.method,
    status: String(pay.status).toUpperCase(),
    externalReference: pay.paymentLinkId,
    installmentNumber: null,
    loanProductName: 'UNICRÉDITOS',
    paidAt: pay.paidAt ? new Date(pay.paidAt).toISOString() : null,
    receiptFileUrl: null,
  }
}

/* ----------------------------- Profile / KYC ---------------------------- */

export async function mobileUpdateProfile(
  userId: string,
  input: Record<string, unknown>,
) {
  const nameParts = [input.firstName, input.lastName].filter(Boolean).map(String)
  if (nameParts.length) {
    await db
      .update(userTable)
      .set({ name: nameParts.join(' '), updatedAt: new Date() })
      .where(eq(userTable.id, userId))
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (input.dni != null) patch.dni = String(input.dni)
  if (input.cuil != null) patch.cuil = String(input.cuil)
  if (input.phone != null) patch.phone = String(input.phone)
  if (input.birthDate != null) patch.birthDate = String(input.birthDate)
  if (input.address != null) patch.address = String(input.address)
  if (input.city != null) patch.city = String(input.city)
  if (input.province != null) patch.province = String(input.province)
  if (input.postalCode != null) patch.postalCode = String(input.postalCode)
  if (input.employmentType != null) patch.employmentStatus = String(input.employmentType)
  if (input.monthlyIncome != null) patch.monthlyIncome = String(Number(input.monthlyIncome))
  await db.update(profile).set(patch as any).where(eq(profile.userId, userId))
  if (input.phone != null) {
    await db
      .update(userTable)
      .set({ phoneNumber: String(input.phone), updatedAt: new Date() })
      .where(eq(userTable.id, userId))
  }
  return mobileFullProfile(userId)
}

export async function mobileFullProfile(userId: string) {
  const [usr] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const parts = (usr?.name || '').split(/\s+/)
  return {
    id: usr?.id,
    email: usr?.email,
    name: usr?.name,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
    dni: prof?.dni ?? null,
    cuil: prof?.cuil ?? null,
    phone: usr?.phoneNumber ?? prof?.phone ?? null,
    birthDate: prof?.birthDate ?? null,
    address: prof?.address ?? null,
    city: prof?.city ?? null,
    province: prof?.province ?? null,
    postalCode: prof?.postalCode ?? null,
    employmentType: prof?.employmentStatus ?? null,
    monthlyIncome: prof?.monthlyIncome != null ? Number(prof.monthlyIncome) : null,
    employer: null,
    identityVerified: prof?.kycStatus === 'approved',
    creditScore: prof?.creditScore ?? null,
    availableCreditLine: null,
    status: usr?.banned ? 'BANNED' : !prof?.dni || !prof?.cuil ? 'PENDING_VERIFICATION' : 'ACTIVE',
    kycStatus: prof?.kycStatus ?? 'pending',
    role: prof?.role ?? usr?.role ?? 'customer',
    termsAccepted: true,
    termsAcceptedAt: null,
    createdAt: usr?.createdAt ? new Date(usr.createdAt).toISOString() : null,
  }
}

export async function mobileListDocuments(userId: string) {
  const meta = await getMobileMeta(userId)
  const files = Array.isArray(meta.files) ? (meta.files as OcrBag[]) : []
  return {
    items: files.map((f) => ({
      id: String(f.id),
      type: String(f.documentType || 'other'),
      fileName: String(f.fileName || 'archivo'),
      fileId: String(f.id),
      fileUrl: f.url ? String(f.url) : null,
      createdAt: String(f.createdAt || new Date().toISOString()),
    })),
  }
}

export async function mobileVerifyIdentity(
  userId: string,
  _input: { selfieFileId?: string; dniFrontFileId?: string; dniBackFileId?: string },
) {
  if (!isDiditConfigured()) {
    await db
      .update(profile)
      .set({ kycStatus: 'reviewing', updatedAt: new Date() })
      .where(eq(profile.userId, userId))
    return { success: true, verificationId: newId('kyc'), url: null }
  }
  const [usr] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  const session = await createDiditSession({
    vendorData: userId,
    contactDetails: { email: usr?.email },
  })
  return { success: true, verificationId: session.sessionId, url: session.url }
}

/* ----------------------------- Wallet ops ------------------------------- */

export async function mobileWalletTopup(userId: string, amount: number) {
  try {
    const wallet = await loadWalletSandbox(userId, amount)
    return {
      ok: true,
      balance: wallet.balance,
      movementId: wallet.movements[0]?.id ?? `sandbox-${Date.now()}`,
    }
  } catch (err) {
    // Producción: el ingreso real llega por CVU/alias (Payway inbound). No simular.
    const wallet = await ensureWalletAccount(userId)
    const msg = err instanceof Error ? err.message : 'Carga no disponible'
    if (/sandbox|producción|produccion|Payway/i.test(msg)) {
      throw new Error(
        `En producción el dinero se acredita al transferir a tu CVU (${wallet.cvu}) o alias (${wallet.alias}). Copiá los datos desde Ingresar.`,
      )
    }
    throw err
  }
}

export async function mobileWalletTransfer(userId: string, amount: number, destination: string, concept?: string) {
  const wallet = await transferFromWallet(userId, amount, destination, concept)
  return {
    ok: true,
    balance: wallet.balance,
    reference: wallet.movements[0]?.reference ?? null,
    destinationHolder: null,
  }
}

export async function mobileWalletPayout(
  userId: string,
  input: { amount: number; destinationKind: string; destinationValue: string; concept?: string },
) {
  const dest =
    input.destinationKind === 'alias'
      ? input.destinationValue
      : input.destinationValue
  const wallet = await transferFromWallet(userId, input.amount, dest, input.concept || 'Retiro')
  return {
    id: wallet.movements[0]?.id ?? newId('payout'),
    status: 'PENDING',
    amount: input.amount,
    reference: wallet.movements[0]?.reference ?? null,
  }
}

export async function mobileWalletPayInstallments(userId: string, installmentIds: string[]) {
  const result = await payInstallmentsFromWallet(userId, installmentIds)
  const wallet = await ensureWalletAccount(userId)
  return {
    ok: true,
    paymentId: result.paymentId,
    amount: result.amount ?? result.credited,
    balance: result.balance ?? wallet.balance,
    installmentIds,
  }
}

/* ----------------------------- Services --------------------------------- */

export function mobileServicesCatalog() {
  return {
    categories: SERVICE_CATEGORIES.map((c) => ({ id: c.id, name: c.label, label: c.label, blurb: c.blurb })),
    providers: SERVICE_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      kind: p.kind,
      minAmount: p.minAmount,
      maxAmount: p.maxAmount,
      accountHint: p.accountHint,
    })),
    items: SERVICE_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
    })),
  }
}

export async function mobileServicesMine(userId: string) {
  const items = await listServicePayments(userId)
  return { items }
}

export async function mobileServicesPay(
  userId: string,
  input: { providerId: string; accountRef: string; amount: number },
) {
  const result = await payServiceFromWallet({
    userId,
    providerId: input.providerId,
    accountRef: input.accountRef,
    amount: input.amount,
  })
  return {
    id: result.id,
    reference: result.reference,
    operationId: result.operationId,
    authCode: result.authCode,
    amount: result.amount,
    balanceAfter: result.balanceAfter,
    status: result.status,
    providerName: result.providerName,
    accountRef: result.accountRef,
    category: result.category,
    kind: result.kind,
    paidAt: result.paidAt,
    message: 'Pago registrado',
  }
}

/* ----------------------------- Notifications ---------------------------- */

export async function mobileNotifications(userId: string, page = 1, limit = 20) {
  const role = await getRoleForUser(userId)
  const inbox = await getInbox(userId, role)
  const meta = await getMobileMeta(userId)
  const readIds = new Set(
    Array.isArray(meta.readNotificationIds) ? (meta.readNotificationIds as string[]) : [],
  )
  const all = inbox.items.map((it) => ({
    id: it.id,
    title: it.title,
    message: it.detail,
    type: it.tone,
    read: readIds.has(it.id),
    readAt: readIds.has(it.id) ? new Date().toISOString() : null,
    data: { href: it.href },
    createdAt: it.at,
  }))
  const start = (page - 1) * limit
  const slice = all.slice(start, start + limit)
  return { items: slice, total: all.length, page, totalPages: Math.max(1, Math.ceil(all.length / limit)) }
}

export async function mobileNotificationRead(userId: string, id: string) {
  const meta = await getMobileMeta(userId)
  const readIds = Array.isArray(meta.readNotificationIds) ? [...(meta.readNotificationIds as string[])] : []
  if (!readIds.includes(id)) readIds.push(id)
  await writeMobileMeta(userId, { readNotificationIds: readIds })
  return { success: true }
}

export async function mobileNotificationReadAll(userId: string) {
  const role = await getRoleForUser(userId)
  const inbox = await getInbox(userId, role)
  await writeMobileMeta(userId, { readNotificationIds: inbox.items.map((it) => it.id) })
  return { success: true }
}

export async function mobileGetNotifPrefs(userId: string) {
  const meta = await getMobileMeta(userId)
  const prefs = (meta.notifPrefs as OcrBag) || {}
  return {
    paymentReminders: prefs.paymentReminders !== false,
    loanUpdates: prefs.loanUpdates !== false,
    offers: prefs.offers === true,
  }
}

export async function mobileSetNotifPrefs(userId: string, input: OcrBag) {
  const current = await mobileGetNotifPrefs(userId)
  const next = { ...current, ...input }
  await writeMobileMeta(userId, { notifPrefs: next })
  return next
}

/* ----------------------------- Support / FAQ ---------------------------- */

export async function mobileSupportList(userId: string, page = 1, limit = 50) {
  const rows = await db
    .select()
    .from(supportCase)
    .where(and(eq(supportCase.userId, userId), eq(supportCase.category, 'mobile_chat')))
    .orderBy(asc(supportCase.createdAt))
  const items: { id: string; message: string; isFromUser: boolean; createdAt: string }[] = []
  for (const r of rows) {
    items.push({
      id: r.id,
      message: r.body,
      isFromUser: true,
      createdAt: r.createdAt.toISOString(),
    })
    if (r.response) {
      items.push({
        id: `${r.id}_bot`,
        message: r.response,
        isFromUser: false,
        createdAt: (r.respondedAt || r.createdAt).toISOString(),
      })
    }
  }
  const start = (page - 1) * limit
  const slice = items.slice(start, start + limit)
  return { items: slice, total: items.length, page, totalPages: Math.max(1, Math.ceil(items.length / limit)) }
}

export async function mobileSupportPost(userId: string, message: string) {
  const now = new Date()
  const id = newId('sup')
  const auto =
    'Gracias por escribirnos. Un asesor de UNICRÉDITOS te responderá a la brevedad. También podés gestionar tu cuenta en www.unicreditos.com.'
  await db.insert(supportCase).values({
    id,
    userId,
    category: 'mobile_chat',
    subject: 'Chat app',
    body: message,
    status: 'open',
    channel: 'mobile',
    response: auto,
    respondedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  return { id, message, isFromUser: true, createdAt: now.toISOString() }
}

/* ----------------------------- Upload / push ---------------------------- */

export async function mobilePresign(userId: string, input: { fileName: string; contentType: string }) {
  const path = `mobile/${userId}/${Date.now()}_${input.fileName.replace(/[^\w.\-]+/g, '_')}`
  const base =
    (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'https://www.unicreditos.com').replace(
      /\/+$/,
      '',
    )
  return {
    uploadUrl: `${base}/api/upload/put?path=${encodeURIComponent(path)}`,
    cloud_storage_path: path,
  }
}

export async function mobileStoreUploadBlob(
  userId: string,
  path: string,
  contentType: string,
  dataBase64: string,
) {
  if (!path.startsWith(`mobile/${userId}/`)) throw new Error('Path inválido')
  if (dataBase64.length > 5_500_000) throw new Error('Archivo demasiado grande (máx. ~4MB)')
  const meta = await getMobileMeta(userId)
  const pending = { ...((meta.pendingUploads as OcrBag) || {}) }
  pending[path] = {
    contentType,
    dataBase64,
    createdAt: new Date().toISOString(),
  }
  await writeMobileMeta(userId, { pendingUploads: pending })
  return { ok: true, path }
}

export async function mobileUploadComplete(
  userId: string,
  input: { cloud_storage_path: string; documentType?: string; loanId?: string; fileName?: string },
) {
  const id = newId('file')
  const meta = await getMobileMeta(userId)
  const pending = { ...((meta.pendingUploads as OcrBag) || {}) }
  const blob = pending[input.cloud_storage_path] as OcrBag | undefined
  const files = Array.isArray(meta.files) ? [...(meta.files as OcrBag[])] : []
  const contentType = String(blob?.contentType || 'application/octet-stream')
  const dataBase64 = typeof blob?.dataBase64 === 'string' ? blob.dataBase64 : null
  const url = dataBase64 ? `data:${contentType};base64,${dataBase64}` : null
  const row = {
    id,
    path: input.cloud_storage_path,
    fileName: input.fileName || input.cloud_storage_path.split('/').pop(),
    documentType: input.documentType || 'other',
    loanId: input.loanId || null,
    url,
    contentType,
    createdAt: new Date().toISOString(),
  }
  files.push(row)
  if (blob) delete pending[input.cloud_storage_path]
  await writeMobileMeta(userId, { files, pendingUploads: pending })
  return { id, cloud_storage_path: input.cloud_storage_path }
}

export async function mobileFileUrl(userId: string, id: string) {
  const meta = await getMobileMeta(userId)
  const files = Array.isArray(meta.files) ? (meta.files as OcrBag[]) : []
  const f = files.find((x) => String(x.id) === id)
  if (!f) throw new Error('Archivo no encontrado')
  return { url: f.url || `https://www.unicreditos.com/api/files/${id}/url` }
}

export async function mobileFileDelete(userId: string, id: string) {
  const meta = await getMobileMeta(userId)
  const files = Array.isArray(meta.files) ? (meta.files as OcrBag[]) : []
  await writeMobileMeta(userId, { files: files.filter((x) => String(x.id) !== id) })
  return { success: true }
}

export async function mobilePushRegister(userId: string, token: string, deviceType?: string) {
  const meta = await getMobileMeta(userId)
  const tokens = Array.isArray(meta.pushTokens) ? [...(meta.pushTokens as OcrBag[])] : []
  if (!tokens.some((t) => t.token === token)) {
    tokens.push({ token, deviceType: deviceType || 'unknown', createdAt: new Date().toISOString() })
  }
  await writeMobileMeta(userId, { pushTokens: tokens })
  return { success: true }
}

export async function mobilePushDelete(userId: string, token: string) {
  const meta = await getMobileMeta(userId)
  const tokens = Array.isArray(meta.pushTokens) ? (meta.pushTokens as OcrBag[]) : []
  await writeMobileMeta(userId, { pushTokens: tokens.filter((t) => t.token !== token) })
  return { success: true }
}

/* ----------------------------- Admin ------------------------------------ */

export async function mobileAdminDashboard() {
  const [{ users }] = await db.select({ users: sql<number>`count(*)::int` }).from(userTable)
  const loans = await db.select({ status: loan.status }).from(loan)
  const pending = loans.filter((l) => l.status === 'pending').length
  const active = loans.filter((l) => l.status === 'active' || l.status === 'disbursed').length
  const rejected = loans.filter((l) => l.status === 'rejected').length
  const paid = loans.filter((l) => l.status === 'paid').length
  const [{ kycPending }] = await db
    .select({ kycPending: sql<number>`count(*)::int` })
    .from(profile)
    .where(inArray(profile.kycStatus, ['pending', 'reviewing']))
  return {
    totalUsers: Number(users),
    totalLoans: loans.length,
    activeLoans: active,
    pendingLoans: pending,
    paidLoans: paid,
    rejectedLoans: rejected,
    portfolioOutstanding: 0,
    portfolioOverdue: 0,
    collectedThisMonth: 0,
    disbursedThisMonth: 0,
    delinquencyRate: 0,
    pendingKyc: Number(kycPending),
  }
}

export async function mobileAdminLoans(status?: string, page = 1, limit = 50) {
  const rows = await db.select().from(loan).orderBy(desc(loan.createdAt)).limit(500)
  const filtered = status ? rows.filter((r) => r.status === status) : rows
  const start = (page - 1) * limit
  const slice = filtered.slice(start, start + limit)
  const userIds = [...new Set(slice.map((l) => l.userId))]
  const users = userIds.length
    ? await db.select().from(userTable).where(inArray(userTable.id, userIds))
    : []
  const umap = new Map(users.map((u) => [u.id, u]))
  return {
    items: slice.map((l) => {
      const u = umap.get(l.userId)
      return {
        id: l.id,
        userId: l.userId,
        userName: u?.name ?? '',
        userEmail: u?.email ?? '',
        productName: l.type,
        principal: Number(l.principal),
        term: l.term,
        installmentAmount: Number(l.installmentAmount),
        outstanding: Number(l.totalAmount),
        overdueCount: 0,
        status: l.status,
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
      }
    }),
    total: filtered.length,
  }
}

export async function mobileAdminApproveLoan(adminId: string, id: string) {
  const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(loan)
      .set({ status: 'approved', rejectionReason: null, updatedAt: now })
      .where(eq(loan.id, id))
    await ensureLoanContract(
      tx,
      { id, userId: existing.userId, type: existing.type, status: 'approved' },
      { generatedBy: adminId, now },
    )
  })
  return { success: true, message: 'Préstamo aprobado' }
}

export async function mobileAdminRejectLoan(_adminId: string, id: string, reason: string) {
  await db
    .update(loan)
    .set({ status: 'rejected', rejectionReason: reason || 'Rechazado', updatedAt: new Date() })
    .where(eq(loan.id, id))
  return { success: true, message: 'Préstamo rechazado' }
}

export async function mobileAdminDisburseLoan(adminId: string, id: string) {
  const [existing] = await db.select().from(loan).where(eq(loan.id, id)).limit(1)
  if (!existing) throw new Error('Préstamo no encontrado')
  if (existing.status !== 'approved' && existing.status !== 'active') {
    throw new Error('Solo se desembolsan créditos aprobados')
  }
  const now = new Date()
  await db.transaction(async (tx) => {
    await ensureLoanContract(
      tx,
      { id, userId: existing.userId, type: existing.type, status: existing.status },
      { generatedBy: adminId, now },
    )
    await ensurePendingDisbursement(tx, {
      loanId: id,
      userId: existing.userId,
      amount: Number(existing.principal),
      now,
    })
    await tx.update(loan).set({ status: 'active', disbursedAt: now, updatedAt: now }).where(eq(loan.id, id))
  })
  return { success: true, message: 'Desembolso registrado' }
}

export async function mobileAdminCustomers(search?: string, page = 1, limit = 50) {
  const users = await db.select().from(userTable).orderBy(desc(userTable.createdAt)).limit(500)
  const profiles = await db.select().from(profile)
  const pmap = new Map(profiles.map((p) => [p.userId, p]))
  let rows = users.map((u) => {
    const p = pmap.get(u.id)
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phoneNumber ?? p?.phone ?? null,
      dni: p?.dni ?? null,
      cuil: p?.cuil ?? null,
      role: p?.role ?? u.role,
      kycStatus: p?.kycStatus ?? 'pending',
      creditScore: p?.creditScore ?? null,
      loansCount: 0,
      outstanding: 0,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    }
  })
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.dni?.includes(q) ||
        r.cuil?.includes(q),
    )
  }
  const start = (page - 1) * limit
  return { items: rows.slice(start, start + limit), total: rows.length }
}

export async function mobileAdminSetScore(_adminId: string, customerId: string, score: number) {
  if (score < 300 || score > 950) throw new Error('Score inválido')
  await db.update(profile).set({ creditScore: score, updatedAt: new Date() }).where(eq(profile.userId, customerId))
  return { success: true, message: 'Score actualizado' }
}

export async function mobileAdminKycApprove(_adminId: string, customerId: string) {
  await db.update(profile).set({ kycStatus: 'approved', updatedAt: new Date() }).where(eq(profile.userId, customerId))
  await db
    .update(kycVerification)
    .set({ status: 'approved', updatedAt: new Date(), reviewedBy: 'mobile_admin', reviewedAt: new Date() })
    .where(eq(kycVerification.userId, customerId))
  return { success: true, message: 'KYC aprobado' }
}

export async function mobileAdminKycReject(_adminId: string, customerId: string, reason: string) {
  await db.update(profile).set({ kycStatus: 'rejected', updatedAt: new Date() }).where(eq(profile.userId, customerId))
  await db
    .update(kycVerification)
    .set({
      status: 'rejected',
      rejectionReason: reason || 'Rechazado',
      updatedAt: new Date(),
      reviewedBy: 'mobile_admin',
      reviewedAt: new Date(),
    })
    .where(eq(kycVerification.userId, customerId))
  return { success: true, message: 'KYC rechazado' }
}

export async function mobileAdminPayments(page = 1, limit = 50) {
  const rows = await db.select().from(payment).orderBy(desc(payment.createdAt)).limit(500)
  const userIds = [...new Set(rows.map((p) => p.userId))]
  const users = userIds.length
    ? await db.select().from(userTable).where(inArray(userTable.id, userIds))
    : []
  const umap = new Map(users.map((u) => [u.id, u]))
  const start = (page - 1) * limit
  const slice = rows.slice(start, start + limit)
  return {
    items: slice.map((p) => {
      const u = umap.get(p.userId)
      return {
        id: p.id,
        userName: u?.name ?? '',
        userEmail: u?.email ?? '',
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        gateway: p.gateway,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      }
    }),
    total: rows.length,
  }
}
