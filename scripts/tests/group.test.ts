import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  BRAND,
  GROUP,
  groupOperatorLine,
  groupSiblingUnits,
} from '../../lib/brand'

describe('marca UNIPAGOS · RM International', () => {
  it('presenta UNICRÉDITOS como unidad de UNIPAGOS operada por la SAS, no por otro CUIT', () => {
    assert.equal(GROUP.name, 'RM International')
    assert.equal(GROUP.parentBrand, 'UNIPAGOS')
    assert.equal(GROUP.productLine, 'Una unidad de UNIPAGOS')
    assert.doesNotMatch(GROUP.name, /Emprenor/i)
    const line = groupOperatorLine()
    assert.match(line, /unidad de negocios de UNIPAGOS/)
    assert.match(line, /RM International Group S\.A\.S/)
    assert.match(line, /30-71603601-0/)
    assert.doesNotMatch(line, /Emprenor|20-40154622-8|Guerrero|Vespucio/)
    assert.equal(BRAND.address.includes('Maipú'), true)
  })

  it('lista UNIPAGOS como marca hermana y no se enlaza a sí mismo', () => {
    const siblings = groupSiblingUnits()
    const ids = siblings.map((unit) => unit.id)
    assert.deepEqual(ids, ['unipagos'])
    assert.ok(siblings.every((unit) => unit.href.startsWith('https://')))
    assert.ok(GROUP.units.every((unit) => !/emprenor|fixya|emitia/i.test(unit.id)))
    assert.equal(
      GROUP.units.some((unit) => unit.id === 'unicreditos' && 'current' in unit && unit.current),
      true,
    )
  })

  it('usa Plus Jakarta Sans y el verde de grupo, no Inter/Poppins', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')
    const layout = readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8')
    const dxLayout = readFileSync(new URL('../../app/directo/layout.tsx', import.meta.url), 'utf8')
    const home = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8')
    const hero = readFileSync(new URL('../../components/unicred/dashboard-kit.tsx', import.meta.url), 'utf8')
    assert.match(layout, /Plus_Jakarta_Sans/)
    assert.doesNotMatch(layout, /\bInter\b/)
    assert.doesNotMatch(layout, /Poppins/)
    assert.match(css, /--color-brand-primary: #20BD5A/)
    assert.doesNotMatch(css, /--color-brand-primary: #1E58E5/)
    assert.doesNotMatch(css, /--color-brand-cian: #22D3EE/)
    assert.doesNotMatch(dxLayout, /Fraunces|Karla/)
    assert.doesNotMatch(home, /PublicBcraTicker/)
    assert.doesNotMatch(hero, /Vista de ejemplo/)
  })
})
