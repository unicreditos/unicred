import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, it } from 'node:test'
import {
  _resetHealthForTests,
  RESET_MAIL_DOWN_WINDOW_MS,
  recordResetMailResult,
  resetMailLooksDown,
  resetMailSucceeded,
} from '../../lib/reset-mail-health'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Recuperar clave: exito solo si el correo salio (anti-enumeracion)', () => {
  beforeEach(() => _resetHealthForTests())

  it('exito solo si el proveedor confirmo (en produccion exige delivered)', () => {
    assert.equal(resetMailSucceeded({ ok: true, delivered: true }, true), true)
    assert.equal(resetMailSucceeded({ ok: true, delivered: false }, true), false)
    assert.equal(resetMailSucceeded({ ok: false, delivered: false, error: 'red' }, true), false)
    assert.equal(resetMailSucceeded(undefined, true), false)
    assert.equal(resetMailSucceeded({ ok: true, delivered: false }, false), true)
  })
  it('sin proveedor en produccion el servicio figura caido para todos', () => {
    assert.equal(resetMailLooksDown({ configured: false, production: true }), true)
    assert.equal(resetMailLooksDown({ configured: false, production: false }), false)
    assert.equal(resetMailLooksDown({ configured: true, production: true }), false)
  })
  it('un fallo abre el circuito 5 minutos y un exito lo cierra', () => {
    const t0 = 1_000_000
    recordResetMailResult(false, t0)
    assert.equal(resetMailLooksDown({ configured: true, production: true }, t0 + 1000), true)
    assert.equal(resetMailLooksDown({ configured: true, production: true }, t0 + RESET_MAIL_DOWN_WINDOW_MS + 1), false)
    recordResetMailResult(false, t0)
    recordResetMailResult(true, t0 + 10)
    assert.equal(resetMailLooksDown({ configured: true, production: true }, t0 + 20), false)
  })
  it('auth.ts y la ruta movil usan el circuito, reintentan y no lanzan por cuenta', () => {
    const a = src('lib/auth.ts')
    assert.match(a, /resetMailSucceeded\(result, production\)/)
    assert.match(a, /AUTH_RESET_EMAIL_FAILED/)
    assert.match(a, /SERVICE_UNAVAILABLE/)
    assert.match(a, /padToMinDuration/)
    const r = src('app/api/auth/forgot-password/route.ts')
    assert.match(r, /resetMailLooksDown/)
    assert.match(r, /status: 503/)
    assert.match(r, /padToMinDuration/)
  })
})