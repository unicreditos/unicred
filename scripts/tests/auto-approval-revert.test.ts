import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { classifyAutoApproved, maskId, planRevert, planToCsv, type AutoApprovedRow } from '../../lib/auto-approval-revert'

const base: AutoApprovedRow = {
  loanId: 'loan_abcdef123456', userId: 'u1', loanStatus: 'approved', principal: '100000', scoreAtApproval: 700,
  generatedBy: 'auto_score', contractId: 'c1', contractStatus: 'pending_acceptance', acceptedAt: null,
  disbursementCount: 0, paidInstallments: 0, installmentCount: 0, paymentCount: 0, createdAt: '2026-10-09T23:30:00Z',
}

describe('Reversion de auto-aprobados', () => {
  it('revierte solo aprobados por puntaje sin firma, desembolso, cuotas ni pagos', () => {
    for (const g of ['auto_score', 'mobile_auto', 'merchant_sale', 'online_consumo']) {
      assert.equal(classifyAutoApproved({ ...base, generatedBy: g }).action, 'revert')
    }
  })
  it('no toca lo que aprobo una persona ni lo operado', () => {
    assert.equal(classifyAutoApproved({ ...base, generatedBy: 'admin_123' }).code, 'human')
    assert.equal(classifyAutoApproved({ ...base, acceptedAt: '2026-09-01' }).code, 'signed')
    assert.equal(classifyAutoApproved({ ...base, disbursementCount: 1 }).code, 'disbursed')
    assert.equal(classifyAutoApproved({ ...base, paidInstallments: 2 }).code, 'paid_or_installments')
    assert.equal(classifyAutoApproved({ ...base, installmentCount: 6 }).code, 'paid_or_installments')
    assert.equal(classifyAutoApproved({ ...base, paymentCount: 1 }).code, 'paid_or_installments')
    for (const s of ['active', 'paid', 'cancelled', 'rejected', 'pending']) {
      assert.equal(classifyAutoApproved({ ...base, loanStatus: s }).code, 'not_approved')
    }
  })
  it('cuenta por estado y origen; el CSV va enmascarado', () => {
    const plan = planRevert([base, { ...base, loanId: 'x2', loanStatus: 'active' }, { ...base, loanId: 'h', generatedBy: 'adm' }])
    assert.equal(plan.total, 3)
    assert.equal(plan.autoTotal, 2)
    assert.equal(plan.toRevert, 1)
    assert.deepEqual(plan.byState, { approved: 1, active: 1 })
    const csv = planToCsv(plan)
    assert.equal(csv.split('\n').length, 3)
    assert.ok(!csv.includes('u1'))
    assert.ok(!csv.includes('abcdef123456'.slice(0, 3) + 'x') )
    assert.match(csv, /^credito,estado,fecha_ar/)
    assert.equal(maskId('loan_abcdef123456'), '\u2026123456')
  })
  it('la fecha del CSV usa el dia de Argentina, no UTC', () => {
    assert.match(planToCsv(planRevert([base])), /2026-10-09/)
  })
  it('el script es simulacion por defecto, solo lectura, y --apply exige confirmacion y respaldo', () => {
    const s = readFileSync(new URL('../revert-auto-approvals.ts', import.meta.url), 'utf8')
    assert.match(s, /BEGIN READ ONLY|readOnly\(/)
    assert.match(s, /--apply requiere/)
    assert.match(s, /return simulate\(\)/)
    assert.match(s, /LOAN_AUTO_APPROVAL_REVERTED/)
    assert.match(s, /BACKUP_TABLE/)
    assert.doesNotMatch(s, /DELETE FROM/)
    assert.doesNotMatch(s, /UPDATE (installment|payment|disbursement|loan_contract)/)
  })
})