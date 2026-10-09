import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { safeNextPath, secondFactorRequiredFor } from '../../lib/second-factor-core'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Segundo factor al iniciar sesion, ligado a la sesion', () => {
  it('apagado por defecto; se enciende solo con yes y por rol', () => {
    assert.equal(secondFactorRequiredFor('admin', {}), false)
    assert.equal(secondFactorRequiredFor('admin', { ADMIN_2FA_LOGIN: 'yes' }), true)
    assert.equal(secondFactorRequiredFor('customer', { ADMIN_2FA_LOGIN: 'yes' }), false)
    assert.equal(secondFactorRequiredFor('merchant', { CUSTOMER_2FA_LOGIN: 'YES' }), true)
  })
  it('next solo admite rutas internas', () => {
    assert.equal(safeNextPath('/admin/x', '/'), '/admin/x')
    assert.equal(safeNextPath('//evil.com', '/d'), '/d')
    assert.equal(safeNextPath('https://evil.com', '/d'), '/d')
    assert.equal(safeNextPath('/a\\b', '/d'), '/d')
    assert.equal(safeNextPath(null, '/d'), '/d')
  })
  it('requireAdmin, assertAdmin, requireCustomer y requireMerchant aplican el gate', () => {
    const s = src('lib/session.ts')
    assert.equal((s.match(/secondFactorSatisfied\(userId, '/g) ?? []).length >= 4, true)
    assert.match(s, /skipSecondFactor/)
    assert.match(s, /redirect\('\/verificar-2fa/)
  })
  it('los pasos que conceden el factor no lo exigen y quedan ligados a la sesion', () => {
    assert.match(src('app/api/admin/2fa/send/route.ts'), /skipSecondFactor: true/)
    assert.match(src('app/api/admin/2fa/verify/route.ts'), /skipSecondFactor: true/)
    assert.match(src('lib/second-factor-api.ts'), /sessionId: who\.sessionId/)
    assert.match(src('lib/admin-otp.ts'), /"sessionId"/)
    assert.match(src('scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql'), /"sessionId"/)
  })
  it('la vista de documentos exige el factor de la misma sesion', () => {
    assert.match(src('app/api/admin/kyc-evidence/[userId]/[kind]/route.ts'), /hasFreshSecondFactor\(actorId, await currentSessionId\(\)\)/)
  })
})