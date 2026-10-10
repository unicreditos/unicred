import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { canonicalJson, contractContentHash, sha256Hex, signatureRecordHash, type ContractSnapshotInput } from '../../lib/legal/contract-hash'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const snap: ContractSnapshotInput = {
  contractId: 'c1', loanId: 'l1', userId: 'u1', version: '2.0', templateName: 'prestamo_personal_ars',
  loan: { type: 'personal', principal: '100000.00', term: 12, monthlyRate: '5.000', tna: '60', tea: '79.59', cft: '90', installmentAmount: '11282.54', totalAmount: '135390.48' },
  signer: { name: 'Ana Perez', cuil: '27111111114' },
}

describe('Huella SHA-256 del contrato firmado', () => {
  it('sha256 conocido', () => {
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('canonicalJson no depende del orden de claves', () => {
    assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }))
  })
  it('mismo contenido => mismo hash; cualquier cambio de condiciones lo altera', () => {
    const h = contractContentHash(snap)
    assert.match(h, /^[0-9a-f]{64}$/)
    assert.equal(contractContentHash({ ...snap }), h)
    assert.equal(contractContentHash({ ...snap, loan: { ...snap.loan, principal: 100000 } }), h)
    assert.notEqual(contractContentHash({ ...snap, loan: { ...snap.loan, term: 24 } }), h)
    assert.notEqual(contractContentHash({ ...snap, signer: { ...snap.signer, cuil: '20111111112' } }), h)
  })
  it('el registro de firma ata hash, fecha, IP, agente y CUIL', () => {
    const contentHash = contractContentHash(snap)
    const base = { contentHash, acceptedAt: new Date('2026-10-09T12:00:00Z'), ip: '1.2.3.4', userAgent: 'UA', cuil: '27111111114', userId: 'u1', signatureType: 'clickwrap' }
    const a = signatureRecordHash(base)
    assert.equal(signatureRecordHash({ ...base }), a)
    assert.notEqual(signatureRecordHash({ ...base, ip: '9.9.9.9' }), a)
    assert.notEqual(signatureRecordHash({ ...base, userAgent: 'otro' }), a)
    assert.notEqual(signatureRecordHash({ ...base, cuil: '20111111112' }), a)
  })
  it('las dos vias de firma escriben contentHash y registro de firma', () => {
    for (const f of ['app/actions/documents.ts', 'lib/mobile/ops.ts']) {
      const s = src(f)
      assert.match(s, /contractContentHash\(/, f)
      assert.match(s, /signatureRecordHash\(/, f)
      assert.match(s, /signatureHash/, f)
    }
  })
  it('el pie legal no afirma firma digital', () => {
    assert.doesNotMatch(src('components/documents/document-frame.tsx'), /Firma digital conforme/)
    assert.match(src('components/documents/document-frame.tsx'), /Firma electr\u00f3nica conforme Ley 25\.506/)
    assert.doesNotMatch(src('components/documents/loan-contract-printable.tsx'), /clickwrap o firma digital/)
  })
})