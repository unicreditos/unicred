import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  hasReason, isStale, originacionKycBlockers, originacionKycMessage, reopenDecision, validateLoanEdit,
  type KycFacts, type ReopenFacts,
} from '../../lib/loan-admin-rules'

const reason = 'Corrección de datos del solicitante'
const base: ReopenFacts = { status: 'approved', disbursementsCredited: 0, paidInstallments: 0, contractAccepted: false }

describe('reabrir a pendiente', () => {
  it('exige motivo', () => {
    assert.equal(reopenDecision(base, { reason: 'corto' }).ok, false)
    assert.equal(hasReason(reason), true)
  })
  it('permite desde aprobado, rechazado y anulado', () => {
    for (const status of ['approved', 'rejected', 'cancelled']) assert.equal(reopenDecision({ ...base, status }, { reason }).ok, true)
  })
  it('no reabre vigentes, saldados ni con desembolso o pagos', () => {
    for (const status of ['active', 'paid']) assert.equal(reopenDecision({ ...base, status }, { reason }).ok, false)
    assert.equal(reopenDecision({ ...base, disbursementsCredited: 1 }, { reason }).ok, false)
    assert.equal(reopenDecision({ ...base, paidInstallments: 1 }, { reason }).ok, false)
  })
  it('contrato firmado pide confirmación adicional', () => {
    const r = reopenDecision({ ...base, contractAccepted: true }, { reason })
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.code, 'needs_confirmation')
    assert.equal(reopenDecision({ ...base, contractAccepted: true }, { reason, confirmSigned: true }).ok, true)
  })
  it('ya pendiente no se reabre', () => assert.equal(reopenDecision({ ...base, status: 'pending' }, { reason }).ok, false))
})

describe('editar condiciones', () => {
  const lim = { minAmount: 10000, maxAmount: 500000, minTerm: 3, maxTerm: 24 }
  const cur = { status: 'pending', principal: 100000, term: 12 }
  it('pendiente o calificado sin firma, con motivo y dentro de límites', () => {
    assert.equal(validateLoanEdit(cur, { amount: 150000 }, lim, reason).ok, true)
    assert.equal(validateLoanEdit({ ...cur, status: 'approved', contractAccepted: false }, { amount: 150000 }, lim, reason).ok, true)
    assert.equal(validateLoanEdit({ ...cur, status: 'approved', contractAccepted: true }, { amount: 150000 }, lim, reason).ok, false)
    assert.equal(validateLoanEdit({ ...cur, status: 'active' }, { amount: 150000 }, lim, reason).ok, false)
    assert.equal(validateLoanEdit(cur, { amount: 150000 }, lim, '').ok, false)
    assert.equal(validateLoanEdit(cur, { amount: 900000 }, lim, reason).ok, false)
    assert.equal(validateLoanEdit(cur, { installments: 36 }, lim, reason).ok, false)
    assert.equal(validateLoanEdit(cur, { installments: 12 }, lim, reason).ok, false)
  })
})

describe('bloqueo optimista', () => {
  it('detecta versión vieja', () => {
    const d = new Date('2026-10-09T10:00:00Z')
    assert.equal(isStale(d.toISOString(), d), false)
    assert.equal(isStale('2026-10-09T09:00:00Z', d), true)
    assert.equal(isStale(undefined, d), true)
  })
})

describe('KYC obligatorio al originar', () => {
  const ok: KycFacts = { diditApproved: true, profileKycStatus: 'approved', kycRecordStatus: 'approved', provider: 'didit', fresh: true, bcraConsent: true, arcaManualReview: false, arcaChecked: true }
  it('cliente completo pasa', () => assert.deepEqual(originacionKycBlockers(ok), []))
  it('sin Didit, sin BCRA o con ARCA en revisión bloquea con mensaje claro', () => {
    const b = originacionKycBlockers({ ...ok, diditApproved: false, kycRecordStatus: null, bcraConsent: false, arcaManualReview: true })
    assert.equal(b.length, 3)
    assert.match(originacionKycMessage(b), /obligatorio/)
  })
  it('vencido pide reverificar', () => {
    assert.match(originacionKycBlockers({ ...ok, diditApproved: false, fresh: false })[0], /venci/)
  })
})

describe('cableado', () => {
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
  const m = src('lib/admin-desk/mutate.ts')
  it('createApplication exige KYC en el servidor', () => {
    const i = m.indexOf("case 'createApplication'")
    assert.ok(i > 0 && m.slice(i, i + 1500).includes('originacionKycBlockers'))
  })
  it('reabrir y editar usan permiso credits.edit, motivo y bloqueo optimista', () => {
    assert.match(src('lib/admin-desk/permissions.ts'), /reopenApplication: 'credits\.edit'/)
    assert.match(src('lib/admin-desk/permissions.ts'), /editApplication: 'credits\.edit'/)
    assert.ok(m.includes('isStale(') && m.includes('reopenDecision(') && m.includes('validateLoanEdit('))
  })
  it('los cambios de estado y la edición avisan al mail del cliente', () => {
    const ops = src('lib/mobile/ops.ts')
    assert.match(ops, /notifyContractReady/)
    assert.match(ops, /notifyLoanRejected/)
    assert.match(m, /notifyLoanCancelled/)
    assert.match(m, /notifyLoanReopened/)
    assert.match(m, /notifyLoanConditions/)
    assert.match(m, /notifyDisbursementCredited/)
    assert.match(m, /notifyPaymentReceived/)
    assert.match(m, /notifyPaymentRejected/)
  })
  it('no hay aprobación automática en las acciones nuevas', () => {
    const i = m.indexOf("case 'reopenApplication'")
    assert.ok(!/status: 'approved'/.test(m.slice(i, m.indexOf("case 'createApplication'"))))
  })
})
