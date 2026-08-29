import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  adultBirthDateBounds,
  diditPersonExpectedDetails,
  isCompanyStyleName,
  isPlausibleAdultBirthDate,
  isSocietyLabelForDidit,
  plausiblePersonDni,
} from '../../lib/didit-expected'

describe('Didit verifica persona, no la sociedad', () => {
  it('detecta razón social con forma societaria', () => {
    assert.equal(isCompanyStyleName('S.R.L CRONEC'), true)
    assert.equal(isCompanyStyleName('CRONEC S.A.'), true)
    assert.equal(isCompanyStyleName('Acme SAS'), true)
    assert.equal(isCompanyStyleName('Angel Sebastian Romero'), false)
  })

  it('trata como sociedad si el nombre copia la razón social', () => {
    assert.equal(isSocietyLabelForDidit('CRONEC', 'CRONEC'), true)
    assert.equal(isSocietyLabelForDidit('Juan Perez', 'CRONEC S.R.L.'), false)
  })

  it('acepta DNI o CUIL de persona y rechaza CUIT de empresa', () => {
    assert.equal(plausiblePersonDni('30111222'), '30111222')
    assert.equal(plausiblePersonDni('20-30111222-3'), '30111222')
    assert.equal(plausiblePersonDni('33710900123'), undefined)
    assert.equal(plausiblePersonDni('30-71090012-3'), undefined)
  })

  it('no manda expected_details si el alta trae la SAS', () => {
    const details = diditPersonExpectedDetails({
      fullName: 'S.R.L CRONEC',
      dni: '33710900123',
      birthDate: '2026-08-25',
    })
    assert.equal(details, undefined)
  })

  it('omite nombre de empresa y deja DNI/fecha solo si son de persona', () => {
    const details = diditPersonExpectedDetails({
      fullName: 'S.R.L CRONEC',
      dni: '30111222',
      birthDate: '1990-04-12',
    })
    assert.ok(details)
    assert.equal(details?.first_name, undefined)
    assert.equal(details?.last_name, undefined)
    assert.equal(details?.identification_number, '30111222')
    assert.equal(details?.date_of_birth, '1990-04-12')
    assert.equal(details?.nationality, 'ARG')
  })

  it('arma nombre y DNI de una persona física', () => {
    const details = diditPersonExpectedDetails({
      fullName: 'Romero Angel Sebastian',
      dni: '27-30111222-4',
      birthDate: '1988-01-15',
    })
    assert.equal(details?.last_name, 'Romero')
    assert.equal(details?.first_name, 'Angel Sebastian')
    assert.equal(details?.identification_number, '30111222')
  })

  it('rechaza fecha de nacimiento futura o de hoy', () => {
    const now = new Date(2026, 7, 26)
    const { max } = adultBirthDateBounds(now)
    assert.equal(isPlausibleAdultBirthDate('2026-08-25', now), false)
    assert.equal(isPlausibleAdultBirthDate(max, now), true)
    assert.equal(isPlausibleAdultBirthDate('2000-01-01', now), true)
  })
})
