import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'
import { validateWebhookSignature } from '../../lib/mercadopago'

const secret = 'test-secret-not-real'
const sign = (id: string, reqId: string, ts: string) =>
  createHmac('sha256', secret).update(`id:${id};request-id:${reqId};ts:${ts}`).digest('hex')
const ts = String(Math.floor(Date.now() / 1000))

describe('Webhook Mercado Pago: data.id alfanumerico en minusculas', () => {
  it('un id ORD... se firma en minusculas y valida', () => {
    const v1 = sign('ord01abc', 'req-1', ts)
    assert.equal(
      validateWebhookSignature({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1' }, queryDataId: 'ORD01ABC', secretOverride: secret, toleranceSeconds: 60 }),
      true,
    )
  })
  it('tambien desde el body cuando no hay query', () => {
    const v1 = sign('ord99xyz', 'req-2', ts)
    assert.equal(
      validateWebhookSignature({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-2' }, body: { data: { id: 'ORD99XYZ' } }, secretOverride: secret }),
      true,
    )
  })
  it('un id numerico sigue validando y una firma ajena falla', () => {
    const v1 = sign('123456', 'req-3', ts)
    assert.equal(validateWebhookSignature({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-3' }, queryDataId: '123456', secretOverride: secret }), true)
    assert.equal(validateWebhookSignature({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-3' }, queryDataId: '123457', secretOverride: secret }), false)
    assert.equal(validateWebhookSignature({ headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-3' }, queryDataId: '123456', secretOverride: '' }), false)
  })
})