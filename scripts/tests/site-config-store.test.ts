import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'

/**
 * Contra una base LOCAL (se saltea si DATABASE_URL no es 127.0.0.1/localhost): flujo borrador → revisión →
 * aprobación → publicación, doble control, historial inmutable, vuelta atrás y lectura pública.
 */
const url = process.env.DATABASE_URL ?? ''
let host = ''
try {
  host = new URL(url).hostname
} catch {
  /* sin URL */
}
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(host)

type Store = typeof import('../../lib/site-config/store')
const perm = (...p: string[]) => new Set(p)
const ana = { userId: 'u_ana', email: 'ana@example.test', perms: perm('content.edit', 'content.publish', 'pricing.publish') }
const beto = { userId: 'u_beto', email: 'beto@example.test', perms: perm('content.edit', 'content.publish', 'pricing.publish') }
const editor = { userId: 'u_edit', email: 'edit@example.test', perms: perm('content.edit') }

const hero = (text: string) => ({ text })
const charges = (o = 0) => ({ originationFeePct: o, insurancePct: 0, punitiveRateMonthlyPct: 0 })
const blocked = (re: RegExp) => (e: unknown) => re.test(String((e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message))

describe('site-config store (PG local)', { skip: isLocal ? false : 'requiere DATABASE_URL local' }, () => {
  let s: Store
  let db: typeof import('../../lib/db').db
  let pool: typeof import('../../lib/db').pool
  let sqlTag: typeof import('drizzle-orm').sql
  let read: typeof import('../../lib/site-config/read')

  before(async () => {
    ;({ db, pool } = await import('../../lib/db'))
    ;({ sql: sqlTag } = await import('drizzle-orm'))
    s = await import('../../lib/site-config/store')
    read = await import('../../lib/site-config/read')
    await db.execute(sqlTag`DROP TABLE IF EXISTS site_config_version, site_config_item CASCADE`)
    s._resetEnsuredForTests()
    await s.ensureSiteConfigSchema()
  })
  after(async () => {
    await pool.end()
  })

  it('texto normal: borrador → revisión → publicación por la misma persona, y queda visible', async () => {
    const d = await s.createDraft(editor, 'home.hero_subtitle', hero('Subtítulo de prueba bastante largo para validar.'), 'prueba inicial')
    assert.equal(d.status, 'draft')
    assert.equal(d.version, 1)
    assert.equal(d.publicVisible, true)
    await assert.rejects(() => s.publish(ana, 'home.hero_subtitle'), /revisión/)
    await s.submitForReview(editor, 'home.hero_subtitle')
    await assert.rejects(() => s.publish(editor, 'home.hero_subtitle'), /content\.publish/)
    const p = await s.publish(ana, 'home.hero_subtitle')
    assert.equal(p.status, 'published')
    const pub = await s.readPublished('home.hero_subtitle')
    assert.equal((pub!.value as { text: string }).text, 'Subtítulo de prueba bastante largo para validar.')
  })

  it('valida con zod en el servidor y no guarda valores inválidos', async () => {
    await assert.rejects(() => s.createDraft(ana, 'pricing.charges', { originationFeePct: 99, insurancePct: 0, punitiveRateMonthlyPct: 0 }, 'tasa absurda'), /originationFeePct|Revisá/)
    await assert.rejects(() => s.createDraft(ana, 'clave.inexistente', {}, 'x motivo'), /desconocida/)
    await assert.rejects(() => s.createDraft({ ...ana, perms: perm() }, 'home.hero_subtitle', hero('Otro subtítulo lo bastante largo.'), 'sin permiso'), /content\.edit/)
    await assert.rejects(() => s.createDraft(ana, 'home.hero_subtitle', hero('Otro subtítulo lo bastante largo.'), ''), /motivo/)
  })

  it('clave sensible: dual control de punta a punta', async () => {
    const d = await s.createDraft(ana, 'pricing.charges', charges(2.5), 'propuesta de gastos', { publicVisible: true })
    assert.equal(d.publicVisible, true)
    await s.submitForReview(ana, 'pricing.charges')
    // el autor no se aprueba solo
    await assert.rejects(() => s.approve(ana, 'pricing.charges', 'ok por mí', 'Aprobó dirección y abogado'), /Doble control/)
    // sin el permiso de precios no aprueba
    await assert.rejects(() => s.approve({ ...beto, perms: perm('content.publish') }, 'pricing.charges', 'nota ok', 'Aprobó dirección y abogado'), /pricing\.publish/)
    // no se publica sin aprobación
    await assert.rejects(() => s.publish(beto, 'pricing.charges'), /segundo administrador/)
    // visible en la web exige constancia
    await assert.rejects(() => s.approve(beto, 'pricing.charges', 'revisado ok'), /constancia|quién lo aprobó/)
    const a = await s.approve(beto, 'pricing.charges', 'revisado ok', 'Aprobado por Angel y su abogado el 10/10')
    assert.equal(a.status, 'approved')
    assert.equal(a.approvedById, 'u_beto')
    const p = await s.publish(ana, 'pricing.charges')
    assert.equal(p.status, 'published')
    const row = await s.readPublished('pricing.charges')
    assert.equal(row!.publicVisible, true)
  })

  it('un editor posterior (otra persona) también pasa a ser "autor" para el doble control', async () => {
    await s.createDraft(ana, 'pricing.cft_method', { method: 'tea_por_iva', ivaPct: 21, includesInsurance: false, includesOriginationFees: false, note: 'nota' }, 'cambio de nota')
    await s.updateDraft(beto, 'pricing.cft_method', { method: 'tea_por_iva', ivaPct: 21, includesInsurance: true, includesOriginationFees: false, note: 'nota 2' }, 'ajuste de beto')
    await s.submitForReview(beto, 'pricing.cft_method')
    await assert.rejects(() => s.approve(beto, 'pricing.cft_method', 'nota ok ok', ''), /Doble control/)
    await assert.rejects(() => s.approve(ana, 'pricing.cft_method', 'nota ok ok', ''), /Doble control/) // Ana creó el borrador
    await s.returnToDraft(beto, 'pricing.cft_method', 'lo retiro para corregir')
    const again = await s.updateDraft(beto, 'pricing.cft_method', { method: 'tea_por_iva', ivaPct: 21, includesInsurance: false, includesOriginationFees: false, note: 'nota 3' }, 'vuelvo atrás')
    assert.equal(again.status, 'draft')
    await s.discardDraft(beto, 'pricing.cft_method')
    assert.equal((await s.getItemDetail('pricing.cft_method')).open, null)
  })

  it('una sola versión en curso por clave', async () => {
    await s.createDraft(ana, 'params.contact', { supportEmail: 'a@example.test', privacyEmail: 'b@example.test', phone: '' }, 'primer borrador')
    await assert.rejects(() => s.createDraft(ana, 'params.contact', { supportEmail: 'a@example.test', privacyEmail: 'b@example.test', phone: '' }, 'segundo borrador'), /en curso/)
    await s.discardDraft(ana, 'params.contact')
  })

  it('historial inmutable: no se edita el contenido publicado ni se borra', async () => {
    const detail = await s.getItemDetail('home.hero_subtitle')
    const v = detail.published!
    await assert.rejects(() => db.execute(sqlTag`UPDATE site_config_version SET value = '{"text":"alterado alterado alterado"}'::jsonb WHERE id = ${v.id}`), blocked(/inmutable|no se modifica/))
    await assert.rejects(() => db.execute(sqlTag`DELETE FROM site_config_version WHERE id = ${v.id}`), blocked(/inmutable/))
    await assert.rejects(() => db.execute(sqlTag`TRUNCATE site_config_version`), blocked(/inmutable/))
    await assert.rejects(() => db.execute(sqlTag`UPDATE site_config_version SET status = 'draft' WHERE id = ${v.id}`), blocked(/transición|no se modifica/))
  })

  it('publicar una versión nueva reemplaza a la anterior; vuelta atrás crea una versión nueva y sigue el flujo', async () => {
    await s.createDraft(editor, 'home.hero_subtitle', hero('Segunda versión del subtítulo de portada.'), 'segunda')
    await s.submitForReview(editor, 'home.hero_subtitle')
    await s.publish(ana, 'home.hero_subtitle')
    let detail = await s.getItemDetail('home.hero_subtitle')
    assert.deepEqual(detail.versions.map((v) => [v.version, v.status]), [[2, 'published'], [1, 'superseded']])

    const rb = await s.createRollbackDraft(editor, 'home.hero_subtitle', 1, 'la segunda no gustó')
    assert.equal(rb.version, 3)
    assert.equal(rb.rollbackOfVersion, 1)
    assert.equal((rb.value as { text: string }).text, 'Subtítulo de prueba bastante largo para validar.')
    await s.submitForReview(editor, 'home.hero_subtitle')
    await s.publish(ana, 'home.hero_subtitle')
    detail = await s.getItemDetail('home.hero_subtitle')
    assert.equal(detail.published!.version, 3)
    assert.equal(detail.versions.length, 3)
    assert.equal(detail.versions.find((v) => v.version === 2)!.status, 'superseded') // nada se reescribe
  })

  it('retirar lo publicado devuelve la web al valor del código', async () => {
    await assert.rejects(() => s.unpublish(editor, 'home.hero_subtitle', 'sin permiso de publicar'), /content\.publish/)
    await s.unpublish(ana, 'home.hero_subtitle', 'volver al texto original')
    assert.equal(await s.readPublished('home.hero_subtitle'), null)
    const states = await s.listItemStates()
    assert.equal(states.get('home.hero_subtitle')!.publishedVersion, null)
  })

  it('sensible publicado SIN marca pública no sale a la web (comisiones y tasas ocultas por defecto)', async () => {
    await s.createDraft(ana, 'pricing.merchant_commissions', { schedule: [{ plan: 'Estándar', commissionPct: 3.5, settlementDays: 2, notes: '' }] }, 'esquema inicial')
    await s.submitForReview(ana, 'pricing.merchant_commissions')
    await s.approve(beto, 'pricing.merchant_commissions', 'revisado ok')
    await s.publish(ana, 'pricing.merchant_commissions')
    const row = await s.readPublished('pricing.merchant_commissions')
    assert.equal(row!.publicVisible, false)
    const resolved = read.resolveSetting('pricing.merchant_commissions', row)
    assert.equal(resolved.source, 'default')
    assert.deepEqual(resolved.value, { schedule: [] })
  })

  it('sin tablas (SQL no aplicado) la lectura pública no rompe: usa el código', async () => {
    const saved = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'postgres://x:y@host.neon.tech/db'
    const r = await read.getSetting('home.hero_subtitle')
    assert.equal(r.source, 'default')
    process.env.DATABASE_URL = saved
  })
})
