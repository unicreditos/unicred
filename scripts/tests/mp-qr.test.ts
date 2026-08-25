import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isMercadoPagoEmvQr, qrExpirationIso } from '../../lib/payments/mp-qr-payload'
import { installmentPayUrl } from '../../lib/coupon'

describe('QR Mercado Pago imprimible', () => {
  it('acepta el payload EMVCo de Mercado Pago y rechaza URLs', () => {
    const emv =
      '00020101021243650016com.mercadolibre020130636261ba79b-e543-41c7-b71a-cec05c18e72b50120008326594305204970053030325802AR5904Test6004CABA63041094'
    assert.equal(isMercadoPagoEmvQr(emv), true)
    assert.equal(isMercadoPagoEmvQr('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc'), false)
    assert.equal(isMercadoPagoEmvQr('https://www.unicreditos.com/pagar/00000000-0000-4000-8000-000000000000'), false)
    assert.equal(isMercadoPagoEmvQr(installmentPayUrl('abc')), false)
    assert.equal(isMercadoPagoEmvQr(''), false)
  })

  it('capita la vigencia del QR en 3600 horas', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    assert.equal(qrExpirationIso(new Date('2026-01-01T00:20:00.000Z'), now), 'PT1H')
    assert.equal(qrExpirationIso(new Date('2027-01-01T00:00:00.000Z'), now), 'PT3600H')
    assert.equal(qrExpirationIso(new Date('2026-01-10T00:00:00.000Z'), now), 'PT216H')
  })
})
