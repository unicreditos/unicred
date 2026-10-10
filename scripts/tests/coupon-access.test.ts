import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertCanViewCouponInstallment, COUPON_FORBIDDEN_MESSAGE } from '../../lib/payments/coupon-access'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// Mismo criterio que canViewOwnedRecord: el dueno o un administrador.
const canView = (admins: string[]) => async (viewer: string, owner: string) => viewer === owner || admins.includes(viewer)

describe('getCouponInstallment: autenticacion y dueno', () => {
  it('el dueno puede ver su cuota', async () => {
    await assert.doesNotReject(assertCanViewCouponInstallment('u1', 'u1', canView([])))
  })
  it('un administrador puede ver la cuota de otro', async () => {
    await assert.doesNotReject(assertCanViewCouponInstallment('adm', 'u1', canView(['adm'])))
  })
  it('otro cliente recibe el error de las funciones hermanas', async () => {
    await assert.rejects(assertCanViewCouponInstallment('u2', 'u1', canView([])), { message: COUPON_FORBIDDEN_MESSAGE })
  })
  it('una cuota inexistente da el mismo error que una ajena (no revela si el id existe)', async () => {
    await assert.rejects(assertCanViewCouponInstallment('u1', null, canView([])), { message: COUPON_FORBIDDEN_MESSAGE })
    await assert.rejects(assertCanViewCouponInstallment('u1', undefined, canView([])), { message: COUPON_FORBIDDEN_MESSAGE })
  })
  it('la accion exige sesion antes de consultar la base y valida el dueno', () => {
    const s = src('app/actions/payments.ts')
    const fn = s.slice(s.indexOf('export async function getCouponInstallment'), s.indexOf('export async function createCouponCheckout'))
    assert.match(fn, /const userId = await requireUserId\(\)/)
    assert.ok(fn.indexOf('requireUserId()') < fn.indexOf('db\n    .select'), 'la sesion se exige antes del select')
    assert.match(fn, /assertCanViewCouponInstallment\(userId, row\?\.userId, canViewOwnedRecord\)/)
    assert.ok(!/return null/.test(fn), 'no devuelve null: ajena e inexistente dan el mismo error')
  })
})