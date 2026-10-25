import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  evaluateKey6,
  hasKey6Complete,
  isStaffRole,
  key6Gate,
  key6InputFromDecision,
  key6InputFromStored,
  requiresKey6,
  STAFF_ROLES,
  type Key6Input,
} from '@/lib/key6'

const ok: Key6Input = { hasFront: true, hasBack: true, hasSelfie: true, livenessPassed: true, sessionApproved: true }

test('Key 6: las tres + prueba de vida + sesion aprobada => completo', () => {
  const r = evaluateKey6(ok)
  assert.equal(r.state, 'completo')
  assert.deepEqual(r.missing, [])
  assert.equal(hasKey6Complete(ok), true)
})

const cases: Array<[string, Partial<Key6Input>, string[]]> = [
  ['solo frente', { hasBack: false, hasSelfie: false, livenessPassed: false }, ['dni_back', 'selfie', 'liveness_passed']],
  ['solo dorso', { hasFront: false, hasSelfie: false, livenessPassed: false }, ['dni_front', 'selfie', 'liveness_passed']],
  ['solo selfie', { hasFront: false, hasBack: false }, ['dni_front', 'dni_back']],
  ['frente y dorso sin selfie', { hasSelfie: false, livenessPassed: false }, ['selfie', 'liveness_passed']],
  ['frente y selfie sin dorso', { hasBack: false }, ['dni_back']],
  ['dorso y selfie sin frente', { hasFront: false }, ['dni_front']],
  ['prueba de vida fallida', { livenessPassed: false }, ['liveness_passed']],
  ['sesion no aprobada', { sessionApproved: false }, ['session_approved']],
  ['nada', { hasFront: false, hasBack: false, hasSelfie: false, livenessPassed: false, sessionApproved: false }, ['dni_front', 'dni_back', 'selfie', 'liveness_passed', 'session_approved']],
]
for (const [name, patch, missing] of cases) {
  test(`Key 6 incompleto: ${name}`, () => {
    const r = evaluateKey6({ ...ok, ...patch })
    assert.equal(r.state, 'incompleto')
    assert.equal(r.complete, false)
    assert.deepEqual(r.missing, missing)
    assert.match(r.message, /Key 6 incompleta: falta /)
    assert.match(r.message, /No se abre la cuenta/)
    const g = key6Gate('customer', { ...ok, ...patch })
    assert.equal(g.allow, false)
  })
}

const img = 'https://x.test/a.jpg'
const decision = (over: Record<string, unknown> = {}) => ({
  session_id: 's1',
  status: 'Approved',
  id_verifications: [{ status: 'Approved', front_image: img, back_image: img }],
  liveness_checks: [{ status: 'Approved', reference_image: img }],
  ...over,
})

test('Key 6 desde la decision de Didit: completa', () => {
  assert.equal(hasKey6Complete(key6InputFromDecision(decision())), true)
})
test('Key 6 desde la decision: sin dorso', () => {
  const d = decision({ id_verifications: [{ status: 'Approved', front_image: img }] })
  assert.deepEqual(evaluateKey6(key6InputFromDecision(d)).missing, ['dni_back'])
})
test('Key 6 desde la decision: sin frente', () => {
  const d = decision({ id_verifications: [{ status: 'Approved', back_image: img }] })
  assert.deepEqual(evaluateKey6(key6InputFromDecision(d)).missing, ['dni_front'])
})
test('Key 6 desde la decision: sin selfie ni liveness', () => {
  const d = decision({ liveness_checks: [] })
  assert.deepEqual(evaluateKey6(key6InputFromDecision(d)).missing, ['selfie', 'liveness_passed'])
})
test('Key 6 desde la decision: liveness rechazada', () => {
  const d = decision({ liveness_checks: [{ status: 'Declined', reference_image: img }] })
  assert.deepEqual(evaluateKey6(key6InputFromDecision(d)).missing, ['liveness_passed'])
})
test('Key 6 desde la decision: sesion In Review no cuenta', () => {
  assert.deepEqual(evaluateKey6(key6InputFromDecision(decision({ status: 'In Review' }))).missing, ['session_approved'])
})
test('Key 6 sin decision: todo falta', () => {
  assert.equal(evaluateKey6(key6InputFromDecision(null)).missing.length, 5)
})

test('Key 6 guardada: evidencia en archivo suma capturas pero no reemplaza prueba de vida ni sesion', () => {
  const base = { decision: null, columns: {}, evidenceKinds: ['dni_front', 'dni_back', 'selfie'] }
  const r = evaluateKey6(key6InputFromStored(base))
  assert.deepEqual(r.missing, ['liveness_passed', 'session_approved'])
  const full = key6InputFromStored({ ...base, decision: decision() })
  assert.equal(hasKey6Complete(full), true)
})
test('Key 6 guardada: una sola captura en archivo => incompleto', () => {
  const r = evaluateKey6(key6InputFromStored({ decision: decision({ id_verifications: [], liveness_checks: [] }), columns: { dniFrontImageUrl: 'data:image/png;base64,AA' }, evidenceKinds: [] }))
  assert.deepEqual(r.missing, ['dni_back', 'selfie', 'liveness_passed'])
})

test('Separacion por rol: personal exento, clientes y desconocidos NO', () => {
  for (const r of STAFF_ROLES) {
    assert.equal(isStaffRole(r), true)
    const g = key6Gate(r, { hasFront: false, hasBack: false, hasSelfie: false, livenessPassed: false, sessionApproved: false })
    assert.equal(g.allow, true)
  }
  assert.equal(key6Gate(' Admin ', { hasFront: false, hasBack: false, hasSelfie: false, livenessPassed: false, sessionApproved: false }).allow, true)
  for (const r of ['customer', 'user', 'merchant', '', null, undefined, 'superadmin', 'admin2', 'ADMIN; customer']) {
    assert.equal(requiresKey6(r as string | null | undefined), true, String(r))
  }
  const none = { hasFront: false, hasBack: false, hasSelfie: false, livenessPassed: false, sessionApproved: false }
  assert.equal(key6Gate('customer', none).allow, false)
  assert.equal(key6Gate('customer', ok).allow, true)
})

test('Registro: el rol sale del servidor (accountType), nunca de un campo del cliente, y el personal no se re-registra', () => {
  const src = readFileSync('app/actions/register.ts', 'utf8')
  assert.match(src, /const signupRole = input\.accountType === 'comercio' \? 'merchant' : 'customer'/)
  assert.match(src, /const accountRole = input\.accountType === 'comercio' \? 'merchant' : 'customer'/)
  assert.equal(/input\.role\b/.test(src), false)
  assert.match(src, /isStaffRole\(currentProfile\?\.role\)/)
  assert.match(src, /key6Gate\(signupRole, key6Input\)/)
  // el gate corre antes de escribir el perfil
  assert.ok(src.indexOf('key6Gate(signupRole') < src.indexOf(".update(profile)"))
})

test('Puntos de aprobacion manual y alta exigen Key 6', () => {
  const mutate = readFileSync('lib/admin-desk/mutate.ts', 'utf8')
  assert.match(mutate, /assertKey6\(acc\.userId, 'admin_decideKyc'/)
  assert.match(mutate, /assertKey6\(clientId, 'admin_createApplication'/)
  assert.match(readFileSync('lib/mobile/ops.ts', 'utf8'), /assertKey6\(customerId, 'mobile_admin_kyc_approve'/)
  const didit = readFileSync('lib/didit.ts', 'utf8')
  assert.match(didit, /key6Gate\(role, key6InputFromDecision/)
  assert.match(didit, /loadKey6ForUser\(userId\)/)
})