import { db } from '@/lib/db'
import { bankAccount, installment, loan, loanContract, profile, user as userTable } from '@/lib/db/schema'
import { canViewOwnedRecord } from '@/lib/legal/access'
import { lastRefinanceAt, readSignatureData, syncOverdueInstallments } from '@/lib/legal/expediente'
import { computeEarlySettlement, type EarlySettlement } from '@/lib/legal/settlement'
import type { ContractDocData } from '@/lib/legal/types'
import { and, eq } from 'drizzle-orm'

export type LoanCertificateKind = 'solvencia' | 'libre_deuda' | 'cancelacion'

export type LoanCertificateData = {
  kind: LoanCertificateKind
  loanId: string
  contractId: string | null
  issuedAt: string
  customer: ContractDocData['customer']
  loan: ContractDocData['loan'] & { status: string }
  installments: ContractDocData['installments']
  settlement: EarlySettlement
  overdueCount: number
  paidCount: number
}

export async function loadContractPackForViewer(
  viewerId: string,
  contractId: string,
): Promise<ContractDocData | null> {
  const [c] = await db
    .select({ id: loanContract.id, userId: loanContract.userId, loanId: loanContract.loanId })
    .from(loanContract)
    .where(eq(loanContract.id, contractId))
    .limit(1)
  if (!c) return null
  if (!(await canViewOwnedRecord(viewerId, c.userId))) return null
  await syncOverdueInstallments({ loanId: c.loanId })
  return loadContractPack(c.userId, contractId)
}

export async function loadContractPack(userId: string, contractId: string): Promise<ContractDocData | null> {
  const [contract] = await db
    .select()
    .from(loanContract)
    .where(and(eq(loanContract.id, contractId), eq(loanContract.userId, userId)))
    .limit(1)
  if (!contract) return null

  const [loanRow] = await db
    .select()
    .from(loan)
    .where(and(eq(loan.id, contract.loanId), eq(loan.userId, userId)))
    .limit(1)
  const profileRows = await db
    .select({
      profile,
      fullName: userTable.name,
      email: userTable.email,
    })
    .from(profile)
    .innerJoin(userTable, eq(userTable.id, profile.userId))
    .where(eq(profile.userId, userId))
    .limit(1)
  const p = profileRows[0]?.profile ?? null
  const [bankAcc] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.isPrimary, true)))
    .limit(1)
  const insts = await db
    .select()
    .from(installment)
    .where(and(eq(installment.loanId, contract.loanId), eq(installment.userId, userId)))
    .orderBy(installment.number)

  const account = bankAcc
    ? {
        bankName: bankAcc.bankName,
        accountType: bankAcc.accountType,
        cbu: bankAcc.cbu ?? null,
        cvu: bankAcc.cvu ?? null,
        alias: bankAcc.alias ?? null,
        holderName: bankAcc.holderName,
        holderCuil: bankAcc.holderCuil,
      }
    : null

  return {
    id: contract.id,
    loanId: contract.loanId,
    version: contract.version,
    templateName: contract.templateName,
    createdAt: contract.createdAt,
    effectiveDate: contract.effectiveDate,
    expirationDate: contract.expirationDate,
    acceptedAt: contract.acceptedAt,
    status: contract.status,
    signerName: contract.signerName ?? profileRows[0]?.fullName ?? null,
    signerCuil: contract.signerCuil ?? p?.cuil ?? null,
    signatureType: contract.signatureType,
    acceptedIp: contract.acceptedIp,
    loan: {
      id: loanRow?.id ?? contract.loanId,
      principal: loanRow?.principal ?? 0,
      term: loanRow?.term ?? 0,
      monthlyRate: loanRow?.monthlyRate ?? 0,
      tna: loanRow?.tna ?? null,
      installmentAmount: loanRow?.installmentAmount ?? 0,
      totalAmount: loanRow?.totalAmount ?? 0,
      cft: loanRow?.cft ?? null,
      purpose: loanRow?.purpose ?? null,
      createdAt: loanRow?.createdAt ?? contract.createdAt,
      type: loanRow?.type ?? 'personal',
    },
    customer: {
      name: profileRows[0]?.fullName ?? null,
      cuil: p?.cuil ?? null,
      dni: p?.dni ?? null,
      email: profileRows[0]?.email ?? null,
      phone: p?.phone ?? null,
      city: p?.city ?? null,
      province: p?.province ?? null,
      address: p?.address ?? null,
      employmentStatus: p?.employmentStatus ?? null,
      monthlyIncome: p?.monthlyIncome ?? null,
    },
    bankAccount: account,
    disbursementAccount: account,
    installments: insts.map((row) => ({
      id: row.id,
      number: row.number,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status,
      paidAt: row.paidAt,
    })),
    pagareNumber: readSignatureData(contract.signatureData).pagareNumber ?? `PAG-${contract.id.slice(0, 8).toUpperCase()}`,
    refinanceCount: readSignatureData(contract.signatureData).refinanciaciones?.length ?? 0,
    lastRefinanceAt: lastRefinanceAt(contract.signatureData),
    lastIntimation: (() => {
      const list = readSignatureData(contract.signatureData).intimaciones ?? []
      const last = list[list.length - 1]
      if (!last) return null
      return {
        number: last.number,
        at: last.at,
        amount: last.amount,
        installments: last.installments ?? [],
      }
    })(),
  }
}

