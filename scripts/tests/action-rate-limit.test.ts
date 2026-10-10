import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { ACTION_LIMITS, actionLimitKey, checkActionLimit, enforceActionLimit, LIMIT_EXCEEDED_MESSAGE, LIMIT_UNAVAILABLE_MESSAGE, type LimitConsumer } from '../../lib/action-rate-limit'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const fnBody = (file: string, name: string) => {
  const s = src(file)
  const start = s.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `${name} no existe`)
  const next = s.indexOf('\nexport ', start + 10)
  return s.slice(start, next < 0 ? undefined : next)
}

/** Contador en memoria con la misma semantica que consumeRateLimit (cuenta > limite = bloqueado). */
function memoryConsumer() {
  const counts = new Map<string, number>()
  const calls: Array<{ key: string; limit: number; windowMs: number }> = []
  const consume: LimitConsumer = async (key, limit, windowMs) => {
    calls.push({ key, limit, windowMs })
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    return n > limit ? { ok: false, retryInMs: 90_000 } : { ok: true }
  }
  return { consume, calls }
}

describe('topes de intentos por accion', () => {
  it('BCRA: 5 consultas por ventana y la sexta se bloquea con tiempo de espera', async () => {
    const m = memoryConsumer()
    for (let i = 0; i < ACTION_LIMITS.bcra.limit; i++) assert.deepEqual(await checkActionLimit('bcra', 'u1', m.consume), { ok: true })
    const blocked = await checkActionLimit('bcra', 'u1', m.consume)
    assert.equal(blocked.ok, false)
    if (!blocked.ok) {
      assert.equal(blocked.message, LIMIT_EXCEEDED_MESSAGE)
      assert.equal(blocked.retryAfterSec, 90)
      assert.equal(blocked.unavailable, false)
    }
  })
  it('el tope es por usuario y por scope: otro usuario u otra accion no se ven afectados', async () => {
    const m = memoryConsumer()
    for (let i = 0; i < 6; i++) await checkActionLimit('bcra', 'u1', m.consume)
    assert.deepEqual(await checkActionLimit('bcra', 'u2', m.consume), { ok: true })
    assert.deepEqual(await checkActionLimit('claim', 'u1', m.consume), { ok: true })
    assert.notEqual(actionLimitKey('bcra', 'u1'), actionLimitKey('claim', 'u1'))
  })
  it('usa los limites de la tabla en cada llamada', async () => {
    const m = memoryConsumer()
    await checkActionLimit('payment', 'u1', m.consume)
    assert.deepEqual(m.calls[0], { key: 'act:payment:u1', ...ACTION_LIMITS.payment })
  })
  it('falla cerrado: si el contador no responde, la accion se rechaza', async () => {
    const boom: LimitConsumer = async () => {
      throw new Error('db caida')
    }
    const r = await checkActionLimit('claim', 'u1', boom)
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.message, LIMIT_UNAVAILABLE_MESSAGE)
      assert.equal(r.unavailable, true)
    }
    await assert.rejects(enforceActionLimit('claim', 'u1', boom), { message: LIMIT_UNAVAILABLE_MESSAGE })
  })
  it('enforceActionLimit lanza al superar el tope', async () => {
    const m = memoryConsumer()
    for (let i = 0; i < ACTION_LIMITS.claim.limit; i++) await enforceActionLimit('claim', 'u1', m.consume)
    await assert.rejects(enforceActionLimit('claim', 'u1', m.consume), { message: LIMIT_EXCEEDED_MESSAGE })
  })
})

describe('topes de intentos: cableado en las acciones', () => {
  const cases: Array<[string, string, string]> = [
    ['app/actions/bcra.ts', 'consultMyBcra', "checkActionLimit('bcra', userId)"],
    ['app/actions/loans.ts', 'evaluateLoanOffer', "checkActionLimit('credit-quote', userId)"],
    ['app/actions/loans.ts', 'requestLoan', "checkActionLimit('credit-request', userId)"],
    ['app/actions/account.ts', 'requestProfileChange', "checkActionLimit('credit-request', userId)"],
    ['app/actions/claims.ts', 'createClaim', "enforceActionLimit('claim', userId)"],
    ['app/actions/support.ts', 'sendSupportMessage', "enforceActionLimit('claim', userId)"],
    ['app/actions/payments.ts', 'createPaymentLink', "enforceActionLimit('payment', userId)"],
    ['app/actions/payments.ts', 'createEarlySettlementCheckout', "enforceActionLimit('payment', userId)"],
    ['app/actions/payments.ts', 'reportBankTransfer', "enforceActionLimit('payment', userId)"],
    ['app/actions/payments.ts', 'createCouponCheckout', "enforceActionLimit('coupon-action'"],
    ['app/actions/payments.ts', 'getCouponInstallment', "enforceActionLimit('coupon-lookup', userId)"],
    ['app/actions/payments.ts', 'getLoanCouponQrs', "enforceActionLimit('coupon-lookup', userId)"],
    ['app/actions/payments.ts', 'getInstallmentCoupons', "enforceActionLimit('coupon-lookup', userId)"],
  ]
  for (const [file, name, call] of cases) {
    it(`${name} aplica el tope antes de tocar la base o el proveedor`, () => {
      const body = fnBody(file, name)
      const at = body.indexOf(call)
      assert.ok(at >= 0, `falta ${call}`)
      assert.ok(!/db\s*\n?\s*\.(select|insert|update)|persistBcraConsultation|createPaymentLinkMP/.test(body.slice(0, at)), 'el tope va antes del primer acceso a la base o al proveedor')
    })
  }
  it('mp-process aplica el tope por usuario y responde 429', () => {
    const r = src('app/api/payments/mp-process/route.ts')
    assert.match(r, /checkActionLimit\('payment', userId\)/)
    assert.match(r, /status: 429/)
    assert.ok(r.indexOf("checkActionLimit('payment'") < r.indexOf('db\n    .select'))
  })
})