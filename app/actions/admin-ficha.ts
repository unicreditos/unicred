'use server'

import { requireAdmin } from '@/app/actions/admin'
import { db } from '@/lib/db'
import {
  bankAccount,
  bcraCheck,
  diditSession,
  disbursement,
  installment,
  kycVerification,
  loan,
  loanContract,
  payment,
  paymentReceipt,
  profile,
  user as userTable,
} from '@/lib/db/schema'
import { computeEarlySettlement } from '@/lib/legal/settlement'
import { parseDiditCapture, type DiditCapture } from '@/lib/didit-capture'
import { applyDiditDecision, getDiditDecision, isDiditConfigured } from '@/lib/didit'
import { lastRefinanceAt, readSignatureData, syncOverdueInstallments } from '@/lib/legal/expediente'
import { asMoraRows, evaluateIntimation, evaluateRefinance } from '@/lib/legal/mora'
import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type ClientFichaStatus = 'al_dia' | 'vencido' | 'pendiente' | 'finalizado'

export type ClientFichaCredit = {
  id: string
  principal: number
  totalAmount: number
  installmentAmount: number
  term: number
  status: string
  createdAt: string
  disbursedAt: string | null
  paidCount: number
  overdueCount: number
  pendingCount: number
  nextDue: string | null
  outstanding: number
  chip: ClientFichaStatus
  monthlyRate: number
  tna: number | null
  contractId: string | null
  contractStatus: string | null
  disbursementId: string | null
  disbursementStatus: string | null
  proofUrl: string | null
  refinanceCount: number
  lastRefinanceAt: string | null
  intimationEligible: boolean
  intimationReason: string
  intimableAmount: number
  refinanceEligible: boolean
  refinanceReason: string
  settlement: {
    remainingCapital: number
    contractualRemaining: number
    interestDeduction: number
    settlementAmount: number
  }
  installments: Array<{
    id: string
    number: number
    amount: number
    dueDate: string
    status: string
    paidAt: string | null
  }>
}

export type FichaDocStatus = 'disponible' | 'pendiente' | 'no_corresponde'

export type FichaDocRow = {
  key: string
  loanId: string
  label: string
  href: string | null
  status: FichaDocStatus
  hint: string
  amount: number | null
  date: string | null
}

export type FichaPaymentRow = {
  id: string
  receiptId: string | null
  loanId: string | null
  installmentId: string | null
  amount: number
  method: string | null
  paidAt: string | null
  reference: string | null
  status: string
  receiptNumber: string | null
}

export type ClientFicha = {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    banned: boolean
    createdAt: string
    role: string
  }
  profile: {
    cuil: string | null
    dni: string | null
    birthDate: string | null
    phone: string | null
    province: string | null
    department: string | null
    city: string | null
    postalCode: string | null
    address: string | null
    monthlyIncome: number | null
    employmentStatus: string | null
    kycStatus: string
    creditScore: number | null
  }
  kyc: {
    status: string | null
    provider: string | null
    sessionId: string | null
    faceMatchScore: number | null
    dniNumber: string | null
    rejectionReason: string | null
    reviewedAt: string | null
  }
  didit: DiditCapture
  documents: Array<{ key: string; label: string; ok: boolean; source: string }>
  credits: ClientFichaCredit[]
  expediente: FichaDocRow[]
  payments: FichaPaymentRow[]
  totals: { outstanding: number; overdueCount: number; documentsOk: number; documentsTotal: number }
  chip: ClientFichaStatus
  bank: Array<{ bankName: string; cbu: string | null; cvu: string | null; alias: string | null; verified: boolean }>
  bcra: { worstSituation: number | null; totalDebt: number | null; score: number | null; consultedAt: string | null } | null
}

