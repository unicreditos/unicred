/** Máximo de la API de órdenes QR de Mercado Pago: 3600 horas = 150 días. */
export const MP_QR_MAX_HOURS = 3600

export function isMercadoPagoEmvQr(value: string | null | undefined) {
  const s = String(value ?? '').trim()
  if (!s.startsWith('000201')) return false
  return /mercadolibre|mercadopago|com\.mercadolibre/i.test(s)
}

export function qrExpirationIso(until: Date, now = new Date()) {
  const minMs = 30 * 60 * 1000
  const ms = Math.max(until.getTime() - now.getTime(), minMs)
  const hours = Math.min(Math.max(Math.ceil(ms / 3_600_000), 1), MP_QR_MAX_HOURS)
  return `PT${hours}H`
}

export function qrExpiresAtFromIso(iso: string, now = new Date()) {
  const hours = Number(/^PT(\d+)H$/i.exec(iso)?.[1] ?? 0)
  const minutes = Number(/^PT(\d+)M$/i.exec(iso)?.[1] ?? 0)
  const addMs = hours ? hours * 3_600_000 : minutes * 60_000
  return new Date(now.getTime() + Math.max(addMs, 30 * 60 * 1000))
}
