import { createHash, randomBytes } from 'node:crypto'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { BRAND } from '@/lib/brand'
import { db } from '@/lib/db'
import { ensureAppTables } from '@/lib/db/ensure'
import { mpQrOrder, mpQrPos } from '@/lib/db/schema'
import { newId } from '@/lib/ids'
import { MpError, mpConfig, mpConfigured, mpFail, mpFetch } from '@/lib/mercadopago/client'
import { WalletError, ensureWallet } from '@/lib/wallet/ledger'

/**
 * QR de cobro con Mercado Pago. Modelo:
 *   - UNA sucursal (store) de UNICRÉDITOS para todas las billeteras;
 *   - UNA caja (PDV / POS) por persona, con su propio QR permanente (importe libre);
 *   - un QR dinámico por cobro con importe (orden `type: qr`) asociado a la caja de esa persona.
 * El dinero entra a la cuenta de Mercado Pago de UNICRÉDITOS y se acredita en la billetera de la persona cuando
 * Mercado Pago confirma el pago (ver `settle.ts`). Las cajas nacen recién cuando la persona activa su cobro.
 */

export const QR_STORE_EXTERNAL_ID = (process.env.MERCADO_PAGO_QR_STORE_EXTERNAL_ID ?? 'UNICREDVERIFY').replace(/[^A-Za-z0-9]/g, '').slice(0, 60) || 'UNICREDVERIFY'
/** Prefijos propios: permiten reconocer en un pago que la caja o la orden son de esta app y no de `unicred`. */
export const POS_PREFIX = 'UCV'
export const ORDER_PREFIX = 'UCQ-'

export type PosRow = typeof mpQrPos.$inferSelect
export type OrderRow = typeof mpQrOrder.$inferSelect

/** Identificador de la caja en Mercado Pago: alfanumérico, ≤ 40, determinista por persona (nadie puede adivinar el de otra). */
export function posExternalIdFor(userId: string) {
  return POS_PREFIX + createHash('sha256').update(`unicred-verify:pos:${userId}`).digest('hex').slice(0, 24)
}

/** Referencia de una orden: letras, números, guion; ≤ 64; única; sin datos personales. */
export function newOrderReference() {
  return ORDER_PREFIX + randomBytes(10).toString('hex').toUpperCase()
}

/** Nombre de la caja: "UC María L" (sin acentos ni símbolos, ≤ 45). */
export function posNameFor(holderName: string | null | undefined) {
  const clean = String(holderName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const first = clean[0] ?? 'Billetera'
  const initial = clean.length > 1 ? ` ${clean[clean.length - 1][0]}` : ''
  return `UC ${first}${initial}`.slice(0, 45)
}

export function isEmvQr(value: unknown): value is string {
  const s = String(value ?? '').trim()
  return s.startsWith('000201') && /mercadolibre|mercadopago/i.test(s)
}

/** Vigencia del QR en el formato de la API (duración ISO 8601): minutos si es menos de una hora, si no horas. */
export function expirationDuration(ttlMinutes: number) {
  const minutes = Math.min(Math.max(Math.round(ttlMinutes), 1), 3600 * 60)
  return minutes < 60 ? `PT${minutes}M` : `PT${Math.min(Math.ceil(minutes / 60), 3600)}H`
}

export function assertMpReady() {
  if (!mpConfigured()) {
    throw new WalletError('El cobro con QR de Mercado Pago todavía no está habilitado en este entorno. Avisá a soporte.')
  }
}

type Rec = Record<string, unknown>
const asRec = (v: unknown): Rec => (v && typeof v === 'object' ? (v as Rec) : {})
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null)

/**
 * Candado de Postgres entre instancias: dos personas que activan su caja a la vez no pueden crear dos sucursales ni la
 * misma caja dos veces (en `unicred` quedaron dos sucursales duplicadas por una carrera así). Se libera al terminar.
 */
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
    return fn()
  })
}

/* ------------------------------- Sucursal ------------------------------- */

async function searchStore(userId: string): Promise<string | null> {
  const res = await mpFetch<{ results?: Array<{ id?: number | string; external_id?: string }> }>(
    `/users/${encodeURIComponent(userId)}/stores/search?external_id=${encodeURIComponent(QR_STORE_EXTERNAL_ID)}`,
  )
  // Mercado Pago responde 404 "Store not found" (no una lista vacía) cuando no hay ninguna con ese identificador.
  if (res.status === 404) return null
  if (!res.ok) mpFail(res, 'No pudimos consultar la sucursal de cobros.')
  const found = res.data?.results?.find((r) => r.external_id === QR_STORE_EXTERNAL_ID)
  return found?.id != null ? String(found.id) : null
}

