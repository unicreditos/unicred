import { randomUUID } from 'crypto'
import { BRAND } from '@/lib/brand'
import { mpApiFetch } from '@/lib/mercadopago'
import { isMercadoPagoEmvQr, qrExpirationIso, qrExpiresAtFromIso } from '@/lib/payments/mp-qr-payload'

export { isMercadoPagoEmvQr, qrExpirationIso, qrExpiresAtFromIso } from '@/lib/payments/mp-qr-payload'

const STORE_EXTERNAL_ID = (process.env.MERCADO_PAGO_STORE_EXTERNAL_ID ?? 'UNICREDHQ').replace(/[^A-Za-z0-9]/g, '').slice(0, 60)
const POS_EXTERNAL_ID = (process.env.MERCADO_PAGO_POS_EXTERNAL_ID ?? 'UNICREDCUPONERA').replace(/[^A-Za-z0-9]/g, '').slice(0, 40)

function mpUserId() {
  return (process.env.MERCADO_PAGO_USER_ID ?? '').trim()
}

export type MpQrOrderResult = {
  orderId: string
  qrData: string
  externalReference: string
  expiresAt: Date
  expirationTime: string
}

let posReady: Promise<string> | null = null

function mpErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const rec = data as Record<string, unknown>
  const msg = rec.message ?? rec.error ?? rec.cause
  if (typeof msg === 'string' && msg.trim()) return msg
  if (Array.isArray(rec.cause) && rec.cause[0] && typeof rec.cause[0] === 'object') {
    const first = rec.cause[0] as { description?: string; code?: string }
    return first.description || first.code || fallback
  }
  return fallback
}

function extractQrData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const typeResponse = rec.type_response as { qr_data?: string } | undefined
  const direct = typeof rec.qr_data === 'string' ? rec.qr_data : typeResponse?.qr_data
  if (isMercadoPagoEmvQr(direct)) return String(direct).trim()
  const tx = rec.transactions as { payments?: Array<{ payment_method?: { qr_code?: string } }> } | undefined
  const nested = tx?.payments?.[0]?.payment_method?.qr_code
  return isMercadoPagoEmvQr(nested) ? String(nested).trim() : null
}

async function findStoreId() {
  const userId = mpUserId()
  if (!userId) throw new Error('Falta MERCADO_PAGO_USER_ID para emitir QR de Mercado Pago.')
  const search = await mpApiFetch<Record<string, unknown>>(
    `/users/${encodeURIComponent(userId)}/stores/search?external_id=${encodeURIComponent(STORE_EXTERNAL_ID)}`,
  )
  const results = (search.data as { results?: Array<{ id?: number; external_id?: string }> } | null)?.results
  const found = results?.find((row) => row.external_id === STORE_EXTERNAL_ID) ?? results?.[0]
  if (found?.id) return String(found.id)

  const created = await mpApiFetch<Record<string, unknown>>(`/users/${encodeURIComponent(userId)}/stores`, {
    method: 'POST',
    idempotencyKey: `store-${STORE_EXTERNAL_ID}`,
    body: JSON.stringify({
      name: `${BRAND.company} · tesorería`,
      external_id: STORE_EXTERNAL_ID,
      location: {
        street_number: '566',
        street_name: 'Maipú',
        city_name: 'San Nicolás',
        state_name: 'Capital Federal',
        latitude: -34.6019,
        longitude: -58.3754,
        reference: BRAND.address,
      },
      business_hours: {
        monday: [{ open: '09:00', close: '18:00' }],
        tuesday: [{ open: '09:00', close: '18:00' }],
        wednesday: [{ open: '09:00', close: '18:00' }],
        thursday: [{ open: '09:00', close: '18:00' }],
        friday: [{ open: '09:00', close: '18:00' }],
      },
    }),
  })
  if (created.ok && created.data && typeof created.data === 'object' && 'id' in created.data) {
    return String((created.data as { id: number }).id)
  }
  console.error('[mp-qr] store create', created.status, created.raw.slice(0, 800))
  const again = await mpApiFetch<Record<string, unknown>>(
    `/users/${encodeURIComponent(userId)}/stores/search?external_id=${encodeURIComponent(STORE_EXTERNAL_ID)}`,
  )
  const retry = (again.data as { results?: Array<{ id?: number }> } | null)?.results?.[0]
  if (retry?.id) return String(retry.id)
  throw new Error(mpErrorMessage(created.data, 'No se pudo crear la sucursal QR de Mercado Pago.'))
}

