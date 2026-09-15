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

  it('no usa naranja decorativo en auth ni cian de marketing en el chrome público', () => {
    const authReset = readFileSync(new URL('../../components/auth/reset-password-form.tsx', import.meta.url), 'utf8')
    const authForgot = readFileSync(new URL('../../components/auth/request-password-reset-form.tsx', import.meta.url), 'utf8')
    const chrome = readFileSync(new URL('../../components/unicred/public-chrome.tsx', import.meta.url), 'utf8')
    const home = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(authReset, /#F5A623|#FF5722/)
    assert.doesNotMatch(authForgot, /#F5A623|#FF5722/)
    assert.doesNotMatch(chrome, /brand-cian/)
    assert.doesNotMatch(home, /font-black/)
  })

  it('unifica producto: logo verde, sin naranja/cian/teal decorativo en app', () => {
    const kit = readFileSync(new URL('../../components/unicred/dashboard-kit.tsx', import.meta.url), 'utf8')
    const merchant = readFileSync(new URL('../../app/merchant/_client.tsx', import.meta.url), 'utf8')
    const adminContent = readFileSync(new URL('../../components/admin/admin-content.tsx', import.meta.url), 'utf8')
    const loansTable = readFileSync(new URL('../../components/admin/loans-table.tsx', import.meta.url), 'utf8')
    const errorFrame = readFileSync(new URL('../../components/unicred/public-error-frame.tsx', import.meta.url), 'utf8')
    const notFound = readFileSync(new URL('../../app/not-found.tsx', import.meta.url), 'utf8')
    assert.match(kit, /tone = 'brand'/)
    assert.match(kit, /#20BD5A/)
    assert.doesNotMatch(kit, /#FF5722/)
    assert.doesNotMatch(kit, /Impact/)
    assert.doesNotMatch(merchant, /brand-cian|font-black|#FF5722/)
    assert.doesNotMatch(adminContent, /teal-/)
    assert.doesNotMatch(loansTable, /teal-/)
    assert.match(errorFrame, /PublicHeader/)
    assert.match(notFound, /PublicErrorFrame/)
    const loanRequest = readFileSync(new URL('../../components/dashboard/loan-request.tsx', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../../components/unicred/workspace-shell.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(loanRequest, /bg-sidebar/)
    assert.match(shell, /export function EmptyState/)
  })
})