function money(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function creditChip(loanStatus: string, overdueCount: number, paidCount: number, term: number): ClientFichaStatus {
  if (loanStatus === 'paid' || (term > 0 && paidCount >= term)) return 'finalizado'
  if (overdueCount > 0) return 'vencido'
  return 'al_dia'
}

export async function getAdminClientFicha(userId: string, opts?: { refreshDidit?: boolean }): Promise<ClientFicha> {
  await requireAdmin()

  const [person] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  if (!person) throw new Error('Persona no encontrada.')
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  const [kyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const [session] = await db
    .select()
    .from(diditSession)
    .where(eq(diditSession.userId, userId))
    .orderBy(desc(diditSession.updatedAt))
    .limit(1)

  const sessionId = session?.sessionId || kyc?.providerReferenceId || null
  if (opts?.refreshDidit !== false && sessionId && isDiditConfigured()) {
    try {
      const decision = await getDiditDecision(sessionId)
      const status = String(decision.status ?? session?.status ?? '')
      if (status) {
        await applyDiditDecision({
          sessionId,
          vendorData: typeof decision.vendor_data === 'string' ? decision.vendor_data : session?.vendorData,
          status,
          decision,
          userId,
        })
      }
    } catch (err) {
      console.warn('[ficha] no se pudo refrescar Didit:', (err as Error).message)
    }
  }

  const [freshKyc] = await db.select().from(kycVerification).where(eq(kycVerification.userId, userId)).limit(1)
  const [freshSession] = await db
    .select()
    .from(diditSession)
    .where(eq(diditSession.userId, userId))
    .orderBy(desc(diditSession.updatedAt))
    .limit(1)

  const ocr = (freshKyc?.ocrData as Record<string, unknown> | null) ?? null
  const didit = parseDiditCapture(freshSession?.decision ?? ocr, {
    sessionId: freshSession?.sessionId ?? sessionId,
    status: freshSession?.status ?? null,
  })

  await syncOverdueInstallments({ userId })
  const [loans, rows, contracts, disbs, receipts, payments] = await Promise.all([
    db.select().from(loan).where(eq(loan.userId, userId)).orderBy(desc(loan.createdAt)),
    db.select().from(installment).where(eq(installment.userId, userId)),
    db.select().from(loanContract).where(eq(loanContract.userId, userId)),
    db.select().from(disbursement).where(eq(disbursement.userId, userId)),
    db.select().from(paymentReceipt).where(eq(paymentReceipt.userId, userId)).orderBy(desc(paymentReceipt.issuedAt)),
    db.select().from(payment).where(eq(payment.userId, userId)).orderBy(desc(payment.createdAt)),
  ])

  const contractByLoan = new Map(contracts.map((item) => [item.loanId, item]))
  const disbByLoan = new Map(disbs.map((item) => [item.loanId, item]))

  const credits: ClientFichaCredit[] = loans.map((item) => {
    const plan = rows.filter((row) => row.loanId === item.id).sort((a, b) => a.number - b.number)
    const paid = plan.filter((row) => row.status === 'paid')
    const overdue = plan.filter((row) => row.status === 'overdue')
    const pending = plan.filter((row) => row.status === 'pending')
    const next = pending[0] ?? overdue[0] ?? null
    const outstanding = plan
      .filter((row) => row.status !== 'paid')
      .reduce((sum, row) => sum + money(row.amount), 0)
    const settlement = computeEarlySettlement({
      principal: money(item.principal),
      monthlyRate: money(item.monthlyRate),
      term: item.term,
      paidCount: paid.length,
      unpaidAmounts: plan.filter((row) => row.status !== 'paid').map((row) => money(row.amount)),
    })
    const contract = contractByLoan.get(item.id)
    const disb = disbByLoan.get(item.id)
    const refinanceAt = lastRefinanceAt(contract?.signatureData)
    const moraRows = asMoraRows(plan)
    const intimacion = evaluateIntimation(moraRows, refinanceAt)
    const refinanciacion = evaluateRefinance(
      moraRows,
      readSignatureData(contract?.signatureData).refinanciaciones?.length ?? 0,
    )
    return {
      id: item.id,
      principal: money(item.principal),
      totalAmount: money(item.totalAmount),
      installmentAmount: money(item.installmentAmount),
      term: item.term,
      status: item.status,
      createdAt: iso(item.createdAt) || new Date().toISOString(),
      disbursedAt: iso(item.disbursedAt),
      paidCount: paid.length,
      overdueCount: overdue.length,
      pendingCount: pending.length,
      nextDue: iso(next?.dueDate),
      outstanding,
      chip: creditChip(item.status, overdue.length, paid.length, item.term),
      monthlyRate: money(item.monthlyRate),
      tna: item.tna == null ? null : money(item.tna),
      contractId: contract?.id ?? null,
      contractStatus: contract?.status ?? null,
      disbursementId: disb?.id ?? null,
      disbursementStatus: disb?.status ?? null,
      proofUrl: disb?.proofUrl ?? null,
      refinanceCount: readSignatureData(contract?.signatureData).refinanciaciones?.length ?? 0,
      lastRefinanceAt: refinanceAt,
      intimationEligible: intimacion.ok,
      intimationReason: intimacion.message,
      intimableAmount: intimacion.amount,
      refinanceEligible: refinanciacion.ok,
      refinanceReason: refinanciacion.message,
      settlement,
      installments: plan.map((row) => ({
        id: row.id,
        number: row.number,
        amount: money(row.amount),
        dueDate: iso(row.dueDate) || '',
        status: row.status,
        paidAt: iso(row.paidAt),
      })),
    }
  })

  const expediente: FichaDocRow[] = credits.flatMap((credit) => {
    const contractReady = Boolean(credit.contractId)
    const paidOff = credit.chip === 'finalizado'
    const current = credit.overdueCount === 0 && (credit.status === 'active' || credit.status === 'approved' || paidOff)
    const disbReady = credit.disbursementStatus === 'credited'
    const loanReceipts = receipts.filter((row) => row.loanId === credit.id)
    const docs: FichaDocRow[] = [
      {
        key: `${credit.id}-contrato`,
        loanId: credit.id,
        label: 'Contrato de préstamo (mutuo)',
        href: credit.contractId ? `/dashboard/documentos/contrato/${credit.contractId}` : null,
        status: contractReady ? 'disponible' : 'pendiente',
        hint: credit.contractStatus === 'accepted' ? 'Firmado' : contractReady ? 'Pendiente de firma' : 'Se emite al aprobar',
        amount: credit.principal,
        date: credit.createdAt,
      },
      {
        key: `${credit.id}-pagare`,
        loanId: credit.id,
        label: 'Pagaré',
        href: credit.contractId ? `/dashboard/documentos/pagare/${credit.contractId}` : null,
        status: contractReady ? 'disponible' : 'pendiente',
        hint: credit.contractStatus === 'accepted' ? 'Librado' : 'Acompaña al contrato',
        amount: credit.totalAmount,
        date: credit.createdAt,
      },
      {
        key: `${credit.id}-estado`,
        loanId: credit.id,
        label: 'Estado de deuda',
        href: credit.contractId ? `/dashboard/documentos/estado-deuda/${credit.contractId}` : null,
        status: contractReady ? 'disponible' : 'pendiente',
        hint: paidOff ? 'Saldo cero' : `${credit.pendingCount + credit.overdueCount} cuotas abiertas`,
        amount: credit.outstanding,
        date: credit.nextDue,
      },
      {
        key: `${credit.id}-cuponera`,
        loanId: credit.id,
        label: 'Cuponera de cuotas',
        href: `/dashboard/documentos/cuponera/${credit.id}`,
        status: credit.installments.length ? 'disponible' : 'pendiente',
        hint: 'Código de barras único por cuota',
        amount: credit.outstanding,
        date: credit.nextDue,
      },
      {
        key: `${credit.id}-intimacion`,
        loanId: credit.id,
        label: 'Intimación de mora',
        href: credit.intimationEligible && credit.contractId ? `/dashboard/documentos/intimacion/${credit.contractId}` : null,
        status: credit.intimationEligible ? 'disponible' : 'no_corresponde',
        hint: credit.intimationReason,
        amount: credit.intimationEligible ? credit.intimableAmount : null,
        date: null,
      },
      {
        key: `${credit.id}-desembolso`,
        loanId: credit.id,
        label: 'Comprobante de desembolso',
        href: credit.disbursementId && disbReady ? `/dashboard/documentos/recibo/${credit.disbursementId}` : null,
        status: disbReady ? 'disponible' : 'pendiente',
        hint: disbReady ? 'Acreditado en cuenta del titular' : 'Espera acreditación',
        amount: credit.principal,
        date: credit.disbursedAt,
      },
      {
        key: `${credit.id}-transferencia`,
        loanId: credit.id,
        label: 'Comprobante de transferencia',
        href: credit.proofUrl,
        status: credit.proofUrl ? 'disponible' : disbReady ? 'pendiente' : 'no_corresponde',
        hint: credit.proofUrl ? 'Respaldo cargado por tesorería' : disbReady ? 'Falta adjuntar el extracto' : 'Se pide al acreditar',
        amount: credit.principal,
        date: credit.disbursedAt,
      },
      ...loanReceipts
        .filter((row) => row.receiptType !== 'disbursement')
        .flatMap((row) => [
          {
            key: `${row.id}-recibo`,
            loanId: credit.id,
            label: `Recibo ${row.receiptNumber}`,
            href: `/dashboard/documentos/recibo/${row.id}`,
            status: 'disponible' as const,
            hint: row.method || 'Pago del cliente',
            amount: money(row.amount),
            date: iso(row.paidAt || row.issuedAt),
          },
          {
            key: `${row.id}-liq`,
            loanId: credit.id,
            label: `Liquidación ${row.receiptNumber}`,
            href: `/dashboard/documentos/liquidacion/${row.id}`,
            status: 'disponible' as const,
            hint: 'Capital e interés de la cuota',
            amount: money(row.amount),
            date: iso(row.paidAt || row.issuedAt),
          },
        ]),
      {
        key: `${credit.id}-solvencia`,
        loanId: credit.id,
        label: 'Certificado de solvencia',
        href: current ? `/dashboard/documentos/solvencia/${credit.id}` : null,
        status: current ? 'disponible' : 'no_corresponde',
        hint: current ? 'Al día en UNICRÉDITOS' : 'Hay mora o el crédito no está vigente',
        amount: null,
        date: iso(new Date()),
      },
      {
        key: `${credit.id}-libre`,
        loanId: credit.id,
        label: 'Constancia de libre deuda',
        href: paidOff ? `/dashboard/documentos/libre-deuda/${credit.id}` : null,
        status: paidOff ? 'disponible' : 'no_corresponde',
        hint: paidOff ? 'Crédito cancelado' : 'Se emite al saldar todas las cuotas',
        amount: 0,
        date: paidOff ? credit.installments.find((row) => row.status === 'paid')?.paidAt ?? null : null,
      },
      {
        key: `${credit.id}-cancelacion`,
        loanId: credit.id,
        label: 'Cancelación anticipada',
        href: credit.outstanding > 0 ? `/dashboard/documentos/cancelacion/${credit.id}` : null,
        status: credit.outstanding > 0 ? 'disponible' : 'no_corresponde',
        hint:
          credit.outstanding > 0
            ? `Deduce ${credit.settlement.interestDeduction.toLocaleString('es-AR')} de intereses no devengados`
            : 'Sin saldo para prepagar',
        amount: credit.settlement.settlementAmount,
        date: iso(new Date()),
      },
    ]
    return docs
  })

  const paymentsView: FichaPaymentRow[] = payments.map((row) => {
    const receipt = receipts.find((item) => item.paymentId === row.id) ?? null
    return {
      id: row.id,
      receiptId: receipt?.id ?? null,
      loanId: row.loanId,
      installmentId: row.installmentId,
      amount: money(row.amount),
      method: row.method,
      paidAt: iso(row.paidAt),
      reference: row.referenceNumber || row.externalId,
      status: row.status,
      receiptNumber: receipt?.receiptNumber ?? null,
    }
  })

  const idOk = didit.ids.some((item) => item.status === 'Approved') || freshKyc?.status === 'approved'
  const faceOk = didit.faces.some((item) => item.status === 'Approved') || Number(freshKyc?.faceMatchScore) >= 80
  const liveOk = didit.liveness.some((item) => item.status === 'Approved')
  const addressOk = Boolean(prof?.address && prof.city && prof.province)
  const incomeOk = money(prof?.monthlyIncome) > 0
  const documents = [
    { key: 'dni', label: 'DNI validado por Didit', ok: idOk, source: 'Didit OCR' },
    { key: 'liveness', label: 'Prueba de vida', ok: liveOk, source: 'Didit liveness' },
    { key: 'face', label: 'Coincidencia facial', ok: faceOk, source: 'Didit face match' },
    { key: 'domicilio', label: 'Domicilio en ficha UNICRÉDITOS', ok: addressOk, source: 'Perfil / padrón' },
    { key: 'ingresos', label: 'Ingresos declarados', ok: incomeOk, source: 'Perfil UNICRÉDITOS' },
  ]

  const overdueCount = credits.reduce((sum, item) => sum + item.overdueCount, 0)
  const outstanding = credits.reduce((sum, item) => sum + item.outstanding, 0)
  const kycStatus = freshKyc?.status || prof?.kycStatus || 'pending'
  const allPaid = credits.length > 0 && credits.every((item) => item.chip === 'finalizado')
  const chip: ClientFichaStatus =
    overdueCount > 0 ? 'vencido' : kycStatus !== 'approved' ? 'pendiente' : allPaid ? 'finalizado' : 'al_dia'

  const banks = await db.select().from(bankAccount).where(eq(bankAccount.userId, userId))
  const [lastBcra] = await db
    .select()
    .from(bcraCheck)
    .where(eq(bcraCheck.userId, userId))
    .orderBy(desc(bcraCheck.createdAt))
    .limit(1)

  return {
    user: {
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phoneNumber || prof?.phone || null,
      banned: Boolean(person.banned),
      createdAt: iso(person.createdAt) || new Date().toISOString(),
      role: prof?.role || person.role || 'customer',
    },
    profile: {
      cuil: prof?.cuil ?? null,
      dni: prof?.dni || didit.ids[0]?.documentNumber || freshKyc?.dniNumber || null,
      birthDate: prof?.birthDate || didit.ids[0]?.birthDate || null,
      phone: prof?.phone || person.phoneNumber || null,
      province: prof?.province ?? null,
      department: prof?.department ?? null,
      city: prof?.city ?? null,
      postalCode: prof?.postalCode ?? null,
      address: prof?.address || didit.ids[0]?.address || null,
      monthlyIncome: prof?.monthlyIncome == null ? null : money(prof.monthlyIncome),
      employmentStatus: prof?.employmentStatus ?? null,
      kycStatus,
      creditScore: prof?.creditScore ?? null,
    },
    kyc: {
      status: freshKyc?.status ?? null,
      provider: freshKyc?.provider ?? null,
      sessionId: freshSession?.sessionId ?? sessionId,
      faceMatchScore: freshKyc?.faceMatchScore == null ? null : Number(freshKyc.faceMatchScore),
      dniNumber: freshKyc?.dniNumber ?? didit.ids[0]?.documentNumber ?? null,
      rejectionReason: freshKyc?.rejectionReason ?? null,
      reviewedAt: iso(freshKyc?.reviewedAt),
    },
    didit,
    documents,
    credits,
    expediente,
    payments: paymentsView,
    totals: {
      outstanding,
      overdueCount,
      documentsOk: documents.filter((item) => item.ok).length,
      documentsTotal: documents.length,
    },
    chip,
    bank: banks.map((item) => ({
      bankName: item.bankName,
      cbu: item.cbu,
      cvu: item.cvu,
      alias: item.alias,
      verified: item.isVerified,
    })),
    bcra: lastBcra
      ? {
          worstSituation: lastBcra.worstSituation,
          totalDebt: lastBcra.totalDebt == null ? null : money(lastBcra.totalDebt),
          score: lastBcra.computedScore,
          consultedAt: iso(lastBcra.consultedAt || lastBcra.createdAt),
        }
      : null,
  }
}

export async function refreshAdminClientFicha(userId: string) {
  const ficha = await getAdminClientFicha(userId, { refreshDidit: true })
  revalidatePath('/admin')
  return ficha
}
