import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractMpTicketFields } from '../../lib/mercadopago'
import { ticketValidUntil } from '../../lib/payments/installment-mp-ticket'

describe('cupones Pago Fácil / Rapipago', () => {
  it('lee barcode y ticket_url de la respuesta de Mercado Pago', () => {
    const parsed = extractMpTicketFields({
      id: 5466310457,
      status: 'pending',
      date_of_expiration: '2026-09-20T23:59:59.000-03:00',
      barcode: { content: '3335008800000000006004835002100020000242462010' },
      transaction_details: {
        external_resource_url:
          'https://www.mercadopago.com.ar/payments/123456/ticket?payment_method_id=rapipago',
        payment_method_reference_id: '1234567890',
      },
    })
    assert.equal(parsed?.paymentId, '5466310457')
    assert.equal(parsed?.barcode, '3335008800000000006004835002100020000242462010')
    assert.match(parsed?.ticketUrl ?? '', /mercadopago\.com\.ar\/payments\/123456\/ticket/)
  })

  it('acepta barcode_content del Orders API', () => {
    const parsed = extractMpTicketFields({
      id: 'ord_1',
      barcode_content: '3335008800000000006004835002100020000242462010',
      point_of_interaction: {
        transaction_data: {
          ticket_url: 'https://www.mercadopago.com.ar/payments/1/ticket',
        },
      },
    })
    assert.equal(parsed?.barcode, '3335008800000000006004835002100020000242462010')
    assert.ok(parsed?.ticketUrl)
  })

  it('rechaza una respuesta sin cupón', () => {
    assert.equal(extractMpTicketFields({ id: 1, status: 'pending' }), null)
  })

  it('capita la vigencia del cupón de red en 30 días', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const far = ticketValidUntil(new Date('2027-01-01T00:00:00.000Z'), now)
    const diffDays = (far.getTime() - now.getTime()) / 86400000
    assert.ok(diffDays <= 30.01)
    assert.ok(diffDays >= 29)
  })
})
