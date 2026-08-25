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
  loanRejectedEmail,
  paymentReceivedEmail,
  paymentRejectedEmail,
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
