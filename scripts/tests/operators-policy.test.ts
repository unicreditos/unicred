import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  anonymizedEmail,
  decideDelete,
  isAnonymizedEmail,
  isPlaceholderEmail,
  isValidEmail,
  validateNewPassword,
  validateReason,
  type DeleteFacts,
} from '../../lib/operators/policy'

const base: DeleteFacts = {
  actorId: 'a',
  targetId: 't',
  targetIsOperator: true,
  otherActiveManagers: 1,
  historyCounts: {},
  authoredAudit: 0,
  anyAuditRows: 0,
  sessions: 0,
  emailVerified: false,
}

describe('operadores: reglas puras', () => {
  it('clave: minimo 12, maximo 128, sin repetir ni igualar el email', () => {
    assert.equal(validateNewPassword('corta123').ok, false)
    assert.equal(validateNewPassword('a'.repeat(129)).ok, false)
    assert.equal(validateNewPassword('x'.repeat(14)).ok, false)
    assert.equal(validateNewPassword(' espacios-bordes1 ').ok, false)
    assert.equal(validateNewPassword('persona@correo.com', 'persona@correo.com').ok, false)
    assert.equal(validateNewPassword('una-clave-larga-1').ok, true)
  })

  it('email: formato y dominios de prueba', () => {
    assert.ok(isValidEmail('ana.perez+op@empresa.com.ar'))
    for (const bad of ['', 'sin-arroba', 'a@b', 'a b@c.com', 'a@@c.com', 'a@c..com']) assert.equal(isValidEmail(bad), false, bad)
    assert.ok(isPlaceholderEmail('x@example.invalid'))
    assert.ok(isPlaceholderEmail('x@example.com'))
    assert.ok(isPlaceholderEmail('x@algo.test'))
    assert.ok(!isPlaceholderEmail('x@unicreditos.com'))
  })

  it('motivo: minimo 10 caracteres', () => {
    assert.equal(validateReason('corto').ok, false)
    assert.equal(validateReason('   corto   ').ok, false)
    assert.equal(validateReason('usuario de prueba creado por error').ok, true)
  })

  it('anonimizado es reconocible y no es un email real', () => {
    const e = anonymizedEmail('AbC-123_xyz')
    assert.ok(isAnonymizedEmail(e))
    assert.ok(isPlaceholderEmail(e))
    assert.ok(isValidEmail(e))
  })

  it('baja: huerfano real se borra; con rastro se desactiva', () => {
    assert.deepEqual(decideDelete(base), { allowed: true, mode: 'hard' })
    assert.deepEqual(decideDelete({ ...base, sessions: 1 }), { allowed: true, mode: 'soft' })
    assert.deepEqual(decideDelete({ ...base, emailVerified: true }), { allowed: true, mode: 'soft' })
    assert.deepEqual(decideDelete({ ...base, anyAuditRows: 2 }), { allowed: true, mode: 'soft' })
  })

  it('baja: nunca clientes, a uno mismo, ni al ultimo administrador', () => {
    const notOp = decideDelete({ ...base, targetIsOperator: false })
    assert.ok(!notOp.allowed && notOp.code === 'not_operator')
    const self = decideDelete({ ...base, targetId: 'a' })
    assert.ok(!self.allowed && self.code === 'self')
    const last = decideDelete({ ...base, otherActiveManagers: 0 })
    assert.ok(!last.allowed && last.code === 'last_manager')
  })

  it('baja: con historial financiero o auditoria propia se bloquea', () => {
    for (const t of ['loan', 'payment', 'support_case', 'kyc_verification']) {
      const d = decideDelete({ ...base, historyCounts: { [t]: 1 } })
      assert.ok(!d.allowed && d.code === 'has_history' && d.message.includes(t), t)
    }
    const aud = decideDelete({ ...base, authoredAudit: 3 })
    assert.ok(!aud.allowed && aud.code === 'has_history')
  })
})
