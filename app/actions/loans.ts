'use server'

import { persistBcraConsultation } from '@/lib/bcra-persist'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { db } from '@/lib/db'
import { computeFrenchAmortization } from '@/lib/finance'
import { ensureLoanContract, notifyContractReady, syncOverdueInstallments } from '@/lib/legal/expediente'
import { canWithdrawAcceptance, WITHDRAWAL_DAYS } from '@/lib/legal/withdrawal'
import { decideUnderwriting, computeCreditOffer, OPEN_LOAN_STATUSES, type AppRepaymentHistory } from '@/lib/loan-underwriting'
import { installment, kycVerification, loan, loanProduct, payment, profile } from '@/lib/db/schema'
import { diditApprovedForUser } from '@/lib/didit'
import { revalidateCustomer } from '@/lib/revalidate'
import { assertRole, getOrCreateProfile, newId } from '@/lib/session'
import { and, desc, eq, inArray } from 'drizzle-orm'

export async function getLoanProducts() {
  const rows = await db.select().from(loanProduct).where(eq(loanProduct.active, true))
  // Catálogo UniCred: excluir marcas ajenas y deduplicar por nombre.
  const seen = new Set<string>()
  return rows.filter((p) => {
    const name = String(p.name ?? '').toLowerCase()
    const id = String(p.id ?? '').toLowerCase()
    if (name.includes('rapicuota') || id.includes('rapicuota') || p.type === 'express') {
      return false
    }
    const key = name.normalize('NFD').replace(/\p{M}/gu, '').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const RE_DNI_LOAN = /^\d{7,8}$/

function _validateCuilMod11(cuil: string): boolean {
  return isValidCuit(normalizeCuit(cuil))
}

async function loadAppRepaymentHistory(userId: string): Promise<AppRepaymentHistory> {
  const [paidRows, overdueRows, completedRows] = await Promise.all([
    db
      .select({ id: installment.id })
      .from(installment)
      .where(and(eq(installment.userId, userId), eq(installment.status, 'paid'))),
    db
      .select({ id: installment.id })
      .from(installment)
      .where(and(eq(installment.userId, userId), eq(installment.status, 'overdue'))),
    db
      .select({ id: loan.id })
      .from(loan)
      .where(and(eq(loan.userId, userId), eq(loan.status, 'paid'))),
  ])
  return {
    paidCount: paidRows.length,
    overdueCount: overdueRows.length,
    completedLoans: completedRows.length,
  }
}

async function requireCustomerReadyForCredit(userId: string) {
  const prof = await getOrCreateProfile()
  if (!prof) throw new Error('Unauthorized')

  if (!prof.cuil) {
    return { ok: false as const, error: 'Completá tu perfil (CUIL e ingresos) antes de solicitar.' }
  }
  if (!_validateCuilMod11(prof.cuil)) {
    return { ok: false as const, error: 'CUIL inválido en perfil. Actualizalo desde Mis Datos.' }
  }
  if (!prof.dni || Number(prof.monthlyIncome ?? 0) <= 0) {
    return { ok: false as const, error: 'Completá DNI e ingresos declarados antes de solicitar.' }
  }
  const [kyc] = await db
    .select({
      status: kycVerification.status,
      provider: kycVerification.provider,
    })
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .limit(1)
  if (kyc?.status === 'rejected' || prof.kycStatus === 'rejected') {
    return {
      ok: false as const,
      error: 'Didit rechazó tu verificación. Reintentá la identidad biométrica o contactá a soporte.',
    }
  }
  if (!(await diditApprovedForUser(userId))) {
    return {
      ok: false as const,
      error: 'Verificá tu identidad con Didit antes de solicitar un crédito. No se aceptan documentos cargados a mano.',
    }
  }

  const openLoans = await db
    .select({ id: loan.id, status: loan.status })
    .from(loan)
    .where(
      and(
        eq(loan.userId, userId),
        inArray(loan.status, [...OPEN_LOAN_STATUSES]),
      ),
    )
    .limit(1)
  if (openLoans.length) {
    return {
      ok: false as const,
      error:
        'Ya tenés un crédito en evaluación, calificado o vigente. Completá la firma o el ciclo actual antes de pedir otro.',
    }
  }

  return { ok: true as const, prof }
}

/**
 * Scoring + capacidad + historial en app → oferta máxima.
 * No crea el crédito: el cliente elige un monto dentro del techo y recién ahí solicita.
 */
export async function evaluateLoanOffer(input: { productId: string; term: number }) {
  const userId = await assertRole('customer')
  const ready = await requireCustomerReadyForCredit(userId)
  if (!ready.ok) return ready

  const [product] = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.id, input.productId))
    .limit(1)
  if (!product) return { ok: false as const, error: 'Producto no encontrado.' }
  if (!product.active) {
    return { ok: false as const, error: 'Este producto no está disponible actualmente.' }
  }

  const term = Math.round(Number(input.term))
  if (!Number.isFinite(term) || term < product.minTerm || term > product.maxTerm) {
    return {
      ok: false as const,
      error: `Plazo fuera de rango: mínimo ${product.minTerm} meses, máximo ${product.maxTerm} meses.`,
    }
  }

  const monthlyIncome = Number(ready.prof.monthlyIncome ?? 0)
  const consulted = await persistBcraConsultation({
    userId,
    cuil: ready.prof.cuil!,
    monthlyIncome,
  })
  if (!consulted.ok) {
    return { ok: false as const, error: consulted.error }
  }

  const history = await loadAppRepaymentHistory(userId)
  const offer = computeCreditOffer({
    score: consulted.score.score,
    monthlyIncome,
    term,
    monthlyRate: Number(product.monthlyRate),
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    history,
  })

  return {
    ok: true as const,
    score: consulted.score.score,
    band: consulted.score.band,
    reasons: consulted.score.reasons,
    offer,
    history,
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    monthlyRate: Number(product.monthlyRate),
    term,
  }
}

export async function updateProfile(input: {
  cuil: string
  dni: string
  phone: string
  birthDate: string
  province: string
  department?: string
  city: string
  postalCode?: string
  address: string
  monthlyIncome: number
  employmentStatus: string
}) {
  const userId = await assertRole('customer')
  await getOrCreateProfile()

  const cuilClean = String(input.cuil ?? '').replace(/\D/g, '')
  if (!_validateCuilMod11(cuilClean)) {
    throw new Error('CUIL inválido: 11 dígitos con dígito verificador correcto (sin guiones ni puntos).')
  }
  const dniClean = String(input.dni ?? '').replace(/\D/g, '')
  if (!RE_DNI_LOAN.test(dniClean)) {
    throw new Error('DNI inválido: deben ser 7 u 8 dígitos numéricos (sin puntos).')
  }
  const incomeNum = Number(input.monthlyIncome)
  if (!Number.isFinite(incomeNum) || incomeNum < 0) {
    throw new Error('Ingresos mensuales inválidos.')
  }
  if (!input.birthDate || isNaN(new Date(input.birthDate).getTime())) {
    throw new Error('Fecha de nacimiento inválida.')
  }
  if (!input.province?.trim() || !input.city?.trim() || !input.address?.trim()) {
    throw new Error('Completá provincia, ciudad y dirección.')
  }
  if (!input.employmentStatus?.trim()) {
    throw new Error('Estado laboral obligatorio.')
  }

  const [existingProf] = await db
    .select({ kycStatus: profile.kycStatus })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1)
  const [diditOk] = await db
    .select({ id: kycVerification.id })
    .from(kycVerification)
    .where(
      and(
        eq(kycVerification.userId, userId),
        eq(kycVerification.provider, 'didit'),
        eq(kycVerification.status, 'approved'),
      ),
    )
    .limit(1)
  const keepApproved = existingProf?.kycStatus === 'approved' || Boolean(diditOk)

  await db
    .update(profile)
    .set({
      cuil: cuilClean,
      dni: dniClean,
      phone: String(input.phone ?? '').trim(),
      birthDate: input.birthDate,
      province: input.province.trim(),
      department: input.department?.trim() || null,
      city: input.city.trim(),
      postalCode: input.postalCode?.trim() || null,
      address: input.address.trim(),
      monthlyIncome: String(incomeNum),
      employmentStatus: input.employmentStatus.trim(),
      kycStatus: keepApproved ? 'approved' : 'submitted',
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, userId))
  revalidateCustomer()
  return { ok: true }
}

