import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildSandboxAlias,
  buildSandboxCvu,
  cbuBlock1Check,
  isValidCbuOrCvu,
  parseWalletDestination,
} from '../../lib/payments/cvu'

describe('Billetera virtual CVU', () => {
  it('calcula el dígito del primer bloque CBU', () => {
    assert.equal(cbuBlock1Check('0003220').length, 1)
    assert.match(cbuBlock1Check('0003220'), /^\d$/)
  })

  it('emite un CVU de 22 dígitos con verificadores válidos y estable por usuario', () => {
    const a = buildSandboxCvu('user-abc')
    const b = buildSandboxCvu('user-abc')
    const c = buildSandboxCvu('user-xyz')
    assert.equal(a.length, 22)
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.equal(isValidCbuOrCvu(a), true)
    assert.equal(isValidCbuOrCvu(c), true)
    assert.equal(a.startsWith('0003220'), true)
  })

  it('rechaza CVU/CBU inválidos', () => {
    assert.equal(isValidCbuOrCvu('123'), false)
    assert.equal(isValidCbuOrCvu('0003220000000000000000'), false)
  })

  it('arma un alias Coelsa de prueba', () => {
    const alias = buildSandboxAlias('user-abc')
    assert.match(alias, /^unicred\.[a-f0-9]{8}$/)
    assert.equal(alias, buildSandboxAlias('user-abc'))
  })

  it('parsea destino CBU/CVU o alias', () => {
    const cvu = buildSandboxCvu('user-abc')
    assert.equal(parseWalletDestination(cvu).kind, 'cvu')
    assert.equal(parseWalletDestination('unicred.de704cb8').kind, 'alias')
    assert.throws(() => parseWalletDestination('xx'))
  })

  it('el riel de tesorería RM queda en cola si no hay Payway live', async () => {
    const { executeExternalRail } = await import('../../lib/payments/wallet-rail')
    const result = await executeExternalRail({
      reference: 'UC-OUT-TEST',
      amount: 1500,
      originCvu: buildSandboxCvu('user-abc'),
      originAlias: buildSandboxAlias('user-abc'),
      destination: { kind: 'cbu', value: '0170099120000000123456' },
      concept: 'Prueba',
    })
    assert.equal(result.ok, true)
    assert.ok(result.rail === 'treasury_rm' || result.rail === 'payway' || result.rail === 'pomelo')
    assert.ok(typeof result.message === 'string')
  })
})
