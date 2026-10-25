import { startOfDayAR } from '@/lib/date-ar'
import { db } from '@/lib/db'
import { installment, loanContract, user as userTable } from '@/lib/db/schema'
import { contractReadyEmail, sendEmail } from '@/lib/email'
import { publicSiteUrl } from '@/lib/site'
import { and, eq, lt } from 'drizzle-orm'

export const CONTRACT_VERSION = '2.0'

type DbLike = {
  select: (...args: any[]) => any
  insert: (...args: any[]) => any
  update: (...args: any[]) => any
}

export type IntimationSnapshot = {
  number: string
  at: string
  overdueCount: number
  amount: number
  installments: Array<{
    number: number
    dueDate: string
    amount: number
    daysLate: number
  }>
}

export type RefinanceSnapshot = {
  number: number
  at: string
  outstanding: number
  installmentAmount: number
  remainingCount: number
}

export type ContractSignatureData = {
  pagareNumber?: string
  instruments?: string[]
  version?: string
  acceptedAs?: string
  intimaciones?: IntimationSnapshot[]
  refinanciaciones?: RefinanceSnapshot[]
}

function pagareNumberFor(loanId: string) {
  return `PAG-${loanId.slice(-8).toUpperCase()}`
}

function asSignature(value: unknown): ContractSignatureData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as ContractSignatureData
}

export async function ensureLoanContract(
  tx: DbLike,
  loanRow: {
    id: string
    userId: string
    type?: string | null
    status: string
  },
  opts?: { generatedBy?: string; now?: Date },
): Promise<{ id: string; status: string; created: boolean } | null> {
  if (loanRow.status !== 'approved' && loanRow.status !== 'active') return null

  const now = opts?.now ?? new Date()
  const [existing] = await tx
    .select({
      id: loanContract.id,
      status: loanContract.status,
      signatureData: loanContract.signatureData,
      effectiveDate: loanContract.effectiveDate,
    })
    .from(loanContract)
    .where(eq(loanContract.loanId, loanRow.id))
    .limit(1)

  const templateName =
    loanRow.type === 'merchant' || loanRow.type === 'comercio'
      ? 'prestamo_comercial_ars'
      : 'prestamo_personal_ars'
  const pagareNumber = pagareNumberFor(loanRow.id)

  if (existing) {
    if (existing.status !== 'accepted') {
      const prev = asSignature(existing.signatureData)
      await tx
        .update(loanContract)
        .set({
          version: CONTRACT_VERSION,
          templateName,
          effectiveDate: existing.effectiveDate ?? now,
          // Ventana de aceptación de la oferta (30 días). No es la vigencia del plan de cuotas.
          expirationDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
          signatureData: { ...prev, pagareNumber },
          updatedAt: now,
        })
        .where(eq(loanContract.id, existing.id))
    }
    return { id: existing.id, status: existing.status, created: false }
  }

  const id = crypto.randomUUID()
  await tx.insert(loanContract).values({
    id,
    loanId: loanRow.id,
    userId: loanRow.userId,
    status: 'pending_acceptance',
    templateName,
    version: CONTRACT_VERSION,
    effectiveDate: now,
    // Ventana de aceptación de la oferta (30 días). No es la vigencia del plan de cuotas.
    expirationDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
    generatedBy: opts?.generatedBy ?? 'system',
    signatureData: { pagareNumber, instruments: [] },
    createdAt: now,
    updatedAt: now,
  })
  return { id, status: 'pending_acceptance', created: true }
}

export async function requireAcceptedContract(loanId: string) {
  const [c] = await db
    .select({
      id: loanContract.id,
      status: loanContract.status,
      userId: loanContract.userId,
    })
    .from(loanContract)
    .where(eq(loanContract.loanId, loanId))
    .limit(1)

  if (!c) {
    throw new Error(
      'No hay contrato emitido. Generá el expediente y pedile al cliente que firme el contrato y el pagaré.',
    )
  }
  if (c.status !== 'accepted') {
    throw new Error(
      'El cliente debe aceptar el contrato y el pagaré antes de acreditar el desembolso.',
    )
  }
  return c
}

export async function syncOverdueInstallments(filter?: { loanId?: string; userId?: string }) {
  // Hoy a las 00:00 de Argentina: una cuota vence recien al terminar su dia civil argentino.
  const today = startOfDayAR()
  const conds = [eq(installment.status, 'pending'), lt(installment.dueDate, today)]
  if (filter?.loanId) conds.push(eq(installment.loanId, filter.loanId))
  if (filter?.userId) conds.push(eq(installment.userId, filter.userId))

  const rows = await db
    .update(installment)
    .set({ status: 'overdue' })
    .where(and(...conds))
    .returning({ id: installment.id })
  return rows.length
}

function appOrigin() {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || publicSiteUrl()
}

export async function notifyContractReady(input: {
  userId: string
  contractId: string
  principal: string | number
  term: number
}) {
  try {
    const [u] = await db
      .select({ email: userTable.email, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, input.userId))
      .limit(1)
    if (!u?.email) return
    await sendEmail(
      contractReadyEmail({
        to: u.email,
        name: u.name,
        contractUrl: `${appOrigin()}/dashboard/documentos/contrato/${input.contractId}`,
        principal: input.principal,
        term: input.term,
      }),
    )
  } catch (err) {
    console.error('[expediente] no se pudo avisar el contrato:', (err as Error).message)
  }
}

export function readSignatureData(value: unknown): ContractSignatureData {
  return asSignature(value)
}

export function lastRefinanceAt(value: unknown): string | null {
  const list = asSignature(value).refinanciaciones ?? []
  return list[list.length - 1]?.at ?? null
}