/**
 * Solicita un préstamo: scoring + oferta por capacidad/historial, luego decide:
 * - rejected: no califica
 * - pending: revisión manual (score regular)
 * - approved: calificado → se emite contrato; el desembolso y las cuotas
 *   exigibles recién se habilitan al firmar el contrato (y el alta a vigente
 *   la hace tesorería al acreditar).
 */
export async function requestLoan(input: {
  productId: string
  amount: number
  term: number
  purpose: string
}) {
  const userId = await assertRole('customer')
  const ready = await requireCustomerReadyForCredit(userId)
  if (!ready.ok) return ready
  const prof = ready.prof

  if (!input.purpose?.trim() || input.purpose.trim().length < 5) {
    return { ok: false as const, error: 'Describí el destino del préstamo (al menos 5 caracteres).' }
  }

  const [product] = await db
    .select()
    .from(loanProduct)
    .where(eq(loanProduct.id, input.productId))
    .limit(1)

  if (!product) return { ok: false as const, error: 'Producto no encontrado.' }
  if (!product.active) {
    return { ok: false as const, error: 'Este producto no está disponible actualmente.' }
  }

  const amount = Math.round(Number(input.amount))
  const term = Math.round(Number(input.term))
  const minAmount = Number(product.minAmount)
  if (!Number.isFinite(term) || term < product.minTerm || term > product.maxTerm) {
    return {
      ok: false as const,
      error: `Plazo fuera de rango: mínimo ${product.minTerm} meses, máximo ${product.maxTerm} meses.`,
    }
  }

  const monthlyRate = Number(product.monthlyRate)
  const monthlyIncome = Number(prof.monthlyIncome ?? 0)
  const consulted = await persistBcraConsultation({
    userId,
    cuil: prof.cuil!,
    monthlyIncome,
  })
  if (!consulted.ok) {
    return { ok: false as const, error: consulted.error }
  }
  const score = consulted.score
  const deuda = consulted.snapshot.deudas

  const history = await loadAppRepaymentHistory(userId)
  const offer = computeCreditOffer({
    score: score.score,
    monthlyIncome,
    term,
    monthlyRate,
    productMinAmount: minAmount,
    productMaxAmount: Number(product.maxAmount),
    history,
  })

  if (!offer.eligible || offer.maxAmount < minAmount) {
    const loanId = newId('loan')
    const now = new Date()
    const stub = computeFrenchAmortization(minAmount, term, monthlyRate)
    await db.insert(loan).values({
      id: loanId,
      userId,
      productId: product.id,
      type: product.type,
      principal: String(minAmount),
      term,
      monthlyRate: String(monthlyRate),
      tna: String(stub.tna),
      installmentAmount: String(stub.installmentAmount),
      totalAmount: String(stub.totalAmount),
      cft: String(stub.cft),
      status: 'rejected',
      purpose: input.purpose.trim(),
      scoreAtApproval: score.score,
      rejectionReason: offer.reason,
      disbursedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    revalidateCustomer()
    return {
      ok: true as const,
      status: 'rejected' as const,
      score: score.score,
      band: score.band,
      reasons: score.reasons,
      decision: 'rejected' as const,
      decisionReason: offer.reason,
      rejectionReason: offer.reason,
      loanId,
      contractId: null,
      offerMaxAmount: 0,
    }
  }

  if (!Number.isFinite(amount) || amount < minAmount || amount > offer.maxAmount) {
    return {
      ok: false as const,
      error: `Monto fuera de tu oferta: mínimo $${minAmount.toLocaleString('es-AR')}, máximo $${offer.maxAmount.toLocaleString('es-AR')} según score y capacidad.`,
      offerMaxAmount: offer.maxAmount,
      score: score.score,
    }
  }

  const amort = computeFrenchAmortization(amount, term, monthlyRate)

  const decision = decideUnderwriting({
    score,
    installmentAmount: amort.installmentAmount,
    monthlyIncome,
    worstSituation: deuda.worstSituation,
    rejectedChecksCount: consulted.snapshot.chequesRechazados.count,
  })

  let status: 'pending' | 'approved' | 'rejected'
  let rejectionReason: string | null = null
  if (decision.outcome === 'rejected') {
    status = 'rejected'
    rejectionReason = decision.reason
  } else if (decision.outcome === 'pending_review') {
    status = 'pending'
    rejectionReason = null
  } else {
    status = 'approved'
    rejectionReason = null
  }

  const loanId = newId('loan')
  const now = new Date()
  let contractId: string | null = null

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
      purpose: input.purpose.trim(),
      scoreAtApproval: score.score,
      rejectionReason,
      disbursedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    // Calificado: solo se emite el contrato. Cuotas y desembolso se habilitan al firmar.
    if (status === 'approved') {
      const contract = await ensureLoanContract(
        tx,
        { id: loanId, userId, type: product.type, status: 'approved' },
        { generatedBy: 'auto_score', now },
      )
      contractId = contract?.id ?? null
    }
  })

  if (contractId) {
    await notifyContractReady({
      userId,
      contractId,
      principal: amount,
      term,
    })
  }

  revalidateCustomer()
  return {
    ok: true as const,
    status,
    score: score.score,
    band: score.band,
    reasons: score.reasons,
    decision: decision.outcome,
    decisionReason: decision.reason,
    rejectionReason,
    loanId,
    contractId,
    offerMaxAmount: offer.maxAmount,
  }
}

