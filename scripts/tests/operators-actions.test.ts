import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('operadores: acciones del servidor', () => {
  const src = read('app/actions/operators.ts')

  it('exigen permiso users.manage y re-autenticacion antes de llamar al servicio', () => {
    assert.match(src, /requirePermission\('users\.manage'\)/)
    assert.match(src, /verifyCurrentPassword\(actorId/)
    assert.ok(src.indexOf('verifyCurrentPassword') < src.indexOf('fn(g.actorId'), 'el servicio corre despues de la puerta')
  })

  it('las cuatro acciones pasan por la misma puerta', () => {
    const calls = src.match(/return run\(input\.actorPassword/g) ?? []
    assert.equal(calls.length, 4)
  })

  it('el servicio no registra ni devuelve claves', () => {
    const svc = read('lib/operators/service.ts')
    assert.ok(!/console\.(log|info|error)/.test(svc))
    assert.ok(!/changes:[^\n]*newPassword/.test(svc))
  })
})