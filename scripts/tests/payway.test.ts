import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPaywayMethod,
  lookupSandboxBin,
  mapPaywayStatus,
  paywayAllowsSimulate,
  validatePaywayWebhook,
} from '../../lib/payway'
import { isPaywayQr, paywayQrLabel } from '../../lib/payments/payway-qr'

describe('Payway sandbox', () => {
  it('reconoce los métodos del riel Payway y no mezcla Mercado Pago', () => {
    assert.equal(isPaywayMethod('payway_qr'), true)
    assert.equal(isPaywayMethod('payway_wallet'), true)
    assert.equal(isPaywayMethod('payway_card'), true)
    assert.equal(isPaywayMethod('mercado_pago'), false)
    assert.equal(isPaywayMethod('pago_facil'), false)
  })

  it('mapea estados del gateway a estados locales', () => {
    assert.equal(mapPaywayStatus('approved'), 'paid')
    assert.equal(mapPaywayStatus('ACCREDITED'), 'paid')
    assert.equal(mapPaywayStatus('pending'), 'processing')
    assert.equal(mapPaywayStatus('rejected'), 'failed')
    assert.equal(mapPaywayStatus('refunded'), 'refunded')
    assert.equal(mapPaywayStatus('foo'), null)
  })

  it('resuelve BINs de prueba locales', () => {
    const visa = lookupSandboxBin('4507990000004905')
    assert.equal(visa?.brand, 'Visa')
    assert.equal(visa?.kind, 'credit')
    assert.equal(visa?.source, 'sandbox_table')
    assert.equal(lookupSandboxBin('123'), null)
  })

  it('detecta el QR de checkout Payway', () => {
    assert.equal(isPaywayQr('https://unicreditos.com/pagar/abc?method=payway_qr&pay=1'), true)
    assert.equal(isPaywayQr('PAYWAY:sandbox:xyz'), true)
    assert.equal(isPaywayQr('000201mercadopago'), false)
    assert.equal(paywayQrLabel('payway_wallet').includes('Billetera'), true)
  })

  it('la simulación exige flag local y nunca corre en production', () => {
    const previousEnv = process.env.PAYWAY_ENV
    const previousFlag = process.env.ALLOW_PAYWAY_SIMULATE
    process.env.PAYWAY_ENV = 'sandbox'
    delete process.env.ALLOW_PAYWAY_SIMULATE
    assert.equal(paywayAllowsSimulate(), false)
    process.env.ALLOW_PAYWAY_SIMULATE = '1'
    assert.equal(paywayAllowsSimulate(), true)
    process.env.PAYWAY_ENV = 'production'
    assert.equal(paywayAllowsSimulate(), false)
    if (previousEnv === undefined) delete process.env.PAYWAY_ENV
    else process.env.PAYWAY_ENV = previousEnv
    if (previousFlag === undefined) delete process.env.ALLOW_PAYWAY_SIMULATE
    else process.env.ALLOW_PAYWAY_SIMULATE = previousFlag
  })

  it('el webhook exige PAYWAY_WEBHOOK_SECRET', () => {
    const previousSecret = process.env.PAYWAY_WEBHOOK_SECRET
    const previousKey = process.env.PAYWAY_SANDBOX_SECRET_KEY
    process.env.PAYWAY_WEBHOOK_SECRET = 'hook-secret'
    process.env.PAYWAY_SANDBOX_SECRET_KEY = 'sk-sandbox'
    assert.equal(validatePaywayWebhook({ querySecret: 'hook-secret' }), true)
    assert.equal(validatePaywayWebhook({ secretHeader: 'hook-secret' }), true)
    assert.equal(validatePaywayWebhook({ secretHeader: 'sk-sandbox' }), false)
    assert.equal(validatePaywayWebhook({ querySecret: 'otro' }), false)
    if (previousSecret === undefined) delete process.env.PAYWAY_WEBHOOK_SECRET
    else process.env.PAYWAY_WEBHOOK_SECRET = previousSecret
    if (previousKey === undefined) delete process.env.PAYWAY_SANDBOX_SECRET_KEY
    else process.env.PAYWAY_SANDBOX_SECRET_KEY = previousKey
  })
})
