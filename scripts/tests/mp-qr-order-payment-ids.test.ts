import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { paymentIdsFromQrOrder } from '../../lib/mercadopago-qr'

describe('orden QR de Mercado Pago: ids de pago', () => {
  it('usa el reference_id numérico y no el id interno PAY…', () => {
    const order = { transactions: { payments: [{ id: 'PAY01ABC', reference_id: '183403935234', status: 'processed' }] } }
    assert.deepEqual(paymentIdsFromQrOrder(order), ['183403935234'])
  })
  it('ignora pagos no acreditables y soporta payment_id numérico', () => {
    const order = {
      transactions: {
        payments: [
          { id: 'PAY02', reference_id: '111', status: 'failed' },
          { id: 'PAY03', payment_id: 222, status: 'approved' },
          { id: 'PAY04', status: 'processed' },
        ],
      },
    }
    assert.deepEqual(paymentIdsFromQrOrder(order), ['222'])
  })
  it('sin orden devuelve lista vacía', () => {
    assert.deepEqual(paymentIdsFromQrOrder(null), [])
  })
})
