import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapMpStatus, sameInstallmentSet } from '../../lib/payments/settle-mp'
import { brickPaymentMethods } from '../../lib/payments/brick-methods'
import { isOpenNetworkCoupon, isPostedCollectionStatus, mercadoPagoNumericId } from '../../lib/payments/network-coupon'

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

describe('cupones de red vs movimientos', () => {
  it('un cupón PF/RP pendiente no es un cobro posteado', () => {
    assert.equal(isOpenNetworkCoupon({ status: 'pending', method: 'pago_facil', source: 'coupon_book' }), true)
    assert.equal(isOpenNetworkCoupon({ status: 'processing', method: 'rapipago', source: 'coupon_book' }), true)
    assert.equal(isPostedCollectionStatus('pending'), false)
    assert.equal(isPostedCollectionStatus('paid'), true)
    assert.equal(isPostedCollectionStatus('pending_review'), true)
  })

  it('una transferencia RM o un checkout de tarjeta no se listan como cupón de red', () => {
    assert.equal(isOpenNetworkCoupon({ status: 'pending', method: 'transferencia_rm', source: 'admin' }), false)
    assert.equal(isOpenNetworkCoupon({ status: 'pending', method: 'mercado_pago', source: 'web' }), false)
    assert.equal(isOpenNetworkCoupon({ status: 'paid', method: 'pago_facil', source: 'coupon_book' }), false)
    assert.equal(isOpenNetworkCoupon({ status: 'cancelled', method: 'rapipago', source: 'coupon_book' }), false)
  })

  it('toma el id numérico de Mercado Pago y descarta preferencias', () => {
    assert.equal(
      mercadoPagoNumericId({
        externalId: '1234567890',
        paymentLinkId: 'pref_abc',
        gatewayResponse: { mp_payment_id: '999' },
      }),
      '1234567890',
    )
    assert.equal(
      mercadoPagoNumericId({
        externalId: 'pref_abc',
        paymentLinkId: 'pref_abc',
        gatewayResponse: { mp_payment_id: '77441122' },
      }),
      '77441122',
    )
    assert.equal(mercadoPagoNumericId({ externalId: 'pref_abc', gatewayResponse: {} }), null)
  })
})
