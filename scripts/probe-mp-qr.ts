import { loadProjectEnv } from './load-env'
import path from 'node:path'
import dotenv from 'dotenv'

const root = path.join(process.cwd())
loadProjectEnv(root)
if (process.argv.includes('--live')) {
  dotenv.config({ path: path.join(root, '.env.production.local'), override: true })
}

async function main() {
  const { isMercadoPagoEmvQr } = await import('../lib/payments/mp-qr-payload')
  const { createMercadoPagoQrOrder, ensureMercadoPagoQrPos } = await import('../lib/mercadopago-qr')
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ''
  if (!token) {
    console.error('FAIL: falta MERCADO_PAGO_ACCESS_TOKEN')
    process.exit(1)
  }
  console.log(`token=${token.startsWith('APP_USR-') ? 'live' : token.startsWith('TEST-') ? 'test' : 'otro'}`)
  console.log(`user_id=${process.env.MERCADO_PAGO_USER_ID ? 'ok' : 'faltante'}`)

  const pos = await ensureMercadoPagoQrPos()
  console.log(`pos=${pos}`)

  const qr = await createMercadoPagoQrOrder({
    amount: 15,
    title: 'UNICRÉDITOS probe QR',
    description: 'Prueba de emisión de QR EMV',
    externalReference: `PROBE_${Date.now().toString(36)}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    idempotencyKey: `probe-qr-${Date.now()}`,
  })
  if (!isMercadoPagoEmvQr(qr.qrData)) {
    console.error('FAIL: Mercado Pago no devolvió un QR EMV')
    process.exit(1)
  }
  console.log(`order=${qr.orderId}`)
  console.log(`emv_prefix=${qr.qrData.slice(0, 24)}`)
  console.log(`emv_len=${qr.qrData.length}`)
  console.log('OK QR Mercado Pago válido')
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
