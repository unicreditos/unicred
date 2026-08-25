import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapArcaPersona, mergeArcaPersona } from '../../lib/arca/padron'
import { snapshotFromPersona, parseConstanciaSnapshot } from '../../lib/arca/constancia-snapshot'
import {
  classifyTaxCondition,
  collectTaxes,
  dniFromPersonCuit,
  isAllowedMerchantTaxCondition,
  personTypeFromCuit,
} from '../../lib/arca/tax-condition'
import {
  evaluateMerchantKyb,
  matchTitularToCuit,
  requiredMerchantDocuments,
  validateMerchantUpload,
} from '../../lib/merchant-kyb'

const PF_CUIT = '20123456786'
const PJ_CUIT = '30716036010'
const PF_DNI = '12345678'

const monotributoPf = {
  datosGenerales: {
    idPersona: PF_CUIT,
    tipoPersona: 'FISICA',
    apellido: 'PEREZ',
    nombre: 'JUAN',
    estadoClave: 'ACTIVO',
    numeroDocumento: PF_DNI,
    domicilioFiscal: {
      direccion: 'SAN MARTIN 100',
      localidad: 'ROSARIO',
      idProvincia: '12',
      codPostal: '2000',
    },
  },
  datosMonotributo: {
    categoriaMonotributo: { descripcionCategoria: 'H', idImpuesto: 20 },
    actividadMonotributista: { idActividad: '471190', descripcionActividad: 'COMERCIO MINORISTA' },
  },
}

const riPf = {
  datosGenerales: {
    idPersona: PF_CUIT,
    tipoPersona: 'FISICA',
    apellido: 'LOPEZ',
    nombre: 'ANA',
    estadoClave: 'ACTIVO',
    numeroDocumento: PF_DNI,
  },
  datosRegimenGeneral: {
    impuesto: [{ idImpuesto: 30, descripcionImpuesto: 'IVA' }],
  },
}

const exentoPf = {
  datosGenerales: {
    idPersona: PF_CUIT,
    tipoPersona: 'FISICA',
    apellido: 'GARCIA',
    nombre: 'LUIS',
    estadoClave: 'ACTIVO',
    numeroDocumento: PF_DNI,
  },
  datosRegimenGeneral: {
    impuesto: [{ idImpuesto: 32, descripcionImpuesto: 'IVA EXENTO' }],
  },
}

const riPj = {
  datosGenerales: {
    idPersona: PJ_CUIT,
    tipoPersona: 'JURIDICA',
    razonSocial: 'RM INTERNATIONAL GROUP S.A.S.',
    estadoClave: 'ACTIVO',
    domicilioFiscal: {
      direccion: 'MAIPU 566',
      localidad: 'CABA',
      idProvincia: '0',
      codPostal: '1006',
    },
  },
  datosRegimenGeneral: {
    impuesto: [
      { idImpuesto: 30, descripcionImpuesto: 'IVA' },
      { idImpuesto: 10, descripcionImpuesto: 'GANANCIAS SOCIEDADES' },
    ],
    actividad: [{ idActividad: '649999', descripcionActividad: 'SERVICIOS FINANCIEROS' }],
  },
}

const inactive = {
  datosGenerales: {
    idPersona: PF_CUIT,
    tipoPersona: 'FISICA',
    apellido: 'BAJA',
    nombre: 'CLAVE',
    estadoClave: 'INACTIVO',
    numeroDocumento: PF_DNI,
  },
}

const noAlcanzado = {
  datosGenerales: {
    idPersona: PF_CUIT,
    tipoPersona: 'FISICA',
    apellido: 'SIN',
    nombre: 'IVA',
    estadoClave: 'ACTIVO',
    numeroDocumento: PF_DNI,
  },
}