export async function getMyLoans() {
  const userId = await assertRole('customer')
  return db
    .select()
    .from(loan)
    .where(eq(loan.userId, userId))
    .orderBy(desc(loan.createdAt))
}

export async function getMyInstallments({ upcomingOnly }: { upcomingOnly?: boolean } = {}) {
  const userId = await assertRole('customer')
  await syncOverdueInstallments({ userId })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in60 = new Date(today)
  in60.setDate(in60.getDate() + 60)

  const rows = await db
    .select({
      id: installment.id,
      number: installment.number,
      amount: installment.amount,
      dueDate: installment.dueDate,
      status: installment.status,
      paidAt: installment.paidAt,
      loanId: installment.loanId,
      loanPrincipal: loan.principal,
      loanTerm: loan.term,
      loanStatus: loan.status,
      loanPurpose: loan.purpose,
      loanCreatedAt: loan.createdAt,
    })
    .from(installment)
    .innerJoin(loan, eq(installment.loanId, loan.id))
    .where(
      upcomingOnly
        ? and(eq(installment.userId, userId), inArray(installment.status, ['pending', 'overdue']))
        : eq(installment.userId, userId),
    )
    .orderBy(installment.dueDate)
    .limit(upcomingOnly ? 48 : 500)

  if (!upcomingOnly) return rows
  return rows.filter((r) => {
    if (r.status === 'paid' || r.status === 'cancelled') return false
    const d = new Date(r.dueDate as any)
    d.setHours(0, 0, 0, 0)
    if (r.status === 'overdue' || d < today) return true
    return d <= in60
  })
}

