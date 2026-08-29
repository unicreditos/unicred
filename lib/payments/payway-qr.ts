export function paywayCheckoutPath(paymentId: string) {
  return `/pagar/payway/${paymentId}`
}

export function isPaywayQr(value: string | null | undefined) {
  const s = String(value ?? '').trim()
  if (!s) return false
  if (s.startsWith('PAYWAY:')) return true
  try {
    const url = new URL(s)
    return url.searchParams.get('method')?.startsWith('payway_') === true || url.pathname.includes('/pagar/payway/')
  } catch {
    return false
  }
}

export function paywayQrLabel(method: string) {
  if (method === 'payway_wallet') return 'Billetera virtual (sandbox)'
  if (method === 'payway_card') return 'QR Payway tarjeta (sandbox)'
  return 'QR Payway (sandbox)'
}
