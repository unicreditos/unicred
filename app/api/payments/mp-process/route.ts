import { createPaymentFromBrick } from '@/lib/mercadopago'
import { db } from '@/lib/db'
import { payment } from '@/lib/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

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
    return NextResponse.json({ error: 'Este pago ya está acreditado.' }, { status: 409 })
  }

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
      },
    })

    const mpId = created?.id ? String(created.id) : null
    await db
      .update(payment)
      .set({
        status: created?.status === 'approved' ? 'processing' : created?.status === 'rejected' ? 'failed' : 'processing',
        paymentLinkId: row.paymentLinkId,
        externalId: mpId ?? row.externalId,
        gatewayResponse: {
          ...((row.gatewayResponse as Record<string, unknown> | null) ?? {}),
          mp_payment_id: mpId,
          mp_status: created?.status ?? null,
        },
        updatedAt: new Date(),
      } as any)
      .where(eq(payment.id, row.id))

    return NextResponse.json({
      ok: true,
      status: created?.status ?? 'pending',
      id: mpId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo procesar el pago en Mercado Pago.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
