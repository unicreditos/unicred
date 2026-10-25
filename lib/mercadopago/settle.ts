import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { ensureAppTables } from '@/lib/db/ensure'
import { mpQrOrder, mpQrPayment, mpQrPos } from '@/lib/db/schema'
import { MpError, mpConfigured, mpFail, mpFetch } from '@/lib/mercadopago/client'
import { ORDER_PREFIX, POS_PREFIX, getMpOrder, paymentIdsOfOrder } from '@/lib/mercadopago/qr'
import { WalletError, fromCents, lockWallets, postMovement } from '@/lib/wallet/ledger'

/**
 * Acreditación de los cobros con QR. Reglas:
 *   - El estado del pago SIEMPRE se consulta a Mercado Pago (nunca se confía en el cuerpo de la notificación).
 *   - Solo `approved` en ARS acredita. Un mismo pago nunca se acredita dos veces: la clave de `mp_qr_payment` es el id
 *     del pago y el asiento lleva `externalId` único (`mp-qr:<id>`).
 *   - Devoluciones y contracargos descuentan lo acreditado; si la persona ya gastó el saldo, queda `reversal_pending`
 *     para que administración lo resuelva (nunca se deja la billetera en negativo).
 *   - Un pago aprobado de una caja nuestra que no se puede asignar queda `unmatched` (no se acredita a nadie).
 */

type Rec = Record<string, unknown>
const asRec = (v: unknown): Rec => (v && typeof v === 'object' ? (v as Rec) : {})
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null)
const cents = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const centsOfNumeric = (v: string | null | undefined) => Math.round(Number(v ?? 0) * 100)

export type MpPayment = {
  id: string
  status: string
  statusDetail: string | null
  amountCents: number
  currency: string | null
  externalReference: string | null
  posId: string | null
  orderId: string | null
  method: string | null
  feeCents: number
  netCents: number | null
  refundedCents: number
  approvedAt: Date | null
  /** Solo campos del pago, sin datos de quien paga. */
  summary: Rec
}

export function normalizePayment(data: unknown): MpPayment | null {
  const p = asRec(data)
  const id = str(p.id)
  if (!id) return null
  const fees = Array.isArray(p.fee_details) ? p.fee_details.reduce((a: number, f) => a + cents(asRec(f).amount), 0) : 0
  const net = asRec(p.transaction_details).net_received_amount
  const approved = str(p.date_approved)
  const mp: MpPayment = {
    id,
    status: String(p.status ?? '').toLowerCase(),
    statusDetail: str(p.status_detail),
    amountCents: cents(p.transaction_amount),
    currency: str(p.currency_id),
    externalReference: str(p.external_reference),
    posId: str(p.pos_id),
    orderId: str(asRec(p.order).id),
    method: str(p.payment_method_id),
    feeCents: fees,
    netCents: net == null ? null : cents(net),
    refundedCents: cents(p.transaction_amount_refunded),
    approvedAt: approved && !Number.isNaN(Date.parse(approved)) ? new Date(approved) : null,
    summary: {},
  }
  mp.summary = {
    id: mp.id,
    status: mp.status,
    status_detail: mp.statusDetail,
    transaction_amount: p.transaction_amount ?? null,
    transaction_amount_refunded: p.transaction_amount_refunded ?? null,
    currency_id: mp.currency,
    external_reference: mp.externalReference,
    pos_id: mp.posId,
    store_id: str(p.store_id),
    payment_method_id: mp.method,
    payment_type_id: str(p.payment_type_id),
    order_id: mp.orderId,
    date_approved: approved,
  }
  return mp
}

