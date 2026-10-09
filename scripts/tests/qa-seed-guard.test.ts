import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assertSafeSeedTarget, resolveQaPassword } from '../qa-seed-guard'

describe('Siembra QA: sin clave en el repo', () => {
  it('el script no contiene una clave literal ni la imprime', () => {
    const src = readFileSync(new URL('../qa-seed-audit-accounts.ts', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /const password = ['"`]/)
    assert.doesNotMatch(src, /Password para las 3 cuentas/)
    assert.doesNotMatch(src, /console\.log\([^)]*\bpassword\b/)
  })
  it('exige QA_SEED_PASSWORD o --generate y una longitud minima', () => {
    assert.throws(() => resolveQaPassword({}, []))
    assert.throws(() => resolveQaPassword({ QA_SEED_PASSWORD: 'corta' }, []))
    assert.equal(resolveQaPassword({ QA_SEED_PASSWORD: 'x'.repeat(16) }, []).generated, false)
    const g = resolveQaPassword({}, ['--generate'])
    assert.equal(g.generated, true)
    assert.ok(g.password.length >= 20)
  })
  it('bloquea produccion y bases remotas', () => {
    assert.throws(() => assertSafeSeedTarget({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@localhost/db' }))
    assert.throws(() => assertSafeSeedTarget({ DATABASE_URL: 'postgres://u:p@ep-x.neon.tech/db' }))
    assert.throws(() => assertSafeSeedTarget({ DATABASE_URL: 'postgres://u:p@ep-x.neon.tech/db', ALLOW_QA_SEED_REMOTE: 'yes', PROD_DB_HOSTS: 'ep-x' }))
    assert.doesNotThrow(() => assertSafeSeedTarget({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' }))
    assert.doesNotThrow(() => assertSafeSeedTarget({ DATABASE_URL: 'postgres://u:p@ep-dev.neon.tech/db', ALLOW_QA_SEED_REMOTE: 'yes' }))
  })
})