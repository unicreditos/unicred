import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applicationPolicyFlags, ocrDniMatch, readKycEvidence } from '../../lib/admin-desk/evidence'
import { DEFAULT_RISK_RULES } from '../../lib/loan-underwriting'

describe('evidencia del legajo', () => {
  it('compara el DNI de la ficha con el leído', () => {
    assert.equal(ocrDniMatch('30.111.222', '30111222'), true)
    assert.equal(ocrDniMatch('30111222', '0111222'), true)
    assert.equal(ocrDniMatch('30111222', '40999888'), false)
    assert.equal(ocrDniMatch('123', '30111222'), null)
  })

  it('usa las capturas guardadas y no inventa biometría por el estado', () => {
    const evidence = readKycEvidence({
      dniFrontImageUrl: 'data:image/jpeg;base64,abc',
      dniBackImageUrl: null,
      selfieImageUrl: null,
      videoUrl: null,
      dniNumber: '30111222',
      cuilVerified: false,
      faceMatchScore: '91.5',
      profileDni: '30111222',
      ocrData: {
        didit: {
          decision: {
            status: 'Approved',
            id_verifications: [{ status: 'Approved', document_number: '30111222', full_name: 'ANA PEREZ' }],
            liveness_checks: [{ status: 'Approved' }],
          },
        },
      },
    })
    assert.equal(evidence.front, 'data:image/jpeg;base64,abc')
    assert.equal(evidence.back, null)
    assert.equal(evidence.ocrName, 'ANA PEREZ')
    assert.equal(evidence.liveness, true)
    assert.equal(evidence.documentMatch, true)
    assert.equal(evidence.faceMatchScore, 91.5)

    const approvedWithoutCapture = readKycEvidence({
      dniFrontImageUrl: null,
      profileDni: '30111222',
      ocrData: { status: 'approved' },
    })
    assert.equal(approvedWithoutCapture.front, null)
    assert.equal(approvedWithoutCapture.liveness, null)
    assert.equal(approvedWithoutCapture.documentMatch, null)
  })

  it('marca la política con los umbrales reales del motor', () => {
    const flags = applicationPolicyFlags({
      kycVerified: false,
      score: 500,
      amount: 450_000,
      income: 0,
      installment: 20_000,
      bcraSituation: 4,
      isFirstCredit: true,
      rules: DEFAULT_RISK_RULES,
    })
    assert.deepEqual(flags, ['kyc_incomplete', 'score_reject_zone', 'income_missing', 'high_ticket', 'bcra_irregular'])
  })
})
