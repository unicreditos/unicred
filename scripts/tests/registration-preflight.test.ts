import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { decidePreflight, namesMatch, withRetry } from '../../lib/registration-preflight-core'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const noSleep = (log: number[]) => async (ms: number) => { log.push(ms) }

describe('Alta: BCRA y ARCA antes de crear la cuenta', () => {
  it('reintenta 3 veces con espera creciente y luego falla', async () => {
    const waits: number[] = []
    let calls = 0
    const r = await withRetry(async () => { calls++; throw new Error('caido') }, { sleep: noSleep(waits) })
    assert.equal(r.ok, false)
    assert.equal(calls, 4)
    assert.deepEqual(waits, [300, 900, 2700])
  })
  it('si responde en un reintento, sigue', async () => {
    const waits: number[] = []
    let calls = 0
    const r = await withRetry(async () => ({ unavailable: ++calls < 3 }), { sleep: noSleep(waits), isFailure: (v) => v.unavailable })
    assert.equal(r.ok, true)
    assert.equal(r.attempts, 3)
    assert.deepEqual(waits, [300, 900])
  })
  it('comparacion de nombres: orden, tildes y segundo nombre', () => {
    assert.equal(namesMatch('PEREZ JUAN CARLOS', 'Juan Pérez'), 'match')
    assert.equal(namesMatch('GOMEZ MARIA', 'Maria Gomez'), 'match')
    assert.equal(namesMatch('GOMEZ MARIA', 'Maria Lopez'), 'mismatch')
    assert.equal(namesMatch('', 'Maria Lopez'), 'unknown')
  })
  it('sin BCRA o sin ARCA no se crea; nombre distinto va a revision manual', () => {
    const base = { bcra: { ok: true }, arca: { configured: true, found: true, name: 'GOMEZ MARIA', taxStatus: 'ACTIVO' }, declaredName: 'Maria Gomez', arcaRequired: true, bcraRequired: true }
    assert.deepEqual(decidePreflight(base), { allow: true, blockers: [], manualReview: null })
    assert.equal(decidePreflight({ ...base, bcra: { ok: false } }).allow, false)
    assert.equal(decidePreflight({ ...base, arca: { ...base.arca, configured: false } }).allow, false)
    assert.equal(decidePreflight({ ...base, arca: { ...base.arca, found: false } }).allow, false)
    assert.equal(decidePreflight({ ...base, arca: { ...base.arca, taxStatus: 'INACTIVO' } }).allow, false)
    const mm = decidePreflight({ ...base, declaredName: 'Ana Lopez' })
    assert.equal(mm.allow, true)
    assert.equal(mm.manualReview?.reason, 'arca_name_mismatch')
    assert.equal(decidePreflight({ ...base, arcaRequired: false, bcraRequired: false, bcra: { ok: false }, arca: { configured: false, found: false } }).allow, true)
  })
  it('completeRegistration corre el control antes de la primera escritura', () => {
    const s = src('app/actions/register.ts')
    const pre = s.indexOf('runRegistrationPreflight({')
    const firstWrite = s.indexOf('await db\n    .update(profile)')
    const firstWriteCrlf = s.indexOf('await db\r\n    .update(profile)')
    const w = firstWrite >= 0 ? firstWrite : firstWriteCrlf
    assert.ok(pre > 0 && w > pre)
    assert.match(s, /KYC_MANUAL_REVIEW_FLAGGED/)
  })
})