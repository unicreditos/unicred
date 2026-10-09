import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyAutoApproved, planRevert, planToCsv, type AutoApprovedRow } from '../../lib/auto-approval-revert'

const base: AutoApprovedRow = {
  loanId: 'l1', userId: 'u1', loanStatus: 'approved', principal: '100000', scoreAtApproval: 700,
  generatedBy: 'auto_score', contractId: 'c1', contractStatus: 'generated', acceptedAt: null,
  disbursementCount: 0, paidInstallments: 0, createdAt: null,
}

describe('Simulacion de reversion de auto-aprobados', () => {
  it('revierte solo aprobados por score sin firma, desembolso ni pagos', () => {
    assert.equal(classifyAutoApproved(base).action, 'revert')
    assert.equal(classifyAutoApproved({ ...base, generatedBy: 'mobile_auto' }).action, 'revert')
    assert.equal(classifyAutoApproved({ ...base, generatedBy: 'merchant_sale' }).action, 'revert')
  })
  it('no toca lo que aprobo una persona ni lo ya firmado/desembolsado/pagado/activo', () => {
    assert.equal(classifyAutoApproved({ ...base, generatedBy: 'admin_123' }).action, 'skip')
    assert.equal(classifyAutoApproved({ ...base, acceptedAt: '2026-09-01' }).action, 'skip')
    assert.equal(classifyAutoApproved({ ...base, disbursementCount: 1 }).action, 'skip')
    assert.equal(classifyAutoApproved({ ...base, paidInstallments: 2 }).action, 'skip')
    assert.equal(classifyAutoApproved({ ...base, loanStatus: 'active' }).action, 'skip')
  })
  it('cuenta y exporta CSV', () => {
    const plan = planRevert([base, { ...base, loanId: 'l2', acceptedAt: '2026-09-01' }])
    assert.equal(plan.total, 2)
    assert.equal(plan.toRevert, 1)
    assert.equal(plan.skipped, 1)
    assert.equal(plan.byGenerator.auto_score, 2)
    const csv = planToCsv(plan)
    assert.equal(csv.split('\n').length, 3)
    assert.match(csv, /^loanId,userId,accion/)
  })
  it('el script es dry-run por defecto y exige --apply --yes y base local', async () => {
    const { readFileSync } = await import('node:fs')
    const s = readFileSync(new URL('../revert-auto-approvals.ts', import.meta.url), 'utf8')
    assert.match(s, /assertSafeSeedTarget/)
    assert.match(s, /--apply requiere --yes/)
    assert.match(s, /Dry-run: no se modifico nada/)
    assert.match(s, /revert_backup/)
    assert.match(s, /LOAN_AUTO_APPROVAL_REVERTED/)
  })
})