export async function ensureStore(): Promise<string> {
  await ensureAppTables()
  const [known] = await db
    .select({ id: mpQrPos.mpStoreId, ext: mpQrPos.storeExternalId })
    .from(mpQrPos)
    .where(isNotNull(mpQrPos.mpStoreId))
    .limit(1)
  if (known?.id && known.ext === QR_STORE_EXTERNAL_ID) return known.id

  return withLock('mp-qr:store', () => createStoreOnce())
}

async function createStoreOnce(): Promise<string> {
  // Con el candado tomado se vuelve a mirar: otra instancia pudo haberla creado mientras esperábamos.
  const [known] = await db
    .select({ id: mpQrPos.mpStoreId, ext: mpQrPos.storeExternalId })
    .from(mpQrPos)
    .where(isNotNull(mpQrPos.mpStoreId))
    .limit(1)
  if (known?.id && known.ext === QR_STORE_EXTERNAL_ID) return known.id
  const userId = mpConfig().userId
  const existing = await searchStore(userId)
  if (existing) return existing

  const created = await mpFetch<Rec>(`/users/${encodeURIComponent(userId)}/stores`, {
    method: 'POST',
    idempotencyKey: `store-${QR_STORE_EXTERNAL_ID}`,
    body: {
      name: `${BRAND.company} · billeteras`,
      external_id: QR_STORE_EXTERNAL_ID,
      location: {
        street_number: '566',
        street_name: 'Maipú',
        city_name: 'San Nicolás',
        state_name: 'Capital Federal',
        latitude: -34.6019,
        longitude: -58.3754,
        reference: BRAND.address,
      },
      business_hours: Object.fromEntries(
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, [{ open: '00:00', close: '23:59' }]]),
      ),
    },
  })
  const id = str(created.data?.id)
  if (created.ok && id) return id
  // Otro pedido pudo crearla a la vez: se vuelve a buscar antes de rendirse.
  const again = await searchStore(userId)
  if (again) return again
  mpFail(created, 'No pudimos crear la sucursal de cobros en Mercado Pago.')
}

/* --------------------------------- Caja --------------------------------- */

function parsePos(data: unknown) {
  const p = asRec(data)
  const qr = asRec(p.qr_response ?? p.qr)
  return {
    mpPosId: str(p.id),
    qrImageUrl: str(qr.image),
    qrTemplateUrl: str(qr.template_document),
    qrCode: isEmvQr(qr.qr_code) ? String(qr.qr_code).trim() : null,
  }
}

async function findPos(externalId: string) {
  const res = await mpFetch<{ results?: Rec[] } | Rec[]>(`/pos?external_id=${encodeURIComponent(externalId)}`)
  if (res.status === 404) return null
  if (!res.ok) mpFail(res, 'No pudimos consultar la caja de cobro.')
  const rows = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
  return rows.find((r) => r.external_id === externalId) ?? null
}

async function createPosInMp(input: { storeId: string; externalId: string; name: string }) {
  // Primero el alta clásica (la que ya usa `unicred` con éxito: QR permanente de importe libre); si la cuenta no la
  // admite, la versión 2 en modo "pdv".
  const legacy = await mpFetch<Rec>('/pos', {
    method: 'POST',
    idempotencyKey: `pos-${input.externalId}`,
    body: {
      name: input.name,
      fixed_amount: false,
      store_id: Number(input.storeId) || input.storeId,
      external_store_id: QR_STORE_EXTERNAL_ID,
      external_id: input.externalId,
    },
  })
  if (legacy.ok && legacy.data) return legacy.data
  const v2 = await mpFetch<Rec>('/v2/pos', {
    method: 'POST',
    idempotencyKey: `posv2-${input.externalId}`,
    body: {
      name: input.name,
      store_id: String(input.storeId),
      external_id: input.externalId,
      config: { qr: { operating_mode: 'pdv' } },
    },
  })
  if (v2.ok && v2.data) return v2.data
  const raced = await findPos(input.externalId)
  if (raced) return raced
  mpFail(legacy.status >= 500 ? legacy : v2, 'Mercado Pago no creó la caja de cobro.')
}

