import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { disbursementEmail, emailOrigin, paymentReceivedEmail, payoutEmail, sendEmail, type EmailMessage } from '@/lib/email'

/** Avisos por correo de la billetera. Nunca cortan el flujo de dinero que los dispara. */

async function userMail(userId: string) {
  const [row] = await db.select({ email: userTable.email, name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  return row?.email ? row : null
}

async function deliver(label: string, build: (u: { email: string; name: string | null }) => EmailMessage, userId: string) {
  try {
    const u = await userMail(userId)
    if (!u) return
    const res = await sendEmail(build(u))
    if (!res.ok) console.warn(`[wallet-notify] ${label} no entregado:`, res.error)
  } catch (err) {
    console.warn(`[wallet-notify] aviso de ${label} omitido:`, (err as Error).message)
  }
}

export function notifyPayoutResult(input: { userId: string; status: 'executed' | 'cancelled'; amount: string; reference: string; reason?: string }) {
  return deliver('retiro', (u) => payoutEmail({ to: u.email, name: u.name, ...input }), input.userId)
}

export function notifyDisbursementCredited(input: { userId: string; amount: string }) {
  return deliver(
    'desembolso',
    (u) => disbursementEmail({ to: u.email, name: u.name, amount: input.amount, receiptUrl: `${emailOrigin()}/dashboard/billetera` }),
    input.userId,
  )
}

export function notifyPaymentReceived(input: { userId: string; amount: string | number; installmentNumber?: number | null; receiptId?: string | null }) {
  return deliver(
    'pago',
    (u) =>
      paymentReceivedEmail({
        to: u.email,
        name: u.name,
        amount: input.amount,
        installmentLabel: input.installmentNumber ? `cuota ${input.installmentNumber}` : undefined,
        receiptUrl: input.receiptId ? `${emailOrigin()}/dashboard/documentos/recibo/${input.receiptId}` : `${emailOrigin()}/dashboard/pagos/historial`,
      }),
    input.userId,
  )
}
