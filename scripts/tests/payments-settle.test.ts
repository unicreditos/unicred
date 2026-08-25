import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapMpStatus, sameInstallmentSet } from '../../lib/payments/settle-mp'
import { brickPaymentMethods } from '../../lib/payments/brick-methods'

describe('conciliación Mercado Pago', () => {
  it('solo mapped approved es cobro acreditado', () => {
    assert.equal(mapMpStatus('approved'), 'paid')
    assert.equal(mapMpStatus('pending'), 'processing')
    assert.equal(mapMpStatus('in_process'), 'processing')
    assert.equal(mapMpStatus('rejected'), 'failed')
    assert.equal(mapMpStatus('cancelled'), 'failed')
    assert.equal(mapMpStatus('refunded'), 'refunded')
    assert.equal(mapMpStatus('unknown'), null)
  })

  it('compara el set de cuotas sin importar el orden', () => {
    assert.equal(sameInstallmentSet(['a', 'b'], ['b', 'a']), true)
    assert.equal(sameInstallmentSet(['a'], ['a', 'b']), false)
    assert.equal(sameInstallmentSet(undefined, ['a']), false)
  })

  it('el brick no mezcla transferencia bancaria RM con tarjetas', () => {
    const all = brickPaymentMethods('all')
    assert.equal('bankTransfer' in all, false)
    assert.equal(all.creditCard, 'all')
    assert.equal(brickPaymentMethods('ticket').ticket, 'all')
    assert.equal(brickPaymentMethods('credit_card').creditCard, 'all')
  })
})
