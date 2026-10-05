import { getLoanProducts, getMyLoans, getMyInstallments } from '@/app/actions/loans'
import { DashboardTabsWrapper } from '@/components/dashboard/dashboard-tabs-wrapper'
import { db } from '@/lib/db'
import {
  profile,
  bankAccount,
  kycVerification,
  loanContract,
  bcraReport,
  payment,
  paymentReceipt,
  savedPaymentMethod,
  disbursement,
  bcraCheck,
} from '@/lib/db/schema'
import { computeCreditOffer, SCORE_REJECT_BELOW } from '@/lib/loan-underwriting'
import { getOrCreateProfile, getSession, requireCustomer } from '@/lib/session'
import { desc, eq, and } from 'drizzle-orm'
import { Suspense } from 'react'
import DashboardLoading from './loading'

export const metadata = {
  title: 'Mi panel',
  description:
    'Panel de usuario de UNICRÉDITOS. Gestioná tu perfil, solicitá créditos y seguí tus cuotas.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const userId = await requireCustomer()
  const session = await getSession()
  const prof = await getOrCreateProfile()
  const sessionUser = {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? null,
    image: session?.user?.image ?? null,
  }

  const [
    products,
    loans,
    installmentsAllArr,
    bankAccounts,
    myKycArr,
    contractsRaw,
    bcraReports,
    payments,
    paymentReceiptsArr,
    savedPaymentMethods,
    disbursementsArr,
    lastBcraArr,
  ] = await Promise.all([
    getLoanProducts().catch((e) => { console.error('[dashboard] getLoanProducts failed:', e.message); return [] as any[] }),
    getMyLoans().catch((e) => { console.error('[dashboard] getMyLoans failed:', e.message); return [] as any[] }),
    getMyInstallments().catch((e) => { console.error('[dashboard] installments failed:', e.message); return [] as any[] }),
    db
      .select()
      .from(bankAccount)
      .where(and(eq(bankAccount.userId, userId), eq(bankAccount.isActive, true)))
      .orderBy(desc(bankAccount.isPrimary), desc(bankAccount.createdAt))
      .catch((e) => { console.error('[dashboard] bankAccount failed:', e.message); return [] }),
    db
      .select()
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .orderBy(desc(kycVerification.updatedAt))
      .limit(1)
      .catch((e) => { console.error('[dashboard] kycVerification failed:', e.message); return [] }),
    db
      .select()
      .from(loanContract)
      .where(eq(loanContract.userId, userId))
      .orderBy(desc(loanContract.createdAt))
      .limit(20)
      .catch((e) => { console.error('[dashboard] loanContract failed:', e.message); return [] }),
    db
      .select()
      .from(bcraReport)
      .where(eq(bcraReport.userId, userId))
      .orderBy(desc(bcraReport.createdAt))
      .limit(20)
      .catch((e) => { console.error('[dashboard] bcraReport failed:', e.message); return [] }),
    db
      .select()
      .from(payment)
      .where(eq(payment.userId, userId))
      .orderBy(desc(payment.createdAt))
      .limit(50)
      .catch((e) => { console.error('[dashboard] payment failed:', e.message); return [] }),
    db
      .select()
      .from(paymentReceipt)
      .where(eq(paymentReceipt.userId, userId))
      .orderBy(desc(paymentReceipt.createdAt))
      .limit(50)
      .catch((e) => { console.error('[dashboard] paymentReceipt failed:', e.message); return [] }),
    db
      .select()
      .from(savedPaymentMethod)
      .where(and(eq(savedPaymentMethod.userId, userId), eq(savedPaymentMethod.isActive, true)))
      .orderBy(desc(savedPaymentMethod.isDefault), desc(savedPaymentMethod.lastUsedAt))
      .catch((e) => { console.error('[dashboard] savedPaymentMethod failed:', e.message); return [] }),
    db
      .select()
      .from(disbursement)
      .where(eq(disbursement.userId, userId))
      .orderBy(desc(disbursement.createdAt))
      .limit(20)
      .catch((e) => { console.error('[dashboard] disbursement failed:', e.message); return [] }),
    db
      .select()
      .from(bcraCheck)
      .where(eq(bcraCheck.userId, userId))
      .orderBy(desc(bcraCheck.createdAt))
      .limit(1)
      .catch((e) => {
        console.error('[dashboard] bcraCheck failed:', e.message)
        return [] as any[]
      }),
  ])

  const lastBcraCheck = lastBcraArr[0] ?? null
  const myKyc = myKycArr[0] ?? null
  const upcomingInstallments = upcomingWithin60(installmentsAllArr)

  const loanMap = new Map(loans.map((l: any) => [l.id, l]))
  const contracts = contractsRaw.map((c: any) => ({ ...c, loan: (loanMap.get(c.loanId) ?? null) as any }))
  const disbursements = disbursementsArr.map((d: any) => ({ ...d, loan: (loanMap.get(d.loanId) ?? null) as any }))

  const remainingBalance = installmentsAllArr.reduce((sum: number, i: any) => {
    if (i.status === 'paid' || i.status === 'cancelled') return sum
    return sum + (Number(i.amount) || 0)
  }, 0)

  const kpiTotals = loans.reduce(
    (acc, l: any) => {
      const p = Number(l.principal) || 0
      const t = Number(l.totalAmount) || 0
      acc.totalRequested += p
      if (l.status === 'active') {
        acc.active += 1
      } else if (l.status === 'paid') {
        acc.paid += 1
        acc.totalPaid += t
      } else if (l.status === 'rejected') {
        acc.rejected += 1
      } else if (l.status === 'pending' || l.status === 'approved') {
        acc.pendingApproval += 1
      }
      return acc
    },
    {
      totalRequested: 0,
      totalDebt: remainingBalance,
      pendingAmount: remainingBalance,
      totalPaid: 0,
      active: 0,
      paid: 0,
      rejected: 0,
      pendingApproval: 0,
    },
  )

  const instMap = new Map(installmentsAllArr.map((i: any) => [i.id, i]))
  const receiptsWithInstallment = paymentReceiptsArr.map((r: any) => ({
    ...r,
    installment: (r.installmentId ? (instMap.get(r.installmentId) ?? null) : null) as any,
  }))

  const kycPct = computeKycPct(prof as any)
  const preapprovedAmount = estimateLine(prof as any, products, loans, installmentsAllArr, lastBcraCheck?.computedScore)

  return (
    <Suspense fallback={<DashboardLoading />}>
    <DashboardTabsWrapper
      sessionUser={sessionUser}
      initialProfile={prof}
      products={products}
      loans={loans}
      lastBcraCheck={lastBcraCheck}
      upcomingInstallments={upcomingInstallments as any}
      kpiTotals={kpiTotals}
      kycPct={kycPct}
      preapprovedAmount={preapprovedAmount}
      bankAccounts={bankAccounts as any}
      myKyc={myKyc as any}
      contracts={contracts as any}
      bcraReports={bcraReports as any}
      payments={payments as any}
      paymentReceipts={receiptsWithInstallment as any}
      savedPaymentMethods={savedPaymentMethods as any}
      disbursements={disbursements as any}
      installmentsAll={installmentsAllArr as any}
    />
    </Suspense>
  )
}

