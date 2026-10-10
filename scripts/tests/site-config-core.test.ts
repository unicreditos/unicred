import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  approvalBlocker,
  defaultPublicVisible,
  diffValues,
  isPubliclyVisible,
  publishBlocker,
  publishPermissionFor,
  stableStringify,
  valueHash,
} from '../../lib/site-config/core'
import { DEFINITION_LIST, getDefinition } from '../../lib/site-config/registry'
import { dbReadEnabled, resolveSetting } from '../../lib/site-config/read'
import { renderSiteConfigSql, SITE_CONFIG_SQL_FILE } from '../../lib/site-config/sql'
import { PERMISSIONS, DEFAULT_ROLES } from '../../lib/db/ensure-rbac'
import { LOAN_CATALOG } from '../../lib/loan-catalog'

const perms = (...p: string[]) => new Set(p)

describe('site-config: registro', () => {
  it('los valores por defecto cumplen su propio esquema', () => {
    for (const d of DEFINITION_LIST) {
      const r = d.schema.safeParse(d.defaults)
      assert.ok(r.success, `${d.key}: ${r.success ? '' : JSON.stringify(r.error.issues)}`)
    }
  })
  it('las claves son únicas y comisiones/tasas/CFT/legales son sensibles', () => {
    const keys = DEFINITION_LIST.map((d) => d.key)
    assert.equal(new Set(keys).size, keys.length)
    for (const d of DEFINITION_LIST) {
      if (d.key.startsWith('pricing.') || d.key.startsWith('legal.') || d.key === 'params.income_dti_ratio') assert.notEqual(d.sensitivity, 'normal', d.key)
    }
    assert.equal(getDefinition('home.hero_subtitle')?.sensitivity, 'normal')
  })
  it('el catálogo por defecto reproduce el catálogo del código', () => {
    const d = getDefinition('pricing.products')!.defaults as { products: Array<{ type: string; monthlyRate: number }> }
    assert.deepEqual(
      d.products.map((p) => [p.type, p.monthlyRate]),
      LOAN_CATALOG.map((p) => [p.type, p.monthlyRate]),
    )
  })
  it('valida rangos: tasa fuera de rango, mínimo > máximo y producto repetido', () => {
    const d = getDefinition('pricing.products')!
    const base = structuredClone(d.defaults) as { products: Array<Record<string, number | string>> }
    const bad = structuredClone(base)
    bad.products[0].monthlyRate = 99
    assert.equal(d.schema.safeParse(bad).success, false)
    const bad2 = structuredClone(base)
    bad2.products[0].minAmount = 9_999_999
    assert.equal(d.schema.safeParse(bad2).success, false)
    const bad3 = structuredClone(base)
    bad3.products[1].type = 'personal'
    assert.equal(d.schema.safeParse(bad3).success, false)
    assert.equal(getDefinition('home.hero_subtitle')!.schema.safeParse({ text: 'corto' }).success, false)
  })
  it('permisos nuevos existen y gerente no puede publicar', () => {
    const keys = PERMISSIONS.map((p) => p.key as string)
    for (const k of ['content.edit', 'content.publish', 'pricing.publish']) assert.ok(keys.includes(k))
    const gerente = DEFAULT_ROLES.find((r) => r.key === 'gerente')!
    assert.ok(gerente.permissions.includes('content.edit'))
    assert.ok(!gerente.permissions.includes('content.publish'))
    assert.ok(!gerente.permissions.includes('pricing.publish'))
    const superA = DEFAULT_ROLES.find((r) => r.key === 'super_admin')!
    assert.ok(superA.permissions.includes('pricing.publish'))
  })
})

describe('site-config: doble control y permisos', () => {
  const v = (status: 'draft' | 'in_review' | 'approved', extra = {}) => ({ status, authorId: 'a1', lastEditorId: 'a1', approvedById: null as string | null, ...extra })
  it('permiso de publicación según sensibilidad', () => {
    assert.equal(publishPermissionFor('pricing'), 'pricing.publish')
    assert.equal(publishPermissionFor('legal'), 'content.publish')
    assert.equal(publishPermissionFor('normal'), 'content.publish')
  })
  it('el autor no puede aprobar su propio cambio sensible, aunque tenga el permiso', () => {
    const msg = approvalBlocker('pricing', v('in_review'), { userId: 'a1', perms: perms('pricing.publish') })
    assert.match(String(msg), /Doble control/)
  })
  it('quien editó por última vez tampoco puede aprobar', () => {
    const msg = approvalBlocker('legal', v('in_review', { lastEditorId: 'a3' }), { userId: 'a3', perms: perms('content.publish') })
    assert.match(String(msg), /Doble control/)
  })
  it('otro administrador con el permiso correcto sí aprueba; sin permiso no', () => {
    assert.equal(approvalBlocker('pricing', v('in_review'), { userId: 'a2', perms: perms('pricing.publish') }), null)
    assert.match(String(approvalBlocker('pricing', v('in_review'), { userId: 'a2', perms: perms('content.publish') })), /pricing\.publish/)
  })
  it('claves sensibles no se publican sin aprobación de otra persona', () => {
    assert.match(String(publishBlocker('pricing', v('in_review'), { userId: 'a2', perms: perms('pricing.publish') })), /segundo administrador/)
    assert.match(String(publishBlocker('pricing', v('approved', { approvedById: 'a1' }), { userId: 'a1', perms: perms('pricing.publish') })), /Doble control/)
    assert.equal(publishBlocker('pricing', v('approved', { approvedById: 'a2' }), { userId: 'a1', perms: perms('pricing.publish') }), null)
  })
  it('claves normales se publican desde revisión sin segundo administrador, pero no desde borrador', () => {
    assert.equal(publishBlocker('normal', v('in_review'), { userId: 'a1', perms: perms('content.publish') }), null)
    assert.match(String(publishBlocker('normal', v('draft'), { userId: 'a1', perms: perms('content.publish') })), /revisión/)
  })
})

