import { NextRequest, NextResponse } from 'next/server'
import { getPaymentMP, validateWebhookSecret, validateWebhookSignature } from '@/lib/mercadopago'
import { db } from '@/lib/db'
import { payment as paymentTable, installment, loan, paymentReceipt } from '@/lib/db/schema'
import { eq, or, inArray, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { receiptBranding } from '@/lib/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RECEIPT_BRANDING = receiptBranding()

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v)).filter(Boolean)
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Estado local del pago a partir del estado que informa Mercado Pago. */
function mapStatus(mpStatus: string | null): string | null {
  switch (mpStatus) {
    case 'approved':
      return 'paid'
    case 'rejected':
    case 'cancelled':
      return 'failed'
    case 'refunded':
    case 'charged_back':
      return 'refunded'
    case 'in_process':
    case 'pending':
    case 'authorized':
      return 'processing'
    default:
      return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (!validateWebhookSecret(secret ?? undefined)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    webhook: 'active',
    time: new Date().toISOString(),
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
  })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const body = await req.json().catch(() => null)

  const sigOk = validateWebhookSignature({
    headers: {
      'x-signature': req.headers.get('x-signature') ?? undefined,
      'x-request-id': req.headers.get('x-request-id') ?? undefined,
    },
    queryDataId: searchParams.get('data.id'),
    body,
    toleranceSeconds: 60 * 15,
  })
  const secretOk = validateWebhookSecret(searchParams.get('secret') ?? undefined)
  const production = process.env.NODE_ENV === 'production'
  if (production ? !sigOk : !sigOk && !secretOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    let mpPaymentId: string | null = null
    if (body?.data?.id) mpPaymentId = String(body.data.id)
    else if (body?.id) mpPaymentId = String(body.id)

    let externalReference: string | null =
      body?.data?.external_reference ?? body?.external_reference ?? null
    let mpStatus: string | null = body?.data?.status ?? body?.status ?? null

    // La API de MP es la fuente de verdad: el body del webhook puede ser spoofeado.
    let fetched: Record<string, unknown> | null = null
    if (mpPaymentId) {
      try {
        fetched = (await getPaymentMP(mpPaymentId)) as Record<string, unknown> | null
        if (fetched) {
          mpStatus = (fetched.status as string) ?? mpStatus
          externalReference = (fetched.external_reference as string) ?? externalReference
        }
      } catch (e) {
        console.error('[mp-webhook] getPayment error:', e)
      }
    }

    const localStatus = mapStatus(mpStatus)
    // Solo confiar en el monto de la API de MP (no del body del webhook).
    const paidAmount = toNumber(fetched?.transaction_amount)

    const conds = []
    if (mpPaymentId) {
      conds.push(eq(paymentTable.externalId, mpPaymentId))
      conds.push(eq(paymentTable.paymentLinkId, mpPaymentId))
    }
    if (externalReference) conds.push(eq(paymentTable.referenceNumber, String(externalReference)))
    if (fetched?.preference_id) {
      conds.push(eq(paymentTable.paymentLinkId, String(fetched.preference_id)))
    }
    if (conds.length === 0) {
      return NextResponse.json({ ok: true, matched: false, reason: 'sin_identificador' })
    }

    const candidates = await db
      .select({ id: paymentTable.id })
      .from(paymentTable)
      .where(or(...conds))
      .limit(1)

    if (!candidates.length) {
      console.warn('[mp-webhook] pago sin correspondencia local:', mpPaymentId, externalReference)
      return NextResponse.json({ ok: true, matched: false, mpPaymentId, status: mpStatus })
    }

    const result = await db.transaction(async (tx) => {
      // Bloquea la fila para que dos notificaciones simultáneas no acrediten dos veces.
      const [localPay] = await tx
        .select()
        .from(paymentTable)
        .where(eq(paymentTable.id, candidates[0].id))
        .for('update')
        .limit(1)

      if (!localPay) return { matched: false as const }

      const alreadySettled =
        localPay.status === 'paid' && localPay.externalId === mpPaymentId && localStatus === 'paid'
      if (alreadySettled) {
        return { matched: true as const, duplicate: true as const, localPaymentId: localPay.id }
      }

      const previousGateway = (localPay.gatewayResponse as Record<string, unknown>) ?? {}
      const updates: Record<string, unknown> = {
        gatewayResponse: {
          webhookBody: body,
          fetchedPayment: fetched,
          processedAt: new Date().toISOString(),
          mpPaymentId,
          externalReference,
          installment_ids:
            previousGateway.installment_ids ?? asIdList((fetched?.metadata as never)?.['installment_ids']),
          preference_id: previousGateway.preference_id ?? fetched?.preference_id,
        },
        updatedAt: new Date(),
      }

      const now = new Date()
      if (localStatus) updates.status = localStatus
      if (localStatus === 'paid') {
        updates.paidAt = now
        updates.externalId = mpPaymentId ?? localPay.externalId
      } else if (localStatus === 'failed') {
        updates.failureReason =
          (fetched?.status_detail as string) ?? body?.data?.status_detail ?? 'rechazado por gateway'
      } else if (localStatus === 'refunded') {
        updates.refundedAt = now
      }

      const mpMethodId = String(fetched?.payment_method_id ?? '').toLowerCase()
      if (mpMethodId === 'pagofacil') updates.method = 'pago_facil'
      else if (mpMethodId === 'rapipago') updates.method = 'rapipago'
      else if (mpMethodId === 'account_money') updates.method = 'mercadopago_wallet'

      const ticketUrl = (fetched?.transaction_details as { external_resource_url?: string } | undefined)
        ?.external_resource_url
      if (ticketUrl) {
        updates.paymentLinkUrl = ticketUrl
        updates.notes = `Cupón ${mpMethodId || 'ticket'} generado. Pagá en Pago Fácil, Rapipago u otra red habilitada.`
      }

      await tx.update(paymentTable).set(updates).where(eq(paymentTable.id, localPay.id))

      if (localStatus !== 'paid') {
        return { matched: true as const, credited: 0, localPaymentId: localPay.id }
      }

      const gatewayIds = asIdList(
        (updates.gatewayResponse as { installment_ids?: unknown }).installment_ids,
      )
      const targetIds = gatewayIds.length
        ? gatewayIds
        : localPay.installmentId
          ? [localPay.installmentId]
          : []
      if (!targetIds.length) {
        return { matched: true as const, credited: 0, localPaymentId: localPay.id }
      }

      const insts = await tx
        .select()
        .from(installment)
        .where(and(inArray(installment.id, targetIds), eq(installment.userId, localPay.userId)))
        .for('update')

      const unpaid = insts.filter((i) => i.status !== 'paid')
      if (!unpaid.length) {
        return { matched: true as const, credited: 0, localPaymentId: localPay.id }
      }

      // Exigir monto verificado por API de MP; no acreditar con amount desconocido o insuficiente.
      const expected = unpaid.reduce((acc, i) => acc + toNumber(i.amount), 0)
      if (!(paidAmount > 0) || !fetched) {
        console.warn(
          `[mp-webhook] sin transaction_amount de API — no se acredita (pago ${localPay.id}, mp=${mpPaymentId})`,
        )
        return {
          matched: true as const,
          credited: 0,
          amountMissing: true as const,
          localPaymentId: localPay.id,
        }
      }
      if (paidAmount + 0.01 < expected) {
        console.warn(
          `[mp-webhook] importe insuficiente: cobrado ${paidAmount} < esperado ${expected} (pago ${localPay.id})`,
        )
        return {
          matched: true as const,
          credited: 0,
          underpaid: true as const,
          localPaymentId: localPay.id,
        }
      }

      const loanId = unpaid[0].loanId
      const [loanRow] = loanId
        ? await tx.select().from(loan).where(eq(loan.id, loanId)).limit(1)
        : [null]

      for (const inst of unpaid) {
        await tx
          .update(installment)
          .set({ status: 'paid', paidAt: now })
          .where(eq(installment.id, inst.id))
      }

      let allInsts: typeof insts = []
      if (loanId) {
        allInsts = await tx.select().from(installment).where(eq(installment.loanId, loanId))
        const paidCount = allInsts.filter((i) => i.status === 'paid').length
        const nextStatus = paidCount === allInsts.length && allInsts.length > 0 ? 'paid' : 'active'
        if (loanRow && loanRow.status !== nextStatus && loanRow.status !== 'paid') {
          await tx.update(loan).set({ status: nextStatus, updatedAt: now }).where(eq(loan.id, loanId))
        }
      }

      const pending = allInsts.filter((i) => i.status !== 'paid')
      const totalRemaining = pending.reduce((a, i) => a + toNumber(i.amount), 0)
      const totalPaid = allInsts
        .filter((i) => i.status === 'paid')
        .reduce((a, i) => a + toNumber(i.amount), 0)
      const principalTotal = allInsts.reduce((a, i) => a + toNumber(i.amount), 0)

      for (const inst of unpaid) {
        // Número determinístico: si MP reintenta la notificación no se duplica el recibo.
        const receiptNumber = `REC-MP-${mpPaymentId ?? localPay.id}-${String(inst.number ?? 0).padStart(2, '0')}`
        await tx
          .insert(paymentReceipt)
          .values({
            id: crypto.randomUUID(),
            receiptNumber,
            receiptType: 'payment',
            userId: localPay.userId,
            paymentId: localPay.id,
            loanId: inst.loanId ?? null,
            installmentId: inst.id,
            amount: String(inst.amount),
            currency: 'ARS',
            loanSnapshot: loanRow ? JSON.parse(JSON.stringify(loanRow)) : null,
            installmentSnapshot: JSON.parse(JSON.stringify(inst)),
            previousBalance: String(principalTotal),
            newBalance: String(totalRemaining),
            pendingInstallments: pending.length,
            totalPaidToDate: String(totalPaid),
            method: 'mercado_pago',
            referenceNumber: localPay.referenceNumber ?? mpPaymentId ?? null,
            paidAt: now,
            issuedAt: now,
            branding: RECEIPT_BRANDING,
            createdAt: now,
          })
          .onConflictDoNothing({ target: paymentReceipt.receiptNumber })
      }

      return { matched: true as const, credited: unpaid.length, localPaymentId: localPay.id }
    })

    if (result.matched && 'credited' in result && (result.credited ?? 0) > 0) {
      try {
        revalidatePath('/dashboard')
      } catch (e) {
        console.warn('[mp-webhook] revalidatePath omitido:', e)
      }
    }

    return NextResponse.json({ ok: true, status: mpStatus, mpPaymentId, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error'
    console.error('[mp-webhook] Error fatal:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
