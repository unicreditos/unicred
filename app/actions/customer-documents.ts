'use server'

import { receiptBranding } from '@/lib/brand'
import { snapshotFromStored, type FullBcraSnapshot } from '@/lib/bcra'
import { loadConstanciaForUser } from '@/lib/arca/constancia-store'
import type { ArcaConstanciaSnapshot } from '@/lib/arca/constancia-snapshot'
import { db } from '@/lib/db'
import {
  bankAccount,
  bcraReport,
  disbursement,
  loan,
  paymentReceipt,
  profile,
  user,
} from '@/lib/db/schema'
import {
  documentKindTitle,
  isCustomerDocKind,
} from '@/lib/documents/customer-view'
import { documentPdfBaseName, shortDocCode } from '@/lib/document-filename'
import { canViewOwnedRecord } from '@/lib/legal/access'
import {
  loadContractPackForViewer,
  loadLoanCertificateForViewer,
  loadLoanPackByLoanId,
  type LoanCertificateData,
  type LoanCertificateKind,
} from '@/lib/legal/loan-pack'
import { asMoraRows, evaluateIntimation, type IntimableRow } from '@/lib/legal/mora'
import type { ContractDocData } from '@/lib/legal/types'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export type CustomerDocumentPayload =
  | {
      ok: true
      kind: 'contrato' | 'pagare' | 'talonario' | 'estado-deuda'
      title: string
      fileName: string
      contract: ContractDocData
    }
  | {
      ok: true
      kind: 'intimacion'
      title: string
      fileName: string
      contract: ContractDocData
      items: IntimableRow[]
      noticeNumber?: string
      issuedAt?: string
    }
  | {
      ok: true
      kind: 'arca'
      title: string
      fileName: string
      snapshot: ArcaConstanciaSnapshot
      holderName?: string | null
    }
  | {
      ok: true
      kind: 'bcra'
      title: string
      fileName: string
      report: Record<string, unknown>
      extract: FullBcraSnapshot | null
    }
  | {
      ok: true
      kind: 'recibo'
      title: string
      fileName: string
      receipt: Record<string, unknown>
    }
  | {
      ok: true
      kind: 'liquidacion'
      title: string
      fileName: string
      data: Record<string, unknown>
    }
  | {
      ok: true
      kind: 'solvencia' | 'libre-deuda' | 'cancelacion'
      title: string
      fileName: string
      certificate: LoanCertificateData
    }
  | { ok: false; error: string }

function pack<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function identity(userId: string) {
  const rows = await db
    .select({ profile, user })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.userId, userId))
    .limit(1)
  return { p: rows[0]?.profile ?? null, u: rows[0]?.user ?? null }
}

