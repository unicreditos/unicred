import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { kycMediaBundle, parseDiditCapture } from '../../lib/didit-capture'

describe('captura Didit para el admin KYC', () => {
  it('arma frente, dorso y selfie desde la decisión', () => {
    const capture = parseDiditCapture({
      status: 'Approved',
      id_verifications: [
        {
          status: 'Approved',
          document_number: '30111222',
          full_name: 'ANA PEREZ',
          front_image: 'https://files.didit.me/front.jpg',
          back_image: 'https://files.didit.me/back.jpg',
        },
      ],
      liveness_checks: [{ status: 'Approved', reference_image: 'https://files.didit.me/selfie.jpg' }],
    })
    const media = kycMediaBundle(capture)
    assert.equal(media.front, 'https://files.didit.me/front.jpg')
    assert.equal(media.back, 'https://files.didit.me/back.jpg')
    assert.equal(media.selfie, 'https://files.didit.me/selfie.jpg')
    assert.equal(capture.ids[0]?.documentNumber, '30111222')
  })
})
