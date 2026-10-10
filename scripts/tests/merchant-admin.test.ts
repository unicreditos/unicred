/**
 * Panel de comercios del backoffice: checklist, transiciones, documentos con hash/versiones/bitacora, permisos, mensajes inmutables, 409.
 * La parte de base corre contra Postgres REAL de prueba, como el resto del repo: se omite sin TEST_DATABASE_URL; solo localhost y base *_test;
 * trabaja en su propio schema (madm_test). No importa lib/db: nunca lee .env ni toca la base de la app.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { MERCHANT_ADMIN_DDL } from '../../lib/merchant-admin-ddl'
import { availableActions, checkTransition, cleanMessage, documentChecklist, isMerchantFlag } from '../../lib/merchant-admin-core'
import * as S from '../../lib/merchant-admin-store'

describe('merchant-admin core', () => {
  it('checklist: persona humana no exige expediente; juridica si', () => {
    assert.deepEqual(documentChecklist('FISICA', 'titular', []), [])
    const c = documentChecklist('JURIDICA', 'apoderado', [{ id: 'd1', type: 'estatuto_contrato_social', status: 'approved', fileName: 'e.pdf', sha256: 'x', createdAt: '' }])
    assert.deepEqual(c.map((i) => [i.type, i.state]), [['estatuto_contrato_social', 'approved'], ['poder', 'missing']])
  })
  it('transiciones: rechazar y suspender exigen motivo; estados invalidos se rechazan', () => {
    assert.equal(checkTransition('pending', 'reject', '').ok, false)
    assert.equal(checkTransition('active', 'suspend', 'fraude detectado').ok, true)
    assert.equal(checkTransition('pending', 'suspend', 'motivo largo').ok, false)
    assert.deepEqual(availableActions('paused'), ['reject', 'reactivate'])
  })
  it('mensajes y flags', () => {
    assert.equal(cleanMessage('  ').ok, false)
    assert.equal(cleanMessage('x'.repeat(2001)).ok, false)
    assert.equal(isMerchantFlag('qr'), true)
    assert.equal(isMerchantFlag('hack'), false)
  })
})

const URL_ENV = process.env.TEST_DATABASE_URL
function assertSafeTestDb(raw: string) {
  const u = new URL(raw)
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error(`Prueba bloqueada: el host ${u.hostname} no es local.`)
  if (!decodeURIComponent(u.pathname.replace(/^\//, '')).endsWith('_test')) throw new Error('Prueba bloqueada: la base no termina en _test.')
}

describe('merchant-admin store (Postgres de prueba)', { skip: URL_ENV ? false : 'TEST_DATABASE_URL no definida: se omite' }, () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any
  let pool: pg.Pool
  before(async () => {
    assertSafeTestDb(URL_ENV!)
    pool = new pg.Pool({ connectionString: URL_ENV, max: 1, options: '-c search_path=madm_test' })
    db = drizzle(pool)
    await pool.query('DROP SCHEMA IF EXISTS madm_test CASCADE')
    await pool.query('CREATE SCHEMA madm_test')
    await db.execute(sql`CREATE TABLE "user" (id text primary key, email text, name text)`)
    await db.execute(sql`CREATE TABLE merchant (id text primary key, status text, "kybStatus" text, "updatedAt" timestamptz default now())`)
    await db.execute(sql`CREATE TABLE merchant_document (id text primary key, "merchantId" text, "userId" text, type text, "fileName" text, mime text, size int, sha256 text, content text, status text default 'uploaded', "createdAt" timestamptz default now(), "updatedAt" timestamptz default now())`)
    for (const s of MERCHANT_ADMIN_DDL) await db.execute(sql.raw(s))
    for (const s of MERCHANT_ADMIN_DDL) await db.execute(sql.raw(s)) // idempotente
    await db.execute(sql`INSERT INTO "user" VALUES ('a1','a@x','Admin'),('u1','m@x','Comercio')`)
    await db.execute(sql`INSERT INTO merchant (id,status,"kybStatus") VALUES ('m1','pending','incomplete')`)
  })
  after(async () => { await pool.query('DROP SCHEMA IF EXISTS madm_test CASCADE'); await pool.end() })

  const bytes = Buffer.from('%PDF-1.4 contenido de prueba '.repeat(60))
  const sha = createHash('sha256').update(bytes).digest('hex')
  const putDoc = (id: string, content = bytes.toString('base64'), hash = sha) =>
    db.execute(sql`INSERT INTO merchant_document (id,"merchantId","userId",type,"fileName",mime,size,sha256,content) VALUES (${id},'m1','u1','estatuto_contrato_social','e.pdf','application/pdf',${bytes.length},${hash},${content})`)

  it('documentos: version archivada, revision, lectura con hash y bitacora', async () => {
    await putDoc('d1')
    assert.equal(await S.archiveCurrentDocWith(db, 'm1', 'estatuto_contrato_social'), 2) // v1 archivada, la nueva sera v2
    await db.execute(sql`DELETE FROM merchant_document WHERE id='d1'`)
    await putDoc('d2')
    const versions = await S.listDocVersionsWith(db, 'm1', 'estatuto_contrato_social')
    assert.equal(versions.length, 1); assert.equal(versions[0].sha256, sha)
    const bad = await S.reviewDocWith(db, { documentId: 'd2', merchantId: 'm1', decision: 'observed', note: '', actor: 'a1' })
    assert.equal(bad.ok, false)
    assert.equal((await S.reviewDocWith(db, { documentId: 'd2', merchantId: 'm1', decision: 'approved', note: '', actor: 'a1' })).ok, true)
    assert.equal((await S.listMerchantDocsWith(db, 'm1'))[0].status, 'approved')
    const ok = await S.readMerchantDocVerifiedWith(db, { documentId: 'd2', actor: 'a1' })
    assert.equal(ok.ok, true)
    await putDoc('d3', Buffer.from('otro contenido').toString('base64'), sha) // hash no coincide
    const mis = await S.readMerchantDocVerifiedWith(db, { documentId: 'd3', actor: 'a1' })
    assert.deepEqual(mis.ok ? null : mis.reason, 'hash_mismatch')
    const nf = await S.readMerchantDocVerifiedWith(db, { documentId: 'nope', actor: 'a1' })
    assert.equal(nf.ok, false)
    assert.deepEqual((await S.listDocAccessWith(db, 'm1')).map((l) => l.outcome).sort(), ['hash_mismatch', 'served'])
  })

  it('permisos: banderas con antes/despues, sin efectos externos', async () => {
    assert.deepEqual(await S.getPermissionsWith(db, 'm1').then((p) => [p.pos, p.qr, p.virtualAccount]), [false, false, false])
    const r = await S.setPermissionWith(db, { merchantId: 'm1', flag: 'qr', value: true, actor: 'a1' })
    assert.deepEqual(r, { before: false, after: true })
    const p = await S.getPermissionsWith(db, 'm1')
    assert.deepEqual([p.pos, p.qr, p.virtualAccount, p.updatedBy], [false, true, false, 'a1'])
  })

  it('mensajes: inmutables, lectura una sola vez, respuesta vinculada al pedido', async () => {
    const req = await S.addMessageWith(db, { merchantId: 'm1', authorUserId: 'a1', authorRole: 'admin', kind: 'request', body: 'Subí el poder vigente', requestedDocType: 'poder' })
    assert.equal(await S.openRequestForDocWith(db, 'm1', 'poder'), req)
    assert.equal(await S.countUnreadWith(db, 'm1', 'merchant'), 1)
    await S.addMessageWith(db, { merchantId: 'm1', authorUserId: 'u1', authorRole: 'merchant', kind: 'reply', body: 'Adjunto el poder', documentId: 'd2', replyToId: req })
    assert.equal(await S.openRequestForDocWith(db, 'm1', 'poder'), null)
    await assert.rejects(db.execute(sql`UPDATE merchant_message SET body='editado' WHERE id=${req}`))
    await assert.rejects(db.execute(sql`DELETE FROM merchant_message WHERE id=${req}`))
    assert.equal(await S.markReadWith(db, { merchantId: 'm1', readerRole: 'merchant', reader: 'u1' }), 1)
    assert.equal(await S.markReadWith(db, { merchantId: 'm1', readerRole: 'merchant', reader: 'u1' }), 0)
    await assert.rejects(db.execute(sql`UPDATE merchant_message SET "readAt"=now() - interval '1 day' WHERE id=${req}`))
    const list = await S.listMessagesWith(db, 'm1')
    assert.deepEqual(list.map((m) => [m.authorRole, m.kind]), [['admin', 'request'], ['merchant', 'reply']])
    assert.ok(list[0].readAt && !list[1].readAt && list[0].authorName === 'Admin')
  })

  it('409: el cambio de estado falla si el comercio cambio desde que se vio', async () => {
    const cur = (await db.execute(sql`SELECT "updatedAt" FROM merchant WHERE id='m1'`)).rows[0].updatedAt
    const seen = new Date(cur).toISOString()
    assert.equal(await S.setStatusIfUnchangedWith(db, { merchantId: 'm1', status: 'paused', expectedUpdatedAt: seen }), true)
    assert.equal(await S.setStatusIfUnchangedWith(db, { merchantId: 'm1', status: 'active', expectedUpdatedAt: seen }), false) // desactualizado
  })
})

describe('merchant-admin: archivo SQL manual', () => {
  it('2026-10-10_05 contiene cada sentencia del DDL (no se desincroniza)', async () => {
    const { readFileSync } = await import('node:fs')
    const file = readFileSync(new URL('../../scripts/sql/2026-10-10_05_merchant_admin.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    for (const s of MERCHANT_ADMIN_DDL) assert.ok(file.includes(s.trim()), `falta en el SQL: ${s.slice(0, 60)}`)
    assert.match(file, /^BEGIN;/m)
    assert.doesNotMatch(file, /\bDROP TABLE|\bTRUNCATE|\bDELETE FROM/i)
  })
})