function upcomingWithin60(rows: { status?: string | null; dueDate?: Date | string | null }[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in60 = new Date(today)
  in60.setDate(in60.getDate() + 60)
  return rows
    .filter((row) => {
      if (row.status === 'paid' || row.status === 'cancelled') return false
      const due = new Date(row.dueDate as string)
      due.setHours(0, 0, 0, 0)
      if (row.status === 'overdue' || due < today) return true
      return due <= in60
    })
    .slice(0, 48)
}

function estimateLine(
  prof: { monthlyIncome?: unknown; creditScore?: number | null } | null,
  products: { minAmount?: unknown; maxAmount?: unknown; minTerm?: number | null; maxTerm?: number | null; monthlyRate?: unknown }[],
  loans: { status?: string | null }[],
  installments: { status?: string | null }[],
  bcraScore?: number | null,
) {
  const product = [...products].sort((a, b) => Number(a.minAmount) - Number(b.minAmount))[0]
  if (!product) return null
  const monthlyIncome = Number(prof?.monthlyIncome ?? 0)
  const raw = prof?.creditScore ?? bcraScore ?? null
  const score = raw == null || raw < SCORE_REJECT_BELOW ? 650 : raw
  const term = Math.min(Math.max(Number(product.minTerm) || 6, 12), Number(product.maxTerm) || 24)
  const offer = computeCreditOffer({
    score,
    monthlyIncome: monthlyIncome > 0 ? monthlyIncome : 300_000,
    term,
    monthlyRate: Number(product.monthlyRate),
    productMinAmount: Number(product.minAmount),
    productMaxAmount: Number(product.maxAmount),
    history: {
      paidCount: installments.filter((row) => row.status === 'paid').length,
      overdueCount: installments.filter((row) => row.status === 'overdue').length,
      completedLoans: loans.filter((row) => row.status === 'paid').length,
    },
  })
  return offer.eligible ? offer.maxAmount : 0
}

function computeKycPct(p: typeof profile.$inferSelect | null): number {
  if (!p) return 0
  let points = 0
  const total = 9
  if (p.cuil && p.cuil.trim()) points++
  if (p.dni && p.dni.trim()) points++
  if (p.phone && p.phone.trim()) points++
  if (p.birthDate) points++
  if (p.province && p.province.trim()) points++
  if (p.city && p.city.trim()) points++
  if (p.address && p.address.trim()) points++
  if ((p.monthlyIncome as any as number) > 0) points++
  if (p.employmentStatus && p.employmentStatus.trim()) points++
  return Math.round((points / total) * 100)
}