describe('site-config: visibilidad pública y lectura', () => {
  it('las claves sensibles nunca son visibles por defecto', () => {
    assert.equal(defaultPublicVisible('pricing'), false)
    assert.equal(defaultPublicVisible('legal'), false)
    assert.equal(defaultPublicVisible('normal'), true)
  })
  it('una versión publicada sensible sin la marca no es pública', () => {
    assert.equal(isPubliclyVisible('pricing', { status: 'published', publicVisible: false }), false)
    assert.equal(isPubliclyVisible('pricing', { status: 'published', publicVisible: true }), true)
    assert.equal(isPubliclyVisible('pricing', { status: 'approved', publicVisible: true }), false)
    assert.equal(isPubliclyVisible('normal', { status: 'published', publicVisible: false }), true)
  })
  it('sin valor en la base se usa el código', () => {
    const r = resolveSetting('home.hero_subtitle', null)
    assert.equal(r.source, 'default')
    assert.deepEqual(r.value, getDefinition('home.hero_subtitle')!.defaults)
  })
  it('un valor sensible publicado pero sin la marca pública cae al código', () => {
    const row = { version: 3, value: { originationFeePct: 5, insurancePct: 0, punitiveRateMonthlyPct: 0 }, publicVisible: false, publishedAt: null }
    assert.equal(resolveSetting('pricing.charges', row).source, 'default')
    assert.equal(resolveSetting('pricing.charges', { ...row, publicVisible: true }).source, 'published')
  })
  it('un texto normal publicado reemplaza al del código; uno inválido se ignora', () => {
    const ok = resolveSetting<{ text: string }>('home.hero_subtitle', { version: 2, value: { text: 'Un subtítulo nuevo y suficientemente largo.' }, publicVisible: true, publishedAt: null })
    assert.equal(ok.source, 'published')
    assert.equal(ok.value.text, 'Un subtítulo nuevo y suficientemente largo.')
    const bad = resolveSetting('home.hero_subtitle', { version: 2, value: { text: 1 }, publicVisible: true, publishedAt: null })
    assert.equal(bad.source, 'default')
  })
  it('interruptor de emergencia', () => {
    assert.equal(dbReadEnabled({}), true)
    assert.equal(dbReadEnabled({ SITE_CONFIG_DB_READ: 'off' }), false)
  })
})

describe('site-config: diff y huella', () => {
  it('detecta cambios, altas y bajas campo por campo', () => {
    const rows = diffValues({ a: 1, b: { c: 'x' }, l: [1, 2] }, { a: 2, b: { c: 'x' }, l: [1], n: true })
    const by = Object.fromEntries(rows.map((r) => [r.path, r.kind]))
    assert.deepEqual(by, { a: 'changed', 'l[2]': 'removed', n: 'added' })
    assert.deepEqual(diffValues({ a: 1 }, { a: 1 }), [])
  })
  it('la huella no depende del orden de las claves', () => {
    assert.equal(valueHash({ a: 1, b: [1, { c: 2, d: 3 }] }), valueHash({ b: [1, { d: 3, c: 2 }], a: 1 }))
    assert.notEqual(valueHash({ a: 1 }), valueHash({ a: 2 }))
    assert.equal(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}')
  })
})

describe('site-config: SQL manual', () => {
  it('el archivo SQL coincide con el DDL del código', () => {
    // Git en Windows (core.autocrlf) entrega el archivo con CRLF.
    const file = readFileSync(new URL(`../../${SITE_CONFIG_SQL_FILE}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    assert.equal(file, renderSiteConfigSql())
  })
  it('es aditivo: no borra ni altera tablas existentes', () => {
    const file = renderSiteConfigSql()
    assert.ok(!/\bDROP TABLE\b/i.test(file))
    assert.ok(!/\bALTER TABLE\b/i.test(file))
  })
})
