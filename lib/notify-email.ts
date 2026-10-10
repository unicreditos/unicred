/**
 * Avisos de movimiento: el cliente recibe el mail y tesorería una copia (BCC),
 * salvo recupero de clave y KYC. Nunca corta el flujo de negocio.
 */

import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import {
  disbursementEmail,
  emailOrigin,
  kycStatusEmail,
  infoRequestEmail,
  loanCancelledEmail,
  loanConditionsEmail,
  loanRejectedEmail,
  loanReopenedEmail,
  paymentReceivedEmail,
  paymentRejectedEmail,
  claimReceivedEmail,
  sendEmail,
  type EmailMessage,
} from '@/lib/email'
import { eq } from 'drizzle-orm'

async function userMail(userId: string) {
  const [row] = await db
    .select({ email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  return row?.email ? row : null
}

async function deliver(message: EmailMessage) {
  try {
    const result = await sendEmail(message)
    if (!result.ok) console.error('[notify-email] no entregado:', message.subject, result.error)
  } catch (err) {
    console.error('[notify-email]', err instanceof Error ? err.message : err)
  }
}

export async function notifyPaymentReceived(input: {
  userId: string
  amount: string | number
  installmentNumber?: number | null
  receiptId?: string | null
}) {
  const u = await userMail(input.userId)
  if (!u) return
  const origin = emailOrigin()
  const receiptUrl = input.receiptId
    ? `${origin}/dashboard/documentos/recibo/${input.receiptId}`
    : `${origin}/dashboard?tab=comprobantes`
  await deliver(
    paymentReceivedEmail({
      to: u.email,
      name: u.name,
      amount: input.amount,
      installmentLabel: input.installmentNumber != null ? `cuota ${input.installmentNumber}` : undefined,
      receiptUrl,
    }),
  )
}

export async function notifyPaymentRejected(input: {
  userId: string
  amount: string | number
  reason?: string
}) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    paymentRejectedEmail({
      to: u.email,
      name: u.name,
      amount: input.amount,
      reason: input.reason,
      panelUrl: `${emailOrigin()}/dashboard?tab=pagos`,
    }),
  )
}

export async function notifyLoanRejected(input: { userId: string; reason: string }) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    loanRejectedEmail({
      to: u.email,
      name: u.name,
      reason: input.reason,
      panelUrl: `${emailOrigin()}/dashboard?tab=mis_solicitudes`,
    }),
  )
}

export async function notifyDisbursementCredited(input: {
  userId: string
  amount: string | number
  receiptId?: string | null
}) {
  const u = await userMail(input.userId)
  if (!u) return
  const origin = emailOrigin()
  const receiptUrl = input.receiptId
    ? `${origin}/dashboard/documentos/recibo/${input.receiptId}`
    : `${origin}/dashboard?tab=comprobantes`
  await deliver(
    disbursementEmail({
      to: u.email,
      name: u.name,
      amount: input.amount,
      receiptUrl,
    }),
  )
}

export async function notifyInfoRequest(input: { userId: string; loanId: string; message: string }) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    infoRequestEmail({
      to: u.email,
      name: u.name,
      message: input.message,
      panelUrl: `${emailOrigin()}/dashboard/creditos/${input.loanId}`,
    }),
  )
}

export async function notifyLoanConditions(input: {
  userId: string
  loanId: string
  principal: string | number
  term: number
  note?: string
}) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    loanConditionsEmail({
      to: u.email,
      name: u.name,
      principal: input.principal,
      term: input.term,
      note: input.note,
      panelUrl: `${emailOrigin()}/dashboard/creditos/${input.loanId}`,
    }),
  )
}

export async function notifyLoanCancelled(input: { userId: string; loanId: string; reason?: string }) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    loanCancelledEmail({
      to: u.email,
      name: u.name,
      reason: input.reason,
      panelUrl: `${emailOrigin()}/dashboard/creditos/${input.loanId}`,
    }),
  )
}

export async function notifyLoanReopened(input: { userId: string; loanId: string }) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    loanReopenedEmail({
      to: u.email,
      name: u.name,
      panelUrl: `${emailOrigin()}/dashboard/creditos/${input.loanId}`,
    }),
  )
}

export async function notifyKycDecision(input: { userId: string; status: 'approved' | 'rejected' }) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    kycStatusEmail({
      to: u.email,
      name: u.name,
      status: input.status,
      panelUrl: `${emailOrigin()}/dashboard?tab=kyc_biometrico`,
    }),
  )
}

export async function notifySupportClaim(input: {
  userId: string
  caseId: string
  subject: string
}) {
  const u = await userMail(input.userId)
  if (!u) return
  await deliver(
    claimReceivedEmail({
      to: u.email,
      name: u.name,
      caseId: input.caseId,
      subjectLine: input.subject,
      panelUrl: `${emailOrigin()}/dashboard?tab=reclamos`,
    }),
  )
}