export async function fetchMpPayment(id: string): Promise<MpPayment | null> {
  const res = await mpFetch<Rec>(`/v1/payments/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) mpFail(res, 'No pudimos consultar el pago en Mercado Pago.')
  return normalizePayment(res.data)
}

/* --------------------------- A quién pertenece --------------------------- */

type Owner = { userId: string; walletId: string; orderId: string | null; posExternalId: string; matchedBy: string }

/** Cruza el pago con la persona por varias señales independientes; la primera que coincide manda. */
export async function resolveOwner(p: MpPayment): Promise<Owner | null> {
  if (p.orderId) {
    const [o] = await db.select().from(mpQrOrder).where(eq(mpQrOrder.mpOrderId, p.orderId)).limit(1)
    if (o) return { userId: o.userId, walletId: o.walletId, orderId: o.id, posExternalId: o.posExternalId, matchedBy: 'order' }
  }
  if (p.externalReference) {
    const [o] = await db.select().from(mpQrOrder).where(eq(mpQrOrder.externalReference, p.externalReference)).limit(1)
    if (o) return { userId: o.userId, walletId: o.walletId, orderId: o.id, posExternalId: o.posExternalId, matchedBy: 'reference' }
    const [pos] = await db.select().from(mpQrPos).where(eq(mpQrPos.externalId, p.externalReference)).limit(1)
    if (pos) return { userId: pos.userId, walletId: pos.walletId, orderId: null, posExternalId: pos.externalId, matchedBy: 'pos_reference' }
  }
  if (p.posId) {
    const [pos] = await db.select().from(mpQrPos).where(eq(mpQrPos.mpPosId, p.posId)).limit(1)
    if (pos) return { userId: pos.userId, walletId: pos.walletId, orderId: null, posExternalId: pos.externalId, matchedBy: 'pos_id' }
  }
  return null
}

/** ¿El pago parece de una caja u orden de esta app? (para no ensuciar la cola con pagos de `unicred`) */
function looksLikeOurs(p: MpPayment) {
  const ref = p.externalReference ?? ''
  return ref.startsWith(ORDER_PREFIX) || ref.startsWith(POS_PREFIX)
}

/* ------------------------------ Acreditar ------------------------------- */

export type SettleResult = {
  matched: boolean
  status?: string
  userId?: string
  creditedCents: number
  reversedCents: number
  reason?: string
}

function creditPolicy(): 'gross' | 'net' {
  return process.env.MERCADO_PAGO_QR_CREDIT === 'net' ? 'net' : 'gross'
}

/**
 * Procesa un pago de Mercado Pago. Seguro de repetir y de correr en simultáneo (notificación + conciliación):
 * el pago se reserva con INSERT ... ON CONFLICT y se bloquea la fila antes de decidir.
 */
export async function settleQrPayment(mpPaymentId: string, preloaded?: MpPayment | null): Promise<SettleResult> {
  await ensureAppTables()
  const p = preloaded ?? (await fetchMpPayment(mpPaymentId))
  if (!p) return { matched: false, creditedCents: 0, reversedCents: 0, reason: 'pago_inexistente' }

  const owner = await resolveOwner(p)
  if (!owner && !looksLikeOurs(p)) {
    return { matched: false, creditedCents: 0, reversedCents: 0, reason: 'no_es_de_esta_app' }
  }

  const result = await db.transaction(async (tx) => {
    const now = new Date()
    await tx
      .insert(mpQrPayment)
      .values({
        mpPaymentId: p.id,
        userId: owner?.userId ?? null,
        walletId: owner?.walletId ?? null,
        orderId: owner?.orderId ?? null,
        posExternalId: owner?.posExternalId ?? null,
        matchedBy: owner?.matchedBy ?? null,
        status: 'pending',
        mpStatus: p.status,
        amount: fromCents(p.amountCents),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: mpQrPayment.mpPaymentId })
    const [row] = await tx.select().from(mpQrPayment).where(eq(mpQrPayment.mpPaymentId, p.id)).for('update').limit(1)
    if (!row) throw new WalletError('No pudimos registrar el pago.')

    // Una vez asignado a una persona no se reasigna a otra.
    const userId = row.userId ?? owner?.userId ?? null
    const walletId = row.walletId ?? owner?.walletId ?? null
    const base = {
      mpStatus: p.status,
      amount: fromCents(p.amountCents),
      fee: p.feeCents ? fromCents(p.feeCents) : null,
      paymentMethod: p.method,
      raw: p.summary,
      paidAt: p.approvedAt,
      updatedAt: now,
      ...(userId && !row.userId ? { userId, walletId, orderId: owner?.orderId ?? null, posExternalId: owner?.posExternalId ?? null, matchedBy: owner?.matchedBy ?? null } : {}),
    }

    const alreadyCreditedCents = centsOfNumeric(row.creditedAmount)
    const reversedCents = centsOfNumeric(row.reversedAmount)
    let credited = 0
    let reversed = 0
    let creditedBase = alreadyCreditedCents
    let status = row.status
    let note = row.note
    let movementId = row.movementId
    let reversalMovementId = row.reversalMovementId

    if (p.status === 'approved' || p.status === 'refunded' || p.status === 'charged_back') {
      if (p.currency && p.currency !== 'ARS') {
        status = 'ignored'
        note = `Moneda no admitida (${p.currency}).`
      } else if (!userId || !walletId) {
        status = 'unmatched'
        note = 'Pago aprobado de una caja de UNICRÉDITOS que no pudimos asignar a ninguna persona.'
      } else {
        const wallets = await lockWallets(tx, [walletId])
        const wallet = wallets.get(walletId)
        if (!wallet) throw new WalletError('La billetera del cobro ya no existe.')

        // 1) Acreditar (solo si está aprobado y todavía no se acreditó).
        if (p.status === 'approved' && alreadyCreditedCents === 0 && row.status !== 'credited' && row.status !== 'reversed' && row.status !== 'reversal_pending') {
          const toCredit = creditPolicy() === 'net' && p.netCents != null ? p.netCents : p.amountCents
          if (toCredit > 0) {
            const mov = await postMovement(tx, wallet, {
              direction: 'credit',
              kind: 'mp_qr_in',
              cents: toCredit,
              externalId: `mp-qr:${p.id}`,
              reference: `MP-${p.id}`,
              notes: 'Pago recibido en tu QR de Mercado Pago',
              allowBlocked: true,
            })
            movementId = mov.movementId
            credited = mov.duplicate ? 0 : toCredit
            creditedBase = toCredit
            status = 'credited'
            await tx.update(mpQrPayment).set({ creditedAmount: fromCents(toCredit) }).where(eq(mpQrPayment.mpPaymentId, p.id))
            if (owner?.orderId || row.orderId) {
              await tx
                .update(mpQrOrder)
                .set({ status: 'paid', mpPaymentId: p.id, updatedAt: now })
                .where(eq(mpQrOrder.id, (owner?.orderId ?? row.orderId) as string))
            }
          }
        }

        // 2) Reversar devoluciones / contracargos sobre lo ya acreditado.
        const creditedNow = creditedBase
        const refunded = p.status === 'approved' ? p.refundedCents : p.status === 'charged_back' || p.status === 'refunded' ? Math.max(p.refundedCents, p.amountCents) : 0
        const target = Math.min(refunded, creditedNow || refunded)
        const delta = target - reversedCents
        if (creditedNow > 0 && delta > 0) {
          try {
            const mov = await postMovement(tx, wallet, {
              direction: 'debit',
              kind: 'mp_qr_reversal',
              cents: delta,
              externalId: `mp-qr-rev:${p.id}:${reversedCents + delta}`,
              reference: `MP-${p.id}`,
              notes: p.status === 'charged_back' ? 'Contracargo de un cobro con QR' : 'Devolución de un cobro con QR',
              allowBlocked: true,
            })
            reversalMovementId = mov.movementId
            reversed = mov.duplicate ? 0 : delta
            const total = reversedCents + delta
            status = total >= creditedNow ? 'reversed' : 'credited'
            await tx.update(mpQrPayment).set({ reversedAmount: fromCents(total) }).where(eq(mpQrPayment.mpPaymentId, p.id))
          } catch (err) {
            if (!(err instanceof WalletError)) throw err
            status = 'reversal_pending'
            note = 'Hubo una devolución pero la billetera ya no tiene saldo suficiente para descontarla: lo resuelve administración.'
          }
        } else if (creditedNow === 0 && p.status !== 'approved') {
          // Devuelto antes de acreditarse: no hay nada que descontar.
          status = 'reversed'
        }
      }
    } else if (p.status === 'rejected' || p.status === 'cancelled') {
      if (row.status !== 'credited' && row.status !== 'reversed' && row.status !== 'reversal_pending') status = 'rejected'
    } else if (row.status === 'pending' || row.status === 'unmatched') {
      status = 'pending'
    }

    await tx
      .update(mpQrPayment)
      .set({ ...base, status, note, movementId, reversalMovementId })
      .where(eq(mpQrPayment.mpPaymentId, p.id))
    return { userId, status, credited, reversed }
  })

  if (result.credited > 0 || result.reversed > 0 || result.status === 'unmatched' || result.status === 'reversal_pending') {
    await recordAudit({
      actorUserId: '',
      action: result.credited > 0 ? 'MP_QR_CREDITED' : result.reversed > 0 ? 'MP_QR_REVERSED' : 'MP_QR_ATTENTION',
      entityType: 'mp_qr_payment',
      entityId: p.id,
      targetUserId: result.userId ?? null,
      severity: result.credited > 0 ? 'info' : 'warning',
      summary:
        result.credited > 0
          ? 'Cobro con QR de Mercado Pago acreditado en la billetera'
          : result.reversed > 0
            ? 'Devolución de un cobro con QR descontada de la billetera'
            : 'Pago de Mercado Pago que requiere revisión',
      changes: { mpPaymentId: p.id, estado: result.status, acreditado: fromCents(result.credited), descontado: fromCents(result.reversed) },
    }).catch((e) => console.warn('[mp-qr] auditoría no registrada:', e instanceof Error ? e.message : e))
  }

  return {
    matched: Boolean(result.userId),
    status: result.status,
    userId: result.userId ?? undefined,
    creditedCents: result.credited,
    reversedCents: result.reversed,
  }
}

/* ---------------------------- Órdenes con importe ------------------------ */

const ORDER_PAID = new Set(['processed', 'paid', 'accredited'])
const ORDER_EXPIRED = new Set(['expired'])
const ORDER_CANCELLED = new Set(['canceled', 'cancelled'])
const ORDER_FAILED = new Set(['failed', 'rejected'])

/** Pone al día una orden con lo que dice Mercado Pago y acredita los pagos que tenga. */
export async function syncQrOrder(orderId: string): Promise<{ status: string; creditedCents: number }> {
  await ensureAppTables()
  const [o] = await db.select().from(mpQrOrder).where(eq(mpQrOrder.id, orderId)).limit(1)
  if (!o) throw new WalletError('No encontramos ese cobro.')
  if (!o.mpOrderId) {
    // Quedó a medio crear (cortó la conexión): pasados unos minutos se da por fallido.
    if (o.status === 'creating' && Date.now() - o.createdAt.getTime() > 10 * 60_000) {
      await db.update(mpQrOrder).set({ status: 'failed', updatedAt: new Date() }).where(eq(mpQrOrder.id, o.id))
      return { status: 'failed', creditedCents: 0 }
    }
    return { status: o.status, creditedCents: 0 }
  }

  const remote = await getMpOrder(o.mpOrderId)
  let credited = 0
  for (const id of paymentIdsOfOrder(remote)) {
    credited += (await settleQrPayment(id)).creditedCents
  }

  const [fresh] = await db.select().from(mpQrOrder).where(eq(mpQrOrder.id, o.id)).limit(1)
  let status = fresh?.status ?? o.status
  if (status === 'created' || status === 'creating') {
    const remoteStatus = String(remote?.status ?? '').toLowerCase()
    let next: string | null = null
    if (ORDER_PAID.has(remoteStatus)) next = credited > 0 || paymentIdsOfOrder(remote).length ? 'paid' : null
    else if (ORDER_EXPIRED.has(remoteStatus)) next = 'expired'
    else if (ORDER_CANCELLED.has(remoteStatus)) next = 'cancelled'
    else if (ORDER_FAILED.has(remoteStatus)) next = 'failed'
    else if (o.expiresAt && o.expiresAt.getTime() < Date.now() - 60_000) next = 'expired'
    if (next && next !== status) {
      await db
        .update(mpQrOrder)
        .set({ status: next, updatedAt: new Date() })
        .where(and(eq(mpQrOrder.id, o.id), inArray(mpQrOrder.status, ['created', 'creating'])))
      status = next
    }
  }
  return { status, creditedCents: credited }
}

/* ------------------------------ Conciliación ----------------------------- */

/** Busca, en la caja de la persona, pagos aprobados que todavía no se hayan acreditado (red de seguridad del webhook). */
async function pullPosPayments(pos: typeof mpQrPos.$inferSelect): Promise<number> {
  if (!pos.mpPosId) return 0
  const res = await mpFetch<{ results?: unknown[] }>(
    `/v1/payments/search?sort=date_created&criteria=desc&limit=30&pos_id=${encodeURIComponent(pos.mpPosId)}`,
  )
  if (!res.ok) return 0
  let credited = 0
  for (const raw of res.data?.results ?? []) {
    const p = normalizePayment(raw)
    // El filtro de la API puede ignorarse: se exige que el pago sea de ESTA caja antes de tocarlo.
    if (!p || (p.posId !== pos.mpPosId && p.externalReference !== pos.externalId)) continue
    const [known] = await db.select({ s: mpQrPayment.status, m: mpQrPayment.mpStatus }).from(mpQrPayment).where(eq(mpQrPayment.mpPaymentId, p.id)).limit(1)
    if (known && known.m === p.status && known.s !== 'pending') continue
    credited += (await settleQrPayment(p.id, p)).creditedCents
  }
  return credited
}

export type ReconcileSummary = { orders: number; pos: number; creditedCents: number; errors: number }

/**
 * Pone al día los cobros de UNA persona (al abrir su pantalla de QR) o de todas (administración / tarea programada).
 * Funciona aunque las notificaciones de Mercado Pago lleguen a otra aplicación: es la red de seguridad.
 */
export async function reconcileQr(opts: { userId?: string; limit?: number } = {}): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { orders: 0, pos: 0, creditedCents: 0, errors: 0 }
  if (!mpConfigured()) return summary
  await ensureAppTables()
  const limit = opts.limit ?? 40

  const open = await db
    .select({ id: mpQrOrder.id })
    .from(mpQrOrder)
    .where(and(inArray(mpQrOrder.status, ['created', 'creating']), opts.userId ? eq(mpQrOrder.userId, opts.userId) : undefined))
    .orderBy(asc(mpQrOrder.createdAt))
    .limit(limit)
  for (const o of open) {
    try {
      summary.creditedCents += (await syncQrOrder(o.id)).creditedCents
      summary.orders += 1
    } catch (err) {
      summary.errors += 1
      console.warn('[mp-qr] conciliación de orden:', err instanceof MpError ? err.message : err)
    }
  }

  const posRows = await db
    .select()
    .from(mpQrPos)
    .where(opts.userId ? eq(mpQrPos.userId, opts.userId) : eq(mpQrPos.status, 'active'))
    .orderBy(desc(mpQrPos.updatedAt))
    .limit(opts.userId ? 1 : limit)
  for (const pos of posRows) {
    try {
      summary.creditedCents += await pullPosPayments(pos)
      summary.pos += 1
    } catch (err) {
      summary.errors += 1
      console.warn('[mp-qr] conciliación de caja:', err instanceof MpError ? err.message : err)
    }
  }
  // Pagos que quedaron en proceso: se vuelven a mirar.
  const waiting = await db
    .select({ id: mpQrPayment.mpPaymentId })
    .from(mpQrPayment)
    .where(
      and(
        or(eq(mpQrPayment.status, 'pending'), eq(mpQrPayment.status, 'reversal_pending')),
        opts.userId ? eq(mpQrPayment.userId, opts.userId) : undefined,
        lt(mpQrPayment.updatedAt, new Date(Date.now() - 60_000)),
      ),
    )
    .limit(limit)
  for (const w of waiting) {
    try {
      summary.creditedCents += (await settleQrPayment(w.id)).creditedCents
    } catch (err) {
      summary.errors += 1
      console.warn('[mp-qr] pago en espera:', err instanceof MpError ? err.message : err)
    }
  }
  return summary
}

/* -------------------------------- Lectura -------------------------------- */

export async function getQrOverview(userId: string) {
  await ensureAppTables()
  const [pos, orders, payments, totals] = await Promise.all([
    db.select().from(mpQrPos).where(eq(mpQrPos.userId, userId)).limit(1),
    db.select().from(mpQrOrder).where(and(eq(mpQrOrder.userId, userId), sql`${mpQrOrder.status} <> 'failed'`)).orderBy(desc(mpQrOrder.createdAt)).limit(8),
    db.select().from(mpQrPayment).where(eq(mpQrPayment.userId, userId)).orderBy(desc(mpQrPayment.createdAt)).limit(10),
    db
      .select({
        n: sql<number>`count(*) filter (where status in ('credited','reversed'))::int`,
        total: sql<string>`coalesce(sum("creditedAmount" - "reversedAmount") filter (where status in ('credited','reversed','reversal_pending')),0)::text`,
      })
      .from(mpQrPayment)
      .where(eq(mpQrPayment.userId, userId)),
  ])
  return { pos: pos[0] ?? null, orders, payments, collectedCount: Number(totals[0]?.n ?? 0), collectedTotal: totals[0]?.total ?? '0' }
}