async function findPosExternalId(storeId: string) {
  const listed = await mpApiFetch<Record<string, unknown>>(
    `/pos?external_id=${encodeURIComponent(POS_EXTERNAL_ID)}`,
  )
  const pagingResults =
    (listed.data as { results?: Array<{ external_id?: string }> } | Array<{ external_id?: string }> | null)
  const rows = Array.isArray(pagingResults)
    ? pagingResults
    : Array.isArray((pagingResults as { results?: unknown[] } | null)?.results)
      ? ((pagingResults as { results: Array<{ external_id?: string }> }).results)
      : []
  if (rows.some((row) => row.external_id === POS_EXTERNAL_ID)) return POS_EXTERNAL_ID

  const createdLegacy = await mpApiFetch<Record<string, unknown>>('/pos', {
    method: 'POST',
    idempotencyKey: `pos-${POS_EXTERNAL_ID}`,
    body: JSON.stringify({
      name: 'UNICRED cuponera',
      fixed_amount: false,
      store_id: Number(storeId) || storeId,
      external_store_id: STORE_EXTERNAL_ID,
      external_id: POS_EXTERNAL_ID,
    }),
  })
  if (createdLegacy.ok) return POS_EXTERNAL_ID
  const createdV2 = await mpApiFetch<Record<string, unknown>>('/v2/pos', {
    method: 'POST',
    idempotencyKey: `posv2-${POS_EXTERNAL_ID}`,
    body: JSON.stringify({
      name: 'UNICRED cuponera',
      store_id: String(storeId),
      external_id: POS_EXTERNAL_ID,
      config: { qr: { operating_mode: 'pdv' } },
    }),
  })
  if (createdV2.ok) return POS_EXTERNAL_ID
  console.error('[mp-qr] pos create', createdLegacy.status, createdLegacy.raw.slice(0, 400), createdV2.status, createdV2.raw.slice(0, 400))
  const listedAgain = await mpApiFetch<Record<string, unknown>>(
    `/pos?external_id=${encodeURIComponent(POS_EXTERNAL_ID)}`,
  )
  const again = listedAgain.data as { results?: Array<{ external_id?: string }> } | null
  if (again?.results?.some((row) => row.external_id === POS_EXTERNAL_ID)) return POS_EXTERNAL_ID
  throw new Error(
    mpErrorMessage(createdLegacy.data ?? createdV2.data, 'No se pudo crear la caja QR de Mercado Pago.'),
  )
}

export async function ensureMercadoPagoQrPos() {
  if (!posReady) {
    posReady = (async () => {
      const storeId = await findStoreId()
      return findPosExternalId(storeId)
    })().catch((err) => {
      posReady = null
      throw err
    })
  }
  return posReady
}

export async function createMercadoPagoQrOrder(params: {
  amount: number
  title: string
  description?: string
  externalReference: string
  expiresAt: Date
  idempotencyKey?: string
}): Promise<MpQrOrderResult> {
  const amount = Number(params.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Importe inválido para el QR de Mercado Pago.')
  const posId = await ensureMercadoPagoQrPos()
  const expirationTime = qrExpirationIso(params.expiresAt)
  const unit = amount.toFixed(2)
  const body: Record<string, unknown> = {
    type: 'qr',
    total_amount: unit,
    description: (params.description ?? params.title).slice(0, 150),
    external_reference: params.externalReference.slice(0, 64),
    expiration_time: expirationTime,
    config: {
      qr: {
        external_pos_id: posId,
        mode: 'dynamic',
      },
    },
    transactions: {
      payments: [{ amount: unit }],
    },
    items: [
      {
        title: params.title.slice(0, 150),
        unit_price: unit,
        quantity: 1,
        unit_measure: 'unit',
        external_code: params.externalReference.slice(0, 30),
      },
    ],
  }

  const created = await mpApiFetch<Record<string, unknown>>('/v1/orders', {
    method: 'POST',
    idempotencyKey: params.idempotencyKey ?? randomUUID(),
    body: JSON.stringify(body),
  })

  let data = created.data
  if (!created.ok) {
    const retryBody = {
      ...body,
      transactions: { payments: { amount: unit } },
      items: {
        title: params.title.slice(0, 150),
        unit_price: unit,
        quantity: 1,
        unit_measure: 'unit',
        external_code: params.externalReference.slice(0, 30),
      },
    }
    const retry = await mpApiFetch<Record<string, unknown>>('/v1/orders', {
      method: 'POST',
      idempotencyKey: `${params.idempotencyKey ?? randomUUID()}-b`,
      body: JSON.stringify(retryBody),
    })
    if (!retry.ok) {
      console.error('[mp-qr] order create', created.status, created.raw.slice(0, 500), retry.status, retry.raw.slice(0, 500))
      throw new Error(mpErrorMessage(retry.data ?? created.data, 'Mercado Pago no emitió el QR de pago.'))
    }
    data = retry.data
  }

  const qrData = extractQrData(data)
  const orderId = data && typeof data === 'object' && 'id' in data ? String((data as { id: unknown }).id) : ''
  if (!qrData || !orderId) {
    throw new Error('Mercado Pago no devolvió qr_data EMV. El cupón no puede imprimir un QR de simulación.')
  }
  return {
    orderId,
    qrData,
    externalReference: params.externalReference,
    expirationTime,
    expiresAt: qrExpiresAtFromIso(expirationTime),
  }
}

export async function getMercadoPagoQrOrder(orderId: string) {
  const res = await mpApiFetch<Record<string, unknown>>(`/v1/orders/${encodeURIComponent(orderId)}`)
  if (!res.ok) return null
  return res.data
}

export function paymentIdsFromQrOrder(order: Record<string, unknown> | null | undefined) {
  if (!order) return [] as string[]
  const payments = (order.transactions as { payments?: Array<Record<string, unknown>> } | undefined)?.payments ?? []
  const ids: string[] = []
  for (const row of payments) {
    const status = String(row.status ?? '').toLowerCase()
    const id = row.id ?? row.payment_id ?? row.reference_id
    if (!id) continue
    if (status && !['processed', 'paid', 'approved', 'ready_to_process', 'created'].includes(status)) continue
    ids.push(String(id))
  }
  return ids
}
