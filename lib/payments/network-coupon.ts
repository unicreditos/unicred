/** Intenciones de cobro en red (Pago Fácil / Rapipago) que todavía no son un movimiento. */

const NETWORK_METHODS = new Set(['pago_facil', 'rapipago', 'ticket'])
const POSTED_STATUSES = new Set(['paid', 'pending_review', 'refunded', 'failed'])

export function isPostedCollectionStatus(status: string | null | undefined) {
  return POSTED_STATUSES.has(String(status ?? ''))
}

export function isOpenNetworkCoupon(row: {
  status?: string | null
  method?: string | null
  source?: string | null
}) {
  const status = String(row.status ?? '')
  if (status !== 'pending' && status !== 'processing') return false
  if (NETWORK_METHODS.has(String(row.method ?? ''))) return true
  return row.source === 'coupon_book'
}

export function mercadoPagoNumericId(row: {
  externalId?: string | null
  paymentLinkId?: string | null
  gatewayResponse?: unknown
}) {
  const g =
    row.gatewayResponse && typeof row.gatewayResponse === 'object' && !Array.isArray(row.gatewayResponse)
      ? (row.gatewayResponse as Record<string, unknown>)
      : {}
  for (const raw of [row.externalId, g.mp_payment_id, row.paymentLinkId]) {
    const s = String(raw ?? '').trim()
    if (/^\d+$/.test(s)) return s
  }
  return null
}
