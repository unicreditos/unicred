import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { geoFromDireccionHit, streetForGeoref } from '../../lib/geo-ar'

describe('geo desde padrón ARCA', () => {
  it('limpia piso/depto para consultar Georef', () => {
    assert.equal(streetForGeoref('MAIPU 566 Piso:4 D'), 'MAIPU 566')
    assert.equal(streetForGeoref('SAN MARTIN 100 Dpto. 2'), 'SAN MARTIN 100')
  })

  it('CABA sin barrio: toma comuna y no usa la provincia como localidad', () => {
    const geo = geoFromDireccionHit({
      departamento: { nombre: 'Comuna 1' },
      localidad_censal: { nombre: 'Ciudad Autónoma de Buenos Aires' },
      provincia: { nombre: 'Ciudad Autónoma de Buenos Aires' },
    })
    assert.equal(geo.province, 'CABA')
    assert.equal(geo.department, 'Comuna 1')
    assert.equal(geo.city, '')
  })
})