function parseJson(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

async function loadReceiptDoc(viewerId: string, id: string) {
  const defaultBranding = receiptBranding()
  const [receiptRaw] = await db.select().from(paymentReceipt).where(eq(paymentReceipt.id, id)).limit(1)
  const receipt =
    receiptRaw && (await canViewOwnedRecord(viewerId, receiptRaw.userId)) ? receiptRaw : null

  if (receipt) {
    const baseCustomer = (parseJson(receipt.customerSnapshot) as Record<string, unknown> | null) ?? {}
    if (!baseCustomer.name || !baseCustomer.email) {
      const { p, u } = await identity(receipt.userId)
      baseCustomer.name = baseCustomer.name ?? u?.name ?? null
      baseCustomer.cuil = baseCustomer.cuil ?? p?.cuil ?? null
      baseCustomer.dni = baseCustomer.dni ?? p?.dni ?? null
      baseCustomer.email = baseCustomer.email ?? u?.email ?? null
      baseCustomer.phone = baseCustomer.phone ?? p?.phone ?? null
      baseCustomer.employmentStatus = baseCustomer.employmentStatus ?? p?.employmentStatus ?? null
      baseCustomer.province = baseCustomer.province ?? p?.province ?? null
      baseCustomer.city = baseCustomer.city ?? p?.city ?? null
      baseCustomer.address = baseCustomer.address ?? p?.address ?? null
    }
    return {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      receiptType: receipt.receiptType,
      issuedAt: receipt.issuedAt ?? receipt.createdAt,
      paidAt: receipt.paidAt,
      amount: receipt.amount,
      currency: receipt.currency ?? 'ARS',
      method: receipt.method,
      referenceNumber: receipt.referenceNumber,
      loanSnapshot: parseJson(receipt.loanSnapshot),
      installmentSnapshot: parseJson(receipt.installmentSnapshot),
      previousBalance: receipt.previousBalance,
      newBalance: receipt.newBalance,
      pendingInstallments: receipt.pendingInstallments,
      totalPaidToDate: receipt.totalPaidToDate,
      customerSnapshot: baseCustomer,
      bankAccountSnapshot: parseJson(receipt.bankAccountSnapshot),
      branding: parseJson(receipt.branding) ?? { ...defaultBranding },
    }
  }

  const [disbRaw] = await db.select().from(disbursement).where(eq(disbursement.id, id)).limit(1)
  const disb = disbRaw && (await canViewOwnedRecord(viewerId, disbRaw.userId)) ? disbRaw : null
  if (!disb) return null

  const { p, u } = await identity(disb.userId)
  let bank = null
  if (disb.bankAccountId) {
    const [b] = await db.select().from(bankAccount).where(eq(bankAccount.id, disb.bankAccountId)).limit(1)
    bank = b ?? null
  }
  return {
    id: disb.id,
    receiptNumber: disb.receiptNumber ?? `ACR-${disb.id.slice(0, 10)}`,
    receiptType: 'disbursement',
    issuedAt: disb.creditedAt ?? disb.createdAt,
    paidAt: disb.creditedAt ?? disb.createdAt,
    amount: disb.amount,
    currency: disb.currency ?? 'ARS',
    method: disb.disbursementMethod,
    referenceNumber: disb.referenceNumber ?? disb.externalId,
    loanSnapshot: { id: disb.loanId, principal: disb.netAmount ?? disb.amount, status: 'disbursed' },
    installmentSnapshot: null,
    previousBalance: null,
    newBalance: null,
    pendingInstallments: null,
    totalPaidToDate: null,
    customerSnapshot: {
      name: u?.name ?? null,
      cuil: p?.cuil ?? null,
      dni: p?.dni ?? null,
      email: u?.email ?? null,
      phone: p?.phone ?? null,
      employmentStatus: p?.employmentStatus ?? null,
      province: p?.province ?? null,
      city: p?.city ?? null,
      address: p?.address ?? null,
    },
    bankAccountSnapshot: bank
      ? {
          bankName: bank.bankName,
          accountType: bank.accountType,
          cbu: bank.cbu,
          cvu: bank.cvu,
          alias: bank.alias,
          holderName: bank.holderName,
          holderCuil: bank.holderCuil,
        }
      : null,
    branding: { ...defaultBranding },
  }
}

export async function loadCustomerDocument(
  kind: string,
  id: string,
): Promise<CustomerDocumentPayload> {
  if (!isCustomerDocKind(kind) || !id.trim()) {
    return { ok: false, error: 'Documento no válido.' }
  }
  const viewerId = await requireUserId()
  const title = documentKindTitle(kind)

  try {
    if (kind === 'contrato' || kind === 'pagare' || kind === 'estado-deuda') {
      const contract = await loadContractPackForViewer(viewerId, id)
      if (!contract) return { ok: false, error: `${title} no encontrado.` }
      const prefix = kind === 'pagare' ? 'Pagare' : kind === 'estado-deuda' ? 'Estado-deuda' : 'Contrato'
      const code = kind === 'pagare' ? 'PAG' : kind === 'estado-deuda' ? 'ED' : 'CTR'
      return pack({
        ok: true,
        kind,
        title,
        fileName: documentPdfBaseName(prefix, shortDocCode(contract.id, code)),
        contract,
      })
    }

    if (kind === 'talonario') {
      const packByLoan = await loadLoanPackByLoanIdForViewer(viewerId, id)
      if (!packByLoan) return { ok: false, error: 'Talonario no encontrado.' }
      return pack({
        ok: true,
        kind: 'talonario',
        title,
        fileName: documentPdfBaseName('Cuponera', shortDocCode(id, 'CUP')),
        contract: packByLoan,
      })
    }

    if (kind === 'intimacion') {
      const contract = await loadContractPackForViewer(viewerId, id)
      if (!contract) return { ok: false, error: 'Intimación no encontrada.' }
      const decision = evaluateIntimation(asMoraRows(contract.installments), contract.lastRefinanceAt)
      if (!decision.ok || !decision.items.length) {
        return { ok: false, error: decision.message || 'No corresponde intimar.' }
      }
      const snapshot = contract.lastIntimation
      return pack({
        ok: true,
        kind: 'intimacion',
        title,
        fileName: documentPdfBaseName('Intimacion', snapshot?.number || shortDocCode(contract.id, 'INT')),
        contract,
        items: decision.items,
        noticeNumber: snapshot?.number,
        issuedAt: snapshot?.at,
      })
    }

    if (kind === 'arca') {
      if (!(await canViewOwnedRecord(viewerId, id))) {
        return { ok: false, error: 'Constancia ARCA no encontrada.' }
      }
      const snapshot = await loadConstanciaForUser(id)
      if (!snapshot) return { ok: false, error: 'ARCA no devolvió constancia para este CUIT.' }
      const [holder] = await db.select({ name: user.name }).from(user).where(eq(user.id, id)).limit(1)
      return pack({
        ok: true,
        kind: 'arca',
        title,
        fileName: documentPdfBaseName('Constancia-ARCA', snapshot.cuil),
        snapshot,
        holderName: holder?.name,
      })
    }

    if (kind === 'bcra') {
      const [raw] = await db.select().from(bcraReport).where(eq(bcraReport.id, id)).limit(1)
      if (!raw || !(await canViewOwnedRecord(viewerId, raw.userId))) {
        return { ok: false, error: 'Informe BCRA no encontrado.' }
      }
      const { p, u } = await identity(raw.userId)
      let branding: Record<string, unknown> = (raw.branding as Record<string, unknown> | null) ?? {}
      if (typeof raw.branding === 'string') {
        try {
          branding = JSON.parse(raw.branding)
        } catch {
          branding = {}
        }
      }
      let full: Record<string, unknown> = (raw.fullReportData as Record<string, unknown> | null) ?? {}
      if (typeof raw.fullReportData === 'string') {
        try {
          full = JSON.parse(raw.fullReportData)
        } catch {
          full = {}
        }
      }
      const reportNumber = raw.reportNumber ?? `INF-BCRA-${id.slice(0, 8).toUpperCase()}`
      const report = {
        id,
        reportNumber,
        scoreAtGeneration: raw.scoreAtGeneration,
        worstSituation: raw.worstSituation,
        totalDebt: raw.totalDebt,
        entitiesCount: raw.entitiesCount,
        hasRejectedChecks: !!raw.hasRejectedChecks,
        createdAt: raw.createdAt ?? new Date(),
        expiresAt: raw.expiresAt,
        branding,
        customer: {
          name: u?.name ?? null,
          cuil: p?.cuil ?? null,
          dni: p?.dni ?? null,
          email: u?.email ?? null,
          city: p?.city ?? null,
          province: p?.province ?? null,
        },
        fullReportData: full,
        synthetic: false,
      }
      return pack({
        ok: true,
        kind: 'bcra',
        title,
        fileName: documentPdfBaseName('Informe-BCRA', String(reportNumber)),
        report,
        extract: snapshotFromStored(full, p?.cuil ?? undefined),
      })
    }

    if (kind === 'recibo') {
      const receipt = await loadReceiptDoc(viewerId, id)
      if (!receipt) return { ok: false, error: 'Comprobante no encontrado.' }
      return pack({
        ok: true,
        kind: 'recibo',
        title,
        fileName: documentPdfBaseName(
          receipt.receiptType === 'service_payment' ? 'Ticket-Servicio' : 'Comprobante',
          String(receipt.receiptNumber),
        ),
        receipt,
      })
    }

    if (kind === 'liquidacion') {
      const [receiptRaw] = await db.select().from(paymentReceipt).where(eq(paymentReceipt.id, id)).limit(1)
      const receipt =
        receiptRaw && (await canViewOwnedRecord(viewerId, receiptRaw.userId)) ? receiptRaw : null
      if (!receipt) return { ok: false, error: 'Liquidación no encontrada.' }
      const loan = (parseJson(receipt.loanSnapshot) as Record<string, unknown> | null) ?? {}
      const inst = (parseJson(receipt.installmentSnapshot) as Record<string, unknown> | null) ?? {}
      let customer = (parseJson(receipt.customerSnapshot) as Record<string, unknown> | null) ?? {}
      if (!customer.name) {
        const { p, u } = await identity(receipt.userId)
        customer = { name: u?.name, cuil: p?.cuil, dni: p?.dni, email: u?.email }
      }
      return pack({
        ok: true,
        kind: 'liquidacion',
        title,
        fileName: documentPdfBaseName('Liquidacion', String(receipt.receiptNumber)),
        data: {
          id: receipt.id,
          number: `LIQ-${receipt.receiptNumber}`,
          issuedAt: receipt.issuedAt ?? receipt.createdAt,
          paidAt: receipt.paidAt,
          amount: receipt.amount,
          method: receipt.method,
          reference: receipt.referenceNumber,
          customer: {
            name: customer.name as string | undefined,
            cuil: customer.cuil as string | undefined,
            dni: customer.dni as string | undefined,
            email: customer.email as string | undefined,
          },
          loan: {
            id: String(loan.id ?? receipt.loanId ?? ''),
            principal: loan.principal as string | number | undefined,
            term: loan.term as number | undefined,
            monthlyRate: loan.monthlyRate as string | number | undefined,
            tna: loan.tna as string | number | undefined,
          },
          installment: {
            number: inst.number as number | undefined,
            dueDate: inst.dueDate as Date | string | undefined,
            amount: inst.amount as string | number | undefined,
          },
        },
      })
    }

    const certKind: LoanCertificateKind =
      kind === 'libre-deuda' ? 'libre_deuda' : kind === 'cancelacion' ? 'cancelacion' : 'solvencia'
    const certificate = await loadLoanCertificateForViewer(viewerId, id, certKind)
    if (!certificate) {
      return {
        ok: false,
        error:
          kind === 'libre-deuda'
            ? 'Todavía hay saldo. La libre deuda se emite cuando el crédito está cancelado.'
            : kind === 'cancelacion'
              ? 'No hay cuotas pendientes para liquidar un prepago.'
              : 'Hay mora. La solvencia se emite cuando el crédito está al día.',
      }
    }
    const label = kind === 'libre-deuda' ? 'Libre-deuda' : kind === 'cancelacion' ? 'Cancelacion' : 'Solvencia'
    return pack({
      ok: true,
      kind,
      title,
      fileName: documentPdfBaseName(label, shortDocCode(id, 'LOAN')),
      certificate,
    })
  } catch (err) {
    console.error('[loadCustomerDocument]', kind, err)
    return { ok: false, error: 'No se pudo abrir el documento.' }
  }
}

async function loadLoanPackByLoanIdForViewer(viewerId: string, loanId: string) {
  const [loanRow] = await db.select({ userId: loan.userId }).from(loan).where(eq(loan.id, loanId)).limit(1)
  if (!loanRow || !(await canViewOwnedRecord(viewerId, loanRow.userId))) return null
  return loadLoanPackByLoanId(loanRow.userId, loanId)
}
