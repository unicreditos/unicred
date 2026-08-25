import { createPaymentFromBrick } from '@/lib/mercadopago'
import { db } from '@/lib/db'
import { payment } from '@/lib/db/schema'
import { requireUserId } from '@/lib/session'
import { settleMercadoPagoPayment } from '@/lib/payments/settle-mp'
import { notifyPaymentReceived, notifyPaymentRejected } from '@/lib/notify-email'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const userId = await requireUserId()
  const body = await req.json().catch(() => null)
  const localPaymentId = String(body?.localPaymentId ?? '').trim()
  const formData = body?.formData
  if (!localPaymentId || !formData || typeof formData !== 'object') {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  const [row] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.id, localPaymentId), eq(payment.userId, userId)))
    .limit(1)
  if (!row) return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 })
  if (row.status === 'paid') {
    return NextResponse.json({ ok: true, status: 'approved', alreadyPaid: true })
  }

  const previous = (row.gatewayResponse as Record<string, unknown> | null) ?? {}
  const installmentIds = Array.isArray(previous.installment_ids)
    ? previous.installment_ids
    : row.installmentId
      ? [row.installmentId]
      : []

  try {
    const created = await createPaymentFromBrick({
      ...formData,
      transaction_amount: Number(row.amount),
      external_reference: row.referenceNumber ?? localPaymentId,
      description: `UNICRÉDITOS · pago ${row.referenceNumber ?? localPaymentId}`,
      metadata: {
        local_payment_id: row.id,
        loan_id: row.loanId,
        user_id: userId,
        installment_ids: installmentIds,
      },
    })

    const mpId = created?.id ? String(created.id) : null
    await db
      .update(payment)
      .set({
        status: created?.status === 'rejected' ? 'failed' : 'processing',
        paymentLinkId: row.paymentLinkId,
        externalId: mpId ?? row.externalId,
        gatewayResponse: {
          ...previous,
          mp_payment_id: mpId,
          mp_status: created?.status ?? null,
          installment_ids: installmentIds,
        },
        updatedAt: new Date(),
      } as any)
      .where(eq(payment.id, row.id))

    if (mpId && created?.status === 'approved') {
      const settled = await settleMercadoPagoPayment({ mpPaymentId: mpId, localPaymentId: row.id })
      if (settled.credited > 0 && settled.userId) {
        try {
          revalidatePath('/dashboard')
        } catch {
          /* ignore */
        }
        await notifyPaymentReceived({
          userId: settled.userId,
          amount: settled.amount ?? Number(row.amount),
          installmentNumber: settled.installmentNumber,
          receiptId: settled.receiptId,
        })
      }
      return NextResponse.json({
        ok: true,
        status: created.status,
        id: mpId,
        credited: settled.credited,
        receiptId: settled.receiptId ?? null,
        localStatus: settled.localStatus,
      })
    }

    if (created?.status === 'rejected') {
      await notifyPaymentRejected({
        userId,
        amount: row.amount,
        reason: String((created as { status_detail?: string }).status_detail ?? 'Mercado Pago rechazó el cobro.'),
      })
    }

    return NextResponse.json({
      ok: true,
      status: created?.status ?? 'pending',
      id: mpId,
      credited: 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo procesar el pago en Mercado Pago.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
