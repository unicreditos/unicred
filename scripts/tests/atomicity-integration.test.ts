/**
 * Integracion contra Postgres REAL: atomicidad de los flujos con estado que no son el OTP.
 * Mismas guardas que otp-integration: se omite sin TEST_DATABASE_URL; solo localhost y base *_test.
 * Trabaja en su propio schema (atom_test) para no pisarse con otros archivos de prueba corriendo en paralelo.
 * No importa lib/db: nunca lee .env ni toca la base de la app.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import {
  backfillLegacyEvidenceWith,
  listEvidenceWith,
  logEvidenceAccessWith,
  readEvidenceVerifiedWith,
  storeEvidenceVersionWith,
} from '../../lib/evidence-store'
import { ocrMergeSql } from '../../lib/kyc-ocr-merge'
import { isUniqueViolation } from '../../lib/pg-errors'
import { consumeRateLimitWith } from '../../lib/rate-limit-store'
import { claimWebhookReplay, releaseWebhookReplay, REPLAY_CLAIM_STALE_MS } from '../../lib/webhook-replay-store'

const URL_ENV = process.env.TEST_DATABASE_URL
const SCHEMA = 'atom_test'

function assertSafeTestDb(raw: string) {
  const u = new URL(raw)
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error(`Prueba bloqueada: el host ${u.hostname} no es local.`)
  const name = decodeURIComponent(u.pathname.replace(/^\//, ''))
  if (!name.endsWith('_test')) throw new Error(`Prueba bloqueada: la base "${name}" no termina en _test.`)
}
const sqlFile = (n: string) => readFileSync(new URL(`../../scripts/sql/${n}`, import.meta.url), 'utf8')

describe('Atomicidad de flujos con estado contra Postgres real', { skip: URL_ENV ? false : 'TEST_DATABASE_URL no definida: se omite' }, () => {
  let pool: pg.Pool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any
  let seq = 0
  const uid = () => `u_${Date.now()}_${++seq}`
  const png = (n: number) => Buffer.from(`fake-image-bytes-${n}-${'x'.repeat(50)}`)

  before(async () => {
    assertSafeTestDb(URL_ENV!)
    const admin = new pg.Pool({ connectionString: URL_ENV, max: 1 })
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await admin.query(`CREATE SCHEMA ${SCHEMA}`)
    await admin.end()
    pool = new pg.Pool({ connectionString: URL_ENV, max: 40, options: `-c search_path=${SCHEMA}` })
    db = drizzle(pool)
    await pool.query(`CREATE TABLE kyc_verification (id text PRIMARY KEY, "userId" text NOT NULL, "providerReferenceId" text, "dniFrontImageUrl" text, "dniBackImageUrl" text, "selfieImageUrl" text, "videoUrl" text, "ocrData" jsonb, "updatedAt" timestamptz)`)
    await pool.query(`CREATE TABLE didit_webhook_log (id text PRIMARY KEY, processed boolean NOT NULL DEFAULT false, "processedAt" timestamptz)`)
    await pool.query(`CREATE TABLE rate_limit_bucket (key text PRIMARY KEY, count integer NOT NULL, "resetAt" timestamptz NOT NULL)`)
    await pool.query(`CREATE TABLE profile ("userId" text PRIMARY KEY, cuil text)`)
    await pool.query(sqlFile('2026-10-09_02_kyc_evidence_and_admin_otp.sql'))
  })
  after(async () => { await pool?.end() })

  describe('evidencia versionada', () => {
    it('20 guardados paralelos del MISMO archivo crean una sola version', async () => {
      const userId = uid()
      const res = await Promise.all(Array.from({ length: 20 }, () => storeEvidenceVersionWith(db, { userId, kind: 'dni_front', bytes: png(1), mime: 'image/jpeg' })))
      assert.equal(res.filter((r) => r.created).length, 1)
      assert.equal((await listEvidenceWith(db, userId)).length, 1)
    })
    it('15 archivos DISTINTOS en paralelo: versiones 1..15 sin huecos ni repetidas, una sola vigente, cadena consistente', async () => {
      const userId = uid()
      await Promise.all(Array.from({ length: 15 }, (_, i) => storeEvidenceVersionWith(db, { userId, kind: 'selfie', bytes: png(100 + i), mime: 'image/jpeg' })))
      const rows = (await pool.query(`SELECT id, version, "supersededBy" FROM kyc_evidence WHERE "userId"=$1 ORDER BY version`, [userId])).rows
      assert.deepEqual(rows.map((r) => r.version), Array.from({ length: 15 }, (_, i) => i + 1))
      assert.equal(rows.filter((r) => r.supersededBy === null).length, 1, 'solo la ultima version queda sin superar')
      assert.equal(rows.at(-1).supersededBy, null)
      for (let i = 0; i < rows.length - 1; i++) assert.equal(rows[i].supersededBy, rows[i + 1].id)
    })
    it('una verificacion nueva NO pisa la anterior; el hash se verifica al leer', async () => {
      const userId = uid()
      await storeEvidenceVersionWith(db, { userId, kind: 'dni_back', bytes: png(7), mime: 'image/png' })
      await storeEvidenceVersionWith(db, { userId, kind: 'dni_back', bytes: png(8), mime: 'image/png' })
      const v1 = await readEvidenceVerifiedWith(db, userId, 'dni_back', 1)
      const latest = await readEvidenceVerifiedWith(db, userId, 'dni_back')
      assert.ok(v1.ok && latest.ok)
      if (v1.ok && latest.ok) { assert.deepEqual(v1.bytes, png(7)); assert.equal(latest.meta.version, 2); assert.deepEqual(latest.bytes, png(8)) }
    })
    it('la base rechaza modificar el contenido o borrar una version (inmutable)', async () => {
      const userId = uid()
      const { id } = await storeEvidenceVersionWith(db, { userId, kind: 'video', bytes: png(9), mime: 'video/mp4' })
      await assert.rejects(pool.query(`UPDATE kyc_evidence SET data = $1 WHERE id = $2`, [png(10), id]))
      await assert.rejects(pool.query(`DELETE FROM kyc_evidence WHERE id = $1`, [id]))
    })
    it('si el contenido se corrompe por fuera, se detecta (hash_mismatch) y no se entrega', async () => {
      const userId = uid()
      const { id } = await storeEvidenceVersionWith(db, { userId, kind: 'dni_front', bytes: png(11), mime: 'image/jpeg' })
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await c.query(`ALTER TABLE kyc_evidence DISABLE TRIGGER USER`)
        await c.query(`UPDATE kyc_evidence SET data = $1 WHERE id = $2`, [png(12), id])
        await c.query(`ALTER TABLE kyc_evidence ENABLE TRIGGER USER`)
        await c.query('COMMIT')
      } finally { c.release() }
      const r = await readEvidenceVerifiedWith(db, userId, 'dni_front')
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.reason, 'hash_mismatch')
    })
    it('backfill: copia lo legado, es idempotente y corre en paralelo sin duplicar', async () => {
      const userId = uid()
      const url = (n: number) => `data:image/jpeg;base64,${png(n).toString('base64')}`
      await pool.query(`INSERT INTO kyc_verification (id, "userId", "providerReferenceId", "dniFrontImageUrl", "selfieImageUrl") VALUES ($1,$2,'sess1',$3,$4)`, [`k_${userId}`, userId, url(21), url(22)])
      const out = await Promise.all(Array.from({ length: 8 }, () => backfillLegacyEvidenceWith(db, userId)))
      assert.equal(out.reduce((a, b) => a + b, 0), 2)
      assert.equal(await backfillLegacyEvidenceWith(db, userId), 0)
      assert.equal((await listEvidenceWith(db, userId)).length, 2)
    })
    it('registro de accesos: 25 lecturas en paralelo dejan 25 filas, con quien, que y cuando', async () => {
      const userId = uid()
      await Promise.all(Array.from({ length: 25 }, (_, i) => logEvidenceAccessWith(db, { ownerUserId: userId, kind: 'selfie', version: 1, actorUserId: `admin_${i}`, outcome: 'served', ip: '10.0.0.9', userAgent: 'test' })))
      const r = await pool.query(`SELECT count(*)::int AS n, count(DISTINCT "actorUserId")::int AS actors FROM kyc_evidence_access_log WHERE "ownerUserId"=$1`, [userId])
      assert.deepEqual(r.rows[0], { n: 25, actors: 25 })
      await assert.rejects(pool.query(`DELETE FROM kyc_evidence_access_log WHERE "ownerUserId"=$1`, [userId]), /./, 'el registro de accesos es de solo agregar')
    })
  })

  describe('reproceso de webhooks Didit', () => {
    it('10 clics simultaneos: solo uno toma el reproceso', async () => {
      const id = `wh_${uid()}`
      await pool.query(`INSERT INTO didit_webhook_log (id) VALUES ($1)`, [id])
      const r = await Promise.all(Array.from({ length: 10 }, () => claimWebhookReplay(db, id)))
      assert.equal(r.filter(Boolean).length, 1)
    })
    it('si falla se libera y se puede reintentar; si ya esta procesado no se toma; un reproceso caido se retoma tras el plazo', async () => {
      const id = `wh_${uid()}`
      await pool.query(`INSERT INTO didit_webhook_log (id) VALUES ($1)`, [id])
      const t0 = new Date()
      assert.equal(await claimWebhookReplay(db, id, t0), true)
      assert.equal(await claimWebhookReplay(db, id, new Date(t0.getTime() + 1000)), false)
      await releaseWebhookReplay(db, id)
      assert.equal(await claimWebhookReplay(db, id, new Date(t0.getTime() + 2000)), true)
      assert.equal(await claimWebhookReplay(db, id, new Date(t0.getTime() + 2000 + REPLAY_CLAIM_STALE_MS + 5000)), true, 'reproceso colgado: se retoma')
      await pool.query(`UPDATE didit_webhook_log SET processed = true WHERE id = $1`, [id])
      assert.equal(await claimWebhookReplay(db, id, new Date(t0.getTime() + 10 * REPLAY_CLAIM_STALE_MS)), false)
    })
  })

  describe('ocrData: fusion atomica', () => {
    it('Didit y ARCA escribiendo a la vez: no se pierde ninguna clave (20 escritores en paralelo)', async () => {
      const userId = uid()
      const id = `k_${userId}`
      await pool.query(`INSERT INTO kyc_verification (id, "userId", "ocrData") VALUES ($1,$2,'{"accountType":"customer"}')`, [id, userId])
      await Promise.all(Array.from({ length: 20 }, (_, i) => db.execute(sql`UPDATE kyc_verification SET "ocrData" = ${ocrMergeSql({ [`k${i}`]: { n: i } })} WHERE id = ${id}`)))
      const o = (await pool.query(`SELECT "ocrData" FROM kyc_verification WHERE id=$1`, [id])).rows[0].ocrData
      assert.equal(Object.keys(o).length, 21)
      assert.equal(o.accountType, 'customer')
      assert.deepEqual(o.k19, { n: 19 })
    })
    it('con ocrData nulo tambien funciona', async () => {
      const userId = uid()
      await pool.query(`INSERT INTO kyc_verification (id, "userId") VALUES ($1,$2)`, [`k_${userId}`, userId])
      await db.execute(sql`UPDATE kyc_verification SET "ocrData" = ${ocrMergeSql({ didit: { a: 1 } })} WHERE id = ${`k_${userId}`}`)
      assert.deepEqual((await pool.query(`SELECT "ocrData" FROM kyc_verification WHERE "userId"=$1`, [userId])).rows[0].ocrData, { didit: { a: 1 } })
    })
  })

  describe('CUIL unico por perfil (SQL 03)', () => {
    it('con duplicados existentes NO crea el indice y no falla; sin duplicados lo crea; es idempotente', async () => {
      await pool.query(`INSERT INTO profile ("userId", cuil) VALUES ('d1','20111111112'),('d2','20111111112')`)
      await pool.query(sqlFile('2026-10-09_03_profile_cuil_unique.sql'))
      assert.equal((await pool.query(`SELECT 1 FROM pg_indexes WHERE schemaname=$1 AND indexname='profile_cuil_unique_idx'`, [SCHEMA])).rowCount, 0)
      await pool.query(`DELETE FROM profile`)
      await pool.query(sqlFile('2026-10-09_03_profile_cuil_unique.sql'))
      await pool.query(sqlFile('2026-10-09_03_profile_cuil_unique.sql'))
      assert.equal((await pool.query(`SELECT 1 FROM pg_indexes WHERE schemaname=$1 AND indexname='profile_cuil_unique_idx'`, [SCHEMA])).rowCount, 1)
    })
    it('12 altas simultaneas con el mismo CUIL: solo una entra y el resto recibe violacion unica reconocible', async () => {
      const r = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => pool.query(`INSERT INTO profile ("userId", cuil) VALUES ($1,'27222222223')`, [`race_${i}`])))
      assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1)
      for (const x of r) if (x.status === 'rejected') assert.equal(isUniqueViolation(x.reason), true)
    })
    it('cuil vacio o nulo no choca', async () => {
      await pool.query(`INSERT INTO profile ("userId", cuil) VALUES ('n1',NULL),('n2',NULL),('n3',''),('n4','')`)
    })
  })

  describe('limite de actualizaciones (BCRA/ARCA)', () => {
    it('30 consultas en paralelo con tope 5: pasan exactamente 5', async () => {
      const key = `bcra-refresh:${uid()}`
      const r = await Promise.all(Array.from({ length: 30 }, () => consumeRateLimitWith(db, key, 5, 60_000)))
      assert.equal(r.filter((x) => x.ok).length, 5)
      assert.equal(r.filter((x) => !x.ok).length, 25)
    })
    it('al vencer la ventana el contador reinicia', async () => {
      const key = `arca-refresh:${uid()}`
      await consumeRateLimitWith(db, key, 1, 60_000)
      assert.equal((await consumeRateLimitWith(db, key, 1, 60_000)).ok, false)
      await pool.query(`UPDATE rate_limit_bucket SET "resetAt" = now() - interval '1 second' WHERE key = $1`, [key])
      assert.equal((await consumeRateLimitWith(db, key, 1, 60_000)).ok, true)
    })
  })
})