describe('padrón ARCA: condición fiscal', () => {
  it('clasifica monotributo, RI y exento', () => {
    assert.equal(mapArcaPersona(monotributoPf, 'a5')?.taxCondition, 'monotributo')
    assert.equal(mapArcaPersona(riPf, 'a5')?.taxCondition, 'responsable_inscripto')
    assert.equal(mapArcaPersona(exentoPf, 'a5')?.taxCondition, 'exento')
    assert.equal(mapArcaPersona(riPj, 'a5')?.taxCondition, 'responsable_inscripto')
    assert.equal(mapArcaPersona(noAlcanzado, 'a5')?.taxCondition, 'no_alcanzado')
    assert.equal(mapArcaPersona(inactive, 'a5')?.taxCondition, 'no_inscripto')
  })

  it('lee categoría, impuestos y domicilio del A5', () => {
    const mapped = mapArcaPersona(monotributoPf, 'a5')
    assert.equal(mapped?.name, 'PEREZ, JUAN')
    assert.equal(mapped?.personType, 'FISICA')
    assert.equal(mapped?.monotributoCategory, 'H')
    assert.equal(mapped?.city, 'ROSARIO')
    assert.equal(mapped?.province, 'Santa Fe')
    assert.ok(mapped?.activities.some((a) => a.id === '471190'))
  })

  it('no pierde el regimen general si el SOAP trae personaReturn', () => {
    const mapped = mapArcaPersona({ personaReturn: riPj }, 'a5')
    assert.equal(mapped?.personType, 'JURIDICA')
    assert.equal(mapped?.name, 'RM INTERNATIONAL GROUP S.A.S.')
    assert.equal(mapped?.address, 'MAIPU 566')
    assert.equal(collectTaxes(riPj).length, 2)
  })

  it('desenvuelve nodos SOAP ($value / array) de persona jurídica', () => {
    const mapped = mapArcaPersona(
      {
        personaReturn: {
          datosGenerales: [
            {
              idPersona: { $value: '33710900979' },
              tipoPersona: { $value: 'JURIDICA' },
              razonSocial: { $value: 'CRONEC S.R.L' },
              estadoClave: { $value: 'ACTIVO' },
              domicilioFiscal: {
                direccion: { $value: 'PJE. SOLDADO SALAZAR 196' },
                localidad: { $value: 'SALTA' },
                idProvincia: { $value: '9' },
                codPostal: { $value: '4400' },
              },
            },
          ],
          datosRegimenGeneral: { impuesto: [{ idImpuesto: 30, descripcionImpuesto: 'IVA' }] },
        },
      },
      'a5',
    )
    assert.equal(mapped?.name, 'CRONEC S.R.L')
    assert.equal(mapped?.address, 'PJE. SOLDADO SALAZAR 196')
    assert.equal(mapped?.city, 'SALTA')
    assert.equal(mapped?.province, 'Salta')
    assert.equal(mapped?.postalCode, '4400')
    assert.equal(mapped?.taxCondition, 'responsable_inscripto')
  })

  it('arma el snapshot de constancia para la ficha', () => {
    const mapped = mapArcaPersona(riPj, 'a5')
    assert.ok(mapped)
    const snap = snapshotFromPersona(mapped)
    assert.equal(snap.cuil, PJ_CUIT)
    assert.equal(snap.name, 'RM INTERNATIONAL GROUP S.A.S.')
    assert.equal(snap.taxConditionLabel, 'IVA Responsable Inscripto')
    assert.equal(parseConstanciaSnapshot(snap)?.address, 'MAIPU 566')
  })

  it('mapea errorConstancia de CUIT limitada y conserva el id', () => {
    const mapped = mapArcaPersona(
      {
        personaReturn: {
          errorConstancia: {
            error: [
              'La CUIT del contribuyente fue limitada en los términos de la RG AFIP 3832/16. Motivo: CUIT LIMITADA - Incluido en Base Contribuyentes NO Confiable.',
              'La CUIT fue cancelada de acuerdo a: CUIT LIMITADA - Incluido en Base Contribuyentes NO Confiable.',
            ],
            idPersona: 30716036010,
          },
        },
      },
      'a5',
    )
    assert.equal(mapped?.cuil, PJ_CUIT)
    assert.equal(mapped?.name, '')
    assert.equal(mapped?.personType, 'JURIDICA')
    assert.equal(mapped?.taxStatus, 'LIMITADA')
    assert.equal(mapped?.taxCondition, 'no_inscripto')
    assert.ok(mapped?.constanciaErrors[0]?.includes('RG AFIP 3832/16'))
  })

  it('combina constancia limitada A5 con razón social y domicilio A13', () => {
    const a5 = mapArcaPersona(
      {
        personaReturn: {
          errorConstancia: {
            error: ['CUIT LIMITADA - Incluido en Base Contribuyentes NO Confiable.'],
            idPersona: PJ_CUIT,
          },
        },
      },
      'a5',
    )
    const a13 = mapArcaPersona(
      {
        personaReturn: {
          persona: {
            idPersona: Number(PJ_CUIT),
            tipoPersona: 'JURIDICA',
            razonSocial: 'RM INTERNATIONAL GROUP S.A.S.',
            estadoClave: 'INACTIVO',
            domicilio: [
              {
                tipoDomicilio: 'FISCAL',
                direccion: 'MAIPU 566 Piso:4 D',
                codigoPostal: '1006',
                idProvincia: 0,
                descripcionProvincia: 'CIUDAD AUTONOMA BUENOS AIRES',
              },
            ],
          },
        },
      },
      'a13',
    )
    assert.equal(a13?.name, 'RM INTERNATIONAL GROUP S.A.S.')
    assert.equal(a13?.address, 'MAIPU 566 Piso:4 D')
    assert.equal(a13?.province, 'CABA')
    assert.equal(a13?.postalCode, '1006')
    assert.equal(a13?.city, '')
    assert.ok(a5 && a13)
    const merged = mergeArcaPersona(a5, a13)
    assert.equal(merged.name, 'RM INTERNATIONAL GROUP S.A.S.')
    assert.equal(merged.address, 'MAIPU 566 Piso:4 D')
    assert.equal(merged.taxStatus, 'INACTIVO')
    assert.equal(merged.constanciaErrors.length, 1)
    assert.match(merged.constanciaErrors[0], /NO Confiable/)
  })

  it('CUIT 20 es física y 30 jurídica', () => {
    assert.equal(personTypeFromCuit(PF_CUIT), 'FISICA')
    assert.equal(personTypeFromCuit(PJ_CUIT), 'JURIDICA')
    assert.equal(dniFromPersonCuit(PF_CUIT), PF_DNI)
    assert.equal(dniFromPersonCuit(PJ_CUIT), null)
  })

  it('solo monotributo, RI y exento pueden adherir', () => {
    assert.equal(isAllowedMerchantTaxCondition('monotributo'), true)
    assert.equal(isAllowedMerchantTaxCondition('no_alcanzado'), false)
    assert.equal(classifyTaxCondition({ keyStatus: 'ACTIVO', taxes: [] }), 'no_alcanzado')
  })
})