export async function loadLoanPackByLoanId(userId: string, loanId: string) {
  const [contract] = await db
    .select()
    .from(loanContract)
    .where(and(eq(loanContract.loanId, loanId), eq(loanContract.userId, userId)))
    .limit(1)
  if (contract) return loadContractPack(userId, contract.id)
  return null
}

export async function loadLoanCertificateForViewer(
  viewerId: string,
  loanId: string,
  kind: LoanCertificateKind,
): Promise<LoanCertificateData | null> {
  const [loanRow] = await db.select().from(loan).where(eq(loan.id, loanId)).limit(1)
  if (!loanRow) return null
  if (!(await canViewOwnedRecord(viewerId, loanRow.userId))) return null
  await syncOverdueInstallments({ loanId })

  const pack = await loadLoanPackByLoanId(loanRow.userId, loanId)
  const insts =
    pack?.installments ??
    (
      await db
        .select()
        .from(installment)
        .where(and(eq(installment.loanId, loanId), eq(installment.userId, loanRow.userId)))
        .orderBy(installment.number)
    ).map((row) => ({
      id: row.id,
      number: row.number,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status,
      paidAt: row.paidAt,
    }))

  const paid = insts.filter((row) => row.status === 'paid')
  const overdue = insts.filter((row) => row.status === 'overdue')
  const unpaid = insts.filter((row) => row.status !== 'paid')
  const settlement = computeEarlySettlement({
    principal: Number(loanRow.principal),
    monthlyRate: Number(loanRow.monthlyRate),
    term: loanRow.term,
    paidCount: paid.length,
    unpaidAmounts: unpaid.map((row) => Number(row.amount) || 0),
  })

  if (kind === 'libre_deuda' && unpaid.length > 0 && loanRow.status !== 'paid') return null
  if (kind === 'solvencia' && overdue.length > 0) return null
  if (kind === 'cancelacion' && unpaid.length === 0) return null

  const profileRows = pack
    ? null
    : await db
        .select({ profile, fullName: userTable.name, email: userTable.email })
        .from(profile)
        .innerJoin(userTable, eq(userTable.id, profile.userId))
        .where(eq(profile.userId, loanRow.userId))
        .limit(1)
  const p = profileRows?.[0]

  return {
    kind,
    loanId: loanRow.id,
    contractId: pack?.id ?? null,
    issuedAt: new Date().toISOString(),
    customer: pack?.customer ?? {
      name: p?.fullName ?? null,
      cuil: p?.profile.cuil ?? null,
      dni: p?.profile.dni ?? null,
      email: p?.email ?? null,
      phone: p?.profile.phone ?? null,
      city: p?.profile.city ?? null,
      province: p?.profile.province ?? null,
      address: p?.profile.address ?? null,
      employmentStatus: p?.profile.employmentStatus ?? null,
      monthlyIncome: p?.profile.monthlyIncome ?? null,
    },
    loan: {
      id: loanRow.id,
      principal: loanRow.principal,
      term: loanRow.term,
      monthlyRate: loanRow.monthlyRate,
      tna: loanRow.tna,
      installmentAmount: loanRow.installmentAmount,
      totalAmount: loanRow.totalAmount,
      cft: loanRow.cft,
      purpose: loanRow.purpose,
      createdAt: loanRow.createdAt,
      type: loanRow.type,
      status: loanRow.status,
    },
    installments: insts,
    settlement,
    overdueCount: overdue.length,
    paidCount: paid.length,
  }
}
