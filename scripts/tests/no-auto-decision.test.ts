import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  assertHumanDecision,
  manualDecisionOnly,
  recommendationOf,
  statusForDecision,
  type UnderwriteDecision,
} from '../../lib/loan-underwriting'

const rejected: UnderwriteDecision = { outcome: 'rejected', reason: 'x' }
const review: UnderwriteDecision = { outcome: 'pending_review', reason: 'x' }
const qualified: UnderwriteDecision = { outcome: 'qualified', reason: 'x' }
const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Decision manual: el score solo recomienda', () => {
  it('por defecto manda MANUAL_DECISION_ONLY (solo "no" lo apaga)', () => {
    assert.equal(manualDecisionOnly({}), true)
    assert.equal(manualDecisionOnly({ MANUAL_DECISION_ONLY: 'yes' }), true)
    assert.equal(manualDecisionOnly({ MANUAL_DECISION_ONLY: 'no' }), false)
  })
  it('cualquier resultado queda pending en modo manual', () => {
    for (const d of [rejected, review, qualified]) assert.equal(statusForDecision(d, true), 'pending')
  })
  it('con el interruptor apagado se conserva el comportamiento anterior', () => {
    assert.equal(statusForDecision(rejected, false), 'rejected')
    assert.equal(statusForDecision(review, false), 'pending')
    assert.equal(statusForDecision(qualified, false), 'approved')
  })
  it('traduce el resultado a recomendacion', () => {
    assert.equal(recommendationOf(rejected), 'reject')
    assert.equal(recommendationOf(review), 'review')
    assert.equal(recommendationOf(qualified), 'approve')
  })
  it('aprobar exige nota (>= 10) y recomendacion previa', () => {
    assert.throws(() => assertHumanDecision({ action: 'approve', note: '', scoreAtApproval: 700 }, true))
    assert.throws(() => assertHumanDecision({ action: 'approve', note: 'corta', scoreAtApproval: 700 }, true))
    assert.throws(() => assertHumanDecision({ action: 'approve', note: 'Ingresos verificados', scoreAtApproval: 0 }, true))
    assert.throws(() => assertHumanDecision({ action: 'approve', note: 'Ingresos verificados', scoreAtApproval: null }, true))
    assert.equal(assertHumanDecision({ action: 'approve', note: '  Ingresos verificados  ', scoreAtApproval: 700 }, true), 'Ingresos verificados')
  })
  it('rechazar exige nota pero no recomendacion', () => {
    assert.throws(() => assertHumanDecision({ action: 'reject', note: 'no' }, true))
    assert.doesNotThrow(() => assertHumanDecision({ action: 'reject', note: 'Documentacion inconsistente' }, true))
  })
  it('con el interruptor apagado no exige nota', () => {
    assert.doesNotThrow(() => assertHumanDecision({ action: 'approve', note: '', scoreAtApproval: 0 }, false))
  })
  it('los 4 puntos de solicitud usan statusForDecision y ninguno aprueba por outcome', () => {
    for (const f of ['app/actions/loans.ts', 'app/actions/merchant.ts', 'lib/mobile/ops.ts']) {
      const s = src(f)
      assert.match(s, /statusForDecision\(decision\)/, f)
      assert.doesNotMatch(s, /status = 'approved'/, f)
    }
  })
  it('las decisiones humanas validan nota en desk y API movil', () => {
    assert.match(src('lib/mobile/ops.ts'), /assertHumanDecision\(\{ action: 'approve'/)
    assert.match(src('lib/mobile/ops.ts'), /assertHumanDecision\(\{ action: 'reject'/)
    assert.doesNotMatch(src('lib/admin-desk/mutate.ts'), /Calificado desde mesa admin/)
  })
})