export async function getUserPos(userId: string): Promise<PosRow | null> {
  await ensureAppTables()
  const [row] = await db.select().from(mpQrPos).where(eq(mpQrPos.userId, userId)).limit(1)
  return row ?? null
}

/** Crea (una sola vez) la caja de la persona en Mercado Pago y la deja registrada. Idempotente. */
export async function ensureUserPos(userId: string): Promise<PosRow> {
  assertMpReady()
  const existing = await getUserPos(userId)
  if (existing) return existing
  return withLock(`mp-qr:pos:${userId}`, () => createUserPosOnce(userId))
}

async function createUserPosOnce(userId: string): Promise<PosRow> {
  const again = await getUserPos(userId)
  if (again) return again
  const wallet = await ensureWallet(userId)
  const storeId = await ensureStore()
  const externalId = posExternalIdFor(userId)
  const name = posNameFor(wallet.holderName)
  const remote = (await findPos(externalId)) ?? (await createPosInMp({ storeId, externalId, name }))
  const parsed = parsePos(remote)
  const now = new Date()

  await db
    .insert(mpQrPos)
    .values({
      id: newId('mpos'),
      userId,
      walletId: wallet.id,
      externalId,
      mpPosId: parsed.mpPosId,
      mpStoreId: storeId,
      storeExternalId: QR_STORE_EXTERNAL_ID,
      name,
      status: 'active',
      qrImageUrl: parsed.qrImageUrl,
      qrTemplateUrl: parsed.qrTemplateUrl,
      qrCode: parsed.qrCode,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: mpQrPos.userId })
  const row = await getUserPos(userId)
  if (!row) throw new WalletError('No pudimos registrar tu caja de cobro. Probá de nuevo.')
  return row
}

/* ---------------------------- QR con importe ---------------------------- */

function extractQrData(data: unknown): string | null {
  const rec = asRec(data)
  const direct = rec.qr_data ?? asRec(rec.type_response).qr_data
  if (isEmvQr(direct)) return String(direct).trim()
  const payments = asRec(rec.transactions).payments
  const nested = Array.isArray(payments) ? asRec(asRec(asRec(payments[0]).payment_method)).qr_code : null
  return isEmvQr(nested) ? String(nested).trim() : null
}

/** `qrData` es null en el modo permanente: el cobro se ve al escanear el QR fijo de la caja. */
export type CreatedQrOrder = { order: OrderRow; qrData: string | null }

export async function createQrOrder(input: {
  userId: string
  cents: number
  concept?: string | null
  ttlMinutes: number
  /** true = se cobra con el QR permanente de la caja (modo `static`) */
  permanent?: boolean
}): Promise<CreatedQrOrder> {
  if (!Number.isInteger(input.cents) || input.cents <= 0) throw new WalletError('Importe inválido.')
  const pos = await ensureUserPos(input.userId)
  if (pos.status !== 'active') throw new WalletError('Tu caja de cobro está suspendida. Contactá a soporte.')

  const mode = input.permanent ? 'static' : 'dynamic'
  // En el QR permanente solo puede haber un cobro abierto a la vez: el anterior se anula antes de cargar otro.
  if (mode === 'static') await closeOpenStaticOrders(input.userId)
  const concept = input.concept?.trim().slice(0, 100) || null
  const reference = newOrderReference()
  const unit = (input.cents / 100).toFixed(2)
  const orderId = newId('mqo')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + Math.max(input.ttlMinutes, 1) * 60_000)

  // Primero el registro propio: si algo falla a mitad de camino queda rastro y no hay QR sin dueño.
  await db.insert(mpQrOrder).values({
    id: orderId,
    userId: input.userId,
    walletId: pos.walletId,
    posExternalId: pos.externalId,
    externalReference: reference,
    amount: unit,
    concept,
    mode,
    status: 'creating',
    expiresAt,
    createdAt: now,
    updatedAt: now,
  })

  const title = (concept ?? `Cobro ${BRAND.company}`).slice(0, 150)
  const baseBody = {
    type: 'qr',
    total_amount: unit,
    description: title,
    external_reference: reference,
    expiration_time: expirationDuration(input.ttlMinutes),
    config: { qr: { external_pos_id: pos.externalId, mode } },
  }
  const item = { title, unit_price: unit, quantity: 1, unit_measure: 'unit', external_code: reference.slice(0, 30) }

  try {
    let res = await mpFetch<Rec>('/v1/orders', {
      method: 'POST',
      idempotencyKey: `qr-${orderId}`,
      body: { ...baseBody, transactions: { payments: [{ amount: unit }] }, items: [item] },
    })
    // La API acepta dos formas del cuerpo según la cuenta; se reintenta con la otra antes de fallar.
    if (!res.ok && res.status >= 400 && res.status < 500) {
      res = await mpFetch<Rec>('/v1/orders', {
        method: 'POST',
        idempotencyKey: `qr-${orderId}-b`,
        body: { ...baseBody, transactions: { payments: { amount: unit } }, items: item },
      })
    }
    if (!res.ok) mpFail(res, 'Mercado Pago no emitió el QR de cobro.')
    const mpOrderId = str(res.data?.id)
    const qrData = extractQrData(res.data)
    // En el modo permanente no hace falta un código propio: se escanea el QR fijo de la caja.
    if (!mpOrderId || (mode === 'dynamic' && !qrData)) throw new MpError('Mercado Pago no devolvió el código QR del cobro.', res.status, false)

    const [updated] = await db
      .update(mpQrOrder)
      .set({ mpOrderId, qrData, status: 'created', updatedAt: new Date() })
      .where(eq(mpQrOrder.id, orderId))
      .returning()
    return { order: updated, qrData }
  } catch (err) {
    await db.update(mpQrOrder).set({ status: 'failed', updatedAt: new Date() }).where(eq(mpQrOrder.id, orderId))
    if (err instanceof MpError) {
      console.error('[mp-qr] no se pudo emitir el QR:', err.status, err.message)
      throw new WalletError(
        err.transient
          ? 'Mercado Pago no respondió. Probá de nuevo en unos minutos.'
          : 'Mercado Pago no pudo emitir el QR. Probá de nuevo; si sigue igual, avisá a soporte.',
      )
    }
    throw err
  }
}