export async function getLoanInstallments(loanId: string) {
  const userId = await assertRole('customer')
  const rows = await db
    .select()
    .from(installment)
    .where(and(eq(installment.loanId, loanId), eq(installment.userId, userId)))
    .orderBy(installment.number)

  const pays = await db
    .select()
    .from(payment)
    .where(and(eq(payment.loanId, loanId), eq(payment.userId, userId)))

  return rows.map((row) => {
    if (row.paidAt) return row
    const match = pays.find((p) => {
      if (!p.paidAt) return false
      if (p.installmentId === row.id) return true
      const ids = (p.gatewayResponse as { installment_ids?: unknown } | null)?.installment_ids
      return Array.isArray(ids) && ids.includes(row.id)
    })
    return match ? { ...row, paidAt: match.paidAt } : row
  })
}

export async function withdrawLoanAcceptance(loanId: string) {
  const userId = await assertRole('customer')
  const [row] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, loanId), eq(loan.userId, userId)))
    .limit(1)
  if (!row) return { ok: false as const, error: 'Crédito no encontrado.' }
  if (row.status === 'cancelled' || row.status === 'rejected') {
    return { ok: false as const, error: 'Ese crédito ya no está vigente.' }
  }

  const { loanContract } = await import('@/lib/db/schema')
  const [contract] = await db
    .select()
    .from(loanContract)
    .where(eq(loanContract.loanId, loanId))
    .limit(1)
  if (!contract || contract.status !== 'accepted' || !contract.acceptedAt) {
    return { ok: false as const, error: 'Solo aplica a un contrato ya aceptado.' }
  }

  if (
    !canWithdrawAcceptance({
      contractStatus: contract.status,
      acceptedAt: contract.acceptedAt,
      loanStatus: row.status,
      disbursedAt: row.disbursedAt,
    })
  ) {
    const deadline = new Date(contract.acceptedAt)
    deadline.setDate(deadline.getDate() + WITHDRAWAL_DAYS)
    if (new Date() > deadline) {
      return {
        ok: false as const,
        error: `El plazo de ${WITHDRAWAL_DAYS} días corridos venció. Usá la cancelación anticipada del saldo.`,
      }
    }
    if (row.disbursedAt || row.status === 'active') {
      return {
        ok: false as const,
        error:
          'El crédito ya se acreditó. Para arrepentirte hay que devolver el capital. Escribí a soporte o cancelá el saldo.',
      }
    }
    return { ok: false as const, error: 'Este crédito no admite arrepentimiento en este estado.' }
  }

  const now = new Date()
  await db.update(loan).set({ status: 'cancelled', updatedAt: now, rejectionReason: 'Arrepentimiento Ley 24.240 art. 34' }).where(eq(loan.id, loanId))
  await db
    .update(loanContract)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(eq(loanContract.id, contract.id))
  await db
    .update(installment)
    .set({ status: 'cancelled', paidAt: now })
    .where(and(eq(installment.loanId, loanId), eq(installment.userId, userId)))

  revalidateCustomer()
  return { ok: true as const }
}

/*
 * No hay acción para marcar una cuota como pagada desde el cliente: la única vía
 * de acreditación es el webhook de Mercado Pago, y la corrección manual vive en
 * el panel de administración (app/actions/admin.ts).
 */
