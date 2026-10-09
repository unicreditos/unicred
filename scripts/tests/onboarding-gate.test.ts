import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { gateDecision, gateMode, isKycFresh, kycMaxAgeMonths } from '../../lib/kyc-validity'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Didit aprobado y vigente antes de operar', () => {
  const now = new Date('2026-10-09T12:00:00Z')
  it('vigencia de 12 meses por defecto', () => {
    assert.equal(kycMaxAgeMonths({}), 12)
    assert.equal(kycMaxAgeMonths({ KYC_MAX_AGE_MONTHS: '6' }), 6)
    assert.equal(kycMaxAgeMonths({ KYC_MAX_AGE_MONTHS: 'abc' }), 12)
  })
  it('vence a los 12 meses y exige reverificar', () => {
    assert.equal(isKycFresh({ reviewedAt: new Date('2026-01-01T00:00:00Z') }, now, 12), true)
    assert.equal(isKycFresh({ reviewedAt: new Date('2025-10-01T00:00:00Z') }, now, 12), false)
    assert.equal(isKycFresh({ updatedAt: new Date('2025-10-09T11:00:00Z') }, now, 12), false)
    assert.equal(isKycFresh({ reviewedAt: new Date('2025-10-10T00:00:00Z') }, now, 12), true)
  })
  it('expiresAt vencido invalida aunque la revision sea reciente', () => {
    assert.equal(isKycFresh({ reviewedAt: new Date('2026-09-01T00:00:00Z'), expiresAt: new Date('2026-10-01T00:00:00Z') }, now, 12), false)
  })
  it('modo del gate: enforce por defecto, warn y off configurables', () => {
    assert.equal(gateMode({}), 'enforce')
    assert.equal(gateMode({ ONBOARDING_GATE: 'warn' }), 'warn')
    assert.equal(gateMode({ ONBOARDING_GATE: 'off' }), 'off')
    assert.equal(gateMode({ ONBOARDING_GATE: 'cualquier-cosa' }), 'enforce')
  })
  it('matriz modo x identidad aprobada', () => {
    assert.equal(gateDecision('enforce', true), 'allow')
    assert.equal(gateDecision('enforce', false), 'block')
    assert.equal(gateDecision('warn', false), 'warn')
    assert.equal(gateDecision('off', false), 'allow')
  })
  it('el gate esta cableado en transferencias, retiros y alta de cuentas; diditApprovedForUser aplica vigencia', () => {
    const w = src('lib/payments/wallet.ts')
    assert.match(w, /assertVerifiedCustomer\(fromUserId, 'wallet'\)/)
    assert.match(w, /assertVerifiedCustomer\(userId, 'wallet'\)/)
    assert.match(src('app/actions/banking.ts'), /assertVerifiedCustomer\(userId, 'bank'\)/)
    assert.match(src('lib/didit.ts'), /isKycFresh\(/)
    assert.match(src('app/actions/loans.ts'), /diditApprovedForUser\(userId\)/)
  })
  it('vercel.json programa reconcile-kyc', () => {
    assert.match(src('vercel.json'), /\/api\/cron\/reconcile-kyc/)
  })
})