/** Anula (en Mercado Pago y acá) los cobros abiertos de la persona en su QR permanente. */
async function closeOpenStaticOrders(userId: string) {
  const open = await db
    .select()
    .from(mpQrOrder)
    .where(and(eq(mpQrOrder.userId, userId), eq(mpQrOrder.mode, 'static'), inArray(mpQrOrder.status, ['created', 'creating'])))
  for (const o of open) {
    if (o.mpOrderId) {
      const r = await cancelQrOrderInMp(o.mpOrderId)
      // Si no se pudo anular puede ser porque ya lo pagaron: se deja que la conciliación lo resuelva.
      if (!r.ok) continue
    }
    await db.update(mpQrOrder).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(mpQrOrder.id, o.id), inArray(mpQrOrder.status, ['created', 'creating'])))
  }
}

export async function cancelQrOrderInMp(mpOrderId: string) {
  const res = await mpFetch<Rec>(`/v1/orders/${encodeURIComponent(mpOrderId)}/cancel`, {
    method: 'POST',
    idempotencyKey: `cancel-${mpOrderId}`,
  })
  return { ok: res.ok, status: res.status, message: res.ok ? null : String(asRec(res.data).message ?? '') }
}

export async function getMpOrder(mpOrderId: string): Promise<Rec | null> {
  const res = await mpFetch<Rec>(`/v1/orders/${encodeURIComponent(mpOrderId)}`)
  if (res.status === 404) return null
  if (!res.ok) mpFail(res, 'No pudimos consultar el cobro en Mercado Pago.')
  return res.data
}

/**
 * Ids de pago de una orden (solo los que ya se procesaron o aprobaron). Cada pago de una orden trae DOS identificadores:
 * `id` (PAY01…, interno de la API de órdenes, no se puede consultar en /v1/payments) y `reference_id` (el número real del
 * pago, p. ej. 183403935234). Se usa el numérico: con el interno Mercado Pago responde 404 y el cobro no se acreditaba.
 */
export function paymentIdsOfOrder(order: Rec | null): string[] {
  const payments = asRec(order?.transactions).payments
  if (!Array.isArray(payments)) return []
  const ids: string[] = []
  for (const row of payments) {
    const p = asRec(row)
    const status = String(p.status ?? '').toLowerCase()
    if (status && !['processed', 'paid', 'approved', 'accredited', 'ready_to_process', 'created'].includes(status)) continue
    const id = [p.reference_id, p.payment_id, p.id].map(str).find((v): v is string => Boolean(v) && /^\d+$/.test(v as string))
    if (id) ids.push(id)
  }
  return ids
}