describe('KYB de comercio', () => {
  const titularOk = { diditApproved: true, dni: PF_DNI, cuil: PF_CUIT }

  it('rechaza CUIT inválido y padrón ausente', () => {
    const bad = evaluateMerchantKyb({
      declaredCuit: '20123456780',
      padron: null,
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(bad.canPersist, false)
    assert.match(bad.blockers[0], /dígito verificador/)

    const missing = evaluateMerchantKyb({
      declaredCuit: PF_CUIT,
      padron: null,
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(missing.canPersist, false)
    assert.match(missing.blockers.join(' '), /no devolvió/)
  })

  it('monotributista persona física con Didit coincidente queda listo', () => {
    const padron = mapArcaPersona(monotributoPf, 'a5')
    const result = evaluateMerchantKyb({
      declaredCuit: PF_CUIT,
      padron,
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(result.canSubmit, true)
    assert.equal(result.canActivate, true)
    assert.equal(result.titularMatch, 'matched')
    assert.equal(result.requiredDocuments.length, 0)
    assert.equal(result.kybStatus, 'ready_for_review')
  })

  it('RI y exento persona física también cierran sin estatuto', () => {
    for (const raw of [riPf, exentoPf]) {
      const result = evaluateMerchantKyb({
        declaredCuit: PF_CUIT,
        padron: mapArcaPersona(raw, 'a5'),
        padronConfigured: true,
        titular: titularOk,
        representativeRole: 'titular',
        uploadedDocTypes: [],
      })
      assert.equal(result.canSubmit, true, result.taxCondition)
      assert.equal(result.requiredDocuments.length, 0)
    }
  })

  it('bloquea clave inactiva, no alcanzado y Didit faltante', () => {
    const down = evaluateMerchantKyb({
      declaredCuit: PF_CUIT,
      padron: mapArcaPersona(inactive, 'a5'),
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(down.canPersist, false)

    const na = evaluateMerchantKyb({
      declaredCuit: PF_CUIT,
      padron: mapArcaPersona(noAlcanzado, 'a5'),
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(na.canPersist, false)
    assert.match(na.blockers.join(' '), /no habilita/)

    const noDidit = evaluateMerchantKyb({
      declaredCuit: PF_CUIT,
      padron: mapArcaPersona(monotributoPf, 'a5'),
      padronConfigured: true,
      titular: { diditApproved: false, dni: PF_DNI, cuil: PF_CUIT },
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(noDidit.canPersist, false)
  })

  it('persona física: el DNI de Didit tiene que ser el del CUIT', () => {
    assert.equal(
      matchTitularToCuit({
        personType: 'FISICA',
        cuit: PF_CUIT,
        padronDni: PF_DNI,
        titularDni: '99999999',
        titularCuil: '20333333339',
      }),
      'mismatch',
    )
    const result = evaluateMerchantKyb({
      declaredCuit: PF_CUIT,
      padron: mapArcaPersona(monotributoPf, 'a5'),
      padronConfigured: true,
      titular: { diditApproved: true, dni: '99999999', cuil: '27222222223' },
      representativeRole: 'titular',
      uploadedDocTypes: [],
    })
    assert.equal(result.titularMatch, 'mismatch')
    assert.equal(result.canPersist, false)
  })

  it('persona jurídica pide estatuto + acta, o poder si es apoderado', () => {
    assert.deepEqual(requiredMerchantDocuments('JURIDICA', 'presidente'), [
      'estatuto_contrato_social',
      'acta_designacion',
    ])
    assert.deepEqual(requiredMerchantDocuments('JURIDICA', 'apoderado'), [
      'estatuto_contrato_social',
      'poder',
    ])
    const padron = mapArcaPersona(riPj, 'a5')
    const incomplete = evaluateMerchantKyb({
      declaredCuit: PJ_CUIT,
      padron,
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'presidente',
      uploadedDocTypes: [],
    })
    assert.equal(incomplete.canPersist, true)
    assert.equal(incomplete.canSubmit, false)
    assert.equal(incomplete.titularMatch, 'pending_pj')
    assert.ok(incomplete.missingDocuments.includes('estatuto_contrato_social'))

    const ready = evaluateMerchantKyb({
      declaredCuit: PJ_CUIT,
      padron,
      padronConfigured: true,
      titular: titularOk,
      representativeRole: 'presidente',
      uploadedDocTypes: ['estatuto_contrato_social', 'acta_designacion'],
    })
    assert.equal(ready.canSubmit, true)
    assert.equal(ready.canActivate, true)
    assert.equal(ready.legalName, 'RM INTERNATIONAL GROUP S.A.S.')
  })

  it('valida archivos del expediente', () => {
    assert.equal(validateMerchantUpload({ type: 'estatuto_contrato_social', mime: 'application/pdf', size: 2048 }).ok, true)
    assert.equal(validateMerchantUpload({ type: 'estatuto_contrato_social', mime: 'text/plain', size: 2048 }).ok, false)
    assert.equal(validateMerchantUpload({ type: 'estatuto_contrato_social', mime: 'application/pdf', size: 10 }).ok, false)
    assert.equal(validateMerchantUpload({ type: 'foto_dni', mime: 'application/pdf', size: 2048 }).ok, false)
  })
})
