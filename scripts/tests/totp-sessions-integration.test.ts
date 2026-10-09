/**
 * Integracion contra Postgres REAL: TOTP, codigos de respaldo y sesiones activas.
 * Se omite sin TEST_DATABASE_URL; solo localhost y base *_test; schema propio (totp_test). No importa lib/db.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { sessionPassedSecondFactorWith } from '../../lib/otp-pg-store'
import { consumeRateLimitWith } from '../../lib/rate-limit-store'
import { listSessionsWith, revokeOtherSessionsWith, revokeSessionWith } from '../../lib/sessions-store'
import { base32Decode, hotp, totpStep } from '../../lib/totp-core'
import { beginEnrolWith, confirmEnrolWith, disableTotpWith, regenerateBackupCodesWith, totpStatusWith, userHasTotpWith, verifyFactorWith, type TotpAudit, type TotpDeps } from '../../lib/totp-store'

const URL_ENV = process.env.TEST_DATABASE_URL
const SCHEMA = 'totp_test'
const PEPPER = 'integration-pepper-0123456789abcdef'

function assertSafeTestDb(raw: string) {
  const u = new URL(raw)
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error(`Prueba bloqueada: el host ${u.hostname} no es local.`)
  const name = decodeURIComponent(u.pathname.replace(/^\//, ''))
  if (!name.endsWith('_test')) throw new Error(`Prueba bloqueada: la base "${name}" no termina en _test.`)
}
const sqlFile = (n: string) => readFileSync(new URL(`../../scripts/sql/${n}`, import.meta.url), 'utf8')

describe('TOTP, respaldo y sesiones contra Postgres real', { skip: URL_ENV ? false : 'TEST_DATABASE_URL no definida: se omite' }, () => {
  let pool: pg.Pool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any
  let seq = 0
  const audits: TotpAudit[] = []
  let t = new Date('2026-10-09T15:00:00Z').getTime()

  const mkDeps = (permissive = false): TotpDeps => ({
    pepper: () => PEPPER,
    now: () => new Date(t),
    newId: (p) => `${p}_${++seq}_${Math.random().toString(36).slice(2, 9)}`,
    limiter: permissive ? async () => ({ ok: true }) : (key, limit, windowMs) => consumeRateLimitWith(db, key, limit, windowMs),
    audit: async (e) => { audits.push(e) },
  })
  const uid = () => `u_${Date.now()}_${++seq}`
  const secretOf = async (userId: string) => {
    // Para la prueba se re-deriva el secreto desde lo que devolvio beginEnrol.
    return userId
  }
  void secretOf

  async function enrol(deps: TotpDeps, userId = uid(), sessionId: string | null = `s_${userId}`) {
    const b = await beginEnrolWith(deps, db, { userId, account: `${userId}@example.test` })
    assert.ok(b.ok)
    if (!b.ok) throw new Error('begin')
    const secret = base32Decode(b.secretBase32)
    const code = hotp(secret, totpStep(t))
    const c = await confirmEnrolWith(deps, db, { userId, code, sessionId, ip: '10.0.0.1' })
    assert.ok(c.ok)
    if (!c.ok) throw new Error('confirm')
    return { userId, secret, backupCodes: c.backupCodes, sessionId }
  }
  const advance = (ms: number) => { t += ms }

  before(async () => {
    assertSafeTestDb(URL_ENV!)
    const admin = new pg.Pool({ connectionString: URL_ENV, max: 1 })
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await admin.query(`CREATE SCHEMA ${SCHEMA}`)
    await admin.end()
    pool = new pg.Pool({ connectionString: URL_ENV, max: 40, options: `-c search_path=${SCHEMA}` })
    db = drizzle(pool)
    await pool.query(`CREATE TABLE session (id text PRIMARY KEY, token text NOT NULL, "userId" text NOT NULL, "ipAddress" text, "userAgent" text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "expiresAt" timestamptz NOT NULL)`)
    await pool.query(sqlFile('2026-10-09_02_kyc_evidence_and_admin_otp.sql'))
    await pool.query(sqlFile('2026-10-09_04_totp_backup_codes.sql'))
    await pool.query(sqlFile('2026-10-09_04_totp_backup_codes.sql')) // idempotente
  })
  after(async () => { await pool?.end() })

  describe('alta (enrolment)', () => {
    it('begin + confirm: activa, entrega 10 codigos, guarda secreto cifrado y codigos solo hasheados', async () => {
      const deps = mkDeps()
      const e = await enrol(deps)
      assert.equal(e.backupCodes.length, 10)
      const st = await totpStatusWith(db, e.userId)
      assert.deepEqual(st, { enabled: true, pending: false, backupRemaining: 10 })
      const row = (await pool.query(`SELECT * FROM user_totp WHERE "userId"=$1`, [e.userId])).rows[0]
      assert.match(row.secretEnc, /^v1:/)
      const hashes = (await pool.query(`SELECT "codeHash" FROM user_backup_code WHERE "userId"=$1`, [e.userId])).rows.map((r) => r.codeHash.trim())
      for (const c of e.backupCodes) assert.ok(!hashes.includes(c.replace('-', '')) && hashes.every((h) => /^[0-9a-f]{64}$/.test(h)))
      assert.equal(await sessionPassedSecondFactorWith(db, e.userId, e.sessionId), true, 'el alta tambien abre el segundo factor de esta sesion')
      assert.ok(audits.some((a) => a.userId === e.userId && a.action === 'TOTP_ENABLED'))
    })
    it('confirmar con codigo malo no activa; volver a empezar mientras esta pendiente reemplaza el secreto; ya activo no se puede pisar', async () => {
      const deps = mkDeps(true)
      const userId = uid()
      const b1 = await beginEnrolWith(deps, db, { userId, account: 'x@y.test' })
      assert.ok(b1.ok)
      assert.deepEqual(await confirmEnrolWith(deps, db, { userId, code: '000000' }), { ok: false, reason: 'invalid' })
      assert.equal((await totpStatusWith(db, userId)).pending, true)
      const b2 = await beginEnrolWith(deps, db, { userId, account: 'x@y.test' })
      assert.ok(b2.ok && b1.ok && b2.secretBase32 !== b1.secretBase32)
      if (b2.ok) await confirmEnrolWith(deps, db, { userId, code: hotp(base32Decode(b2.secretBase32), totpStep(t)) })
      assert.deepEqual(await beginEnrolWith(deps, db, { userId, account: 'x@y.test' }), { ok: false, reason: 'already_enabled' })
      assert.equal((await userHasTotpWith(db, userId)), true)
    })
    it('dos confirmaciones simultaneas del mismo alta: solo una activa y los codigos de respaldo son 10', async () => {
      const deps = mkDeps(true)
      const userId = uid()
      const b = await beginEnrolWith(deps, db, { userId, account: 'x@y.test' })
      if (!b.ok) throw new Error('begin')
      const code = hotp(base32Decode(b.secretBase32), totpStep(t))
      const r = await Promise.all(Array.from({ length: 10 }, () => confirmEnrolWith(deps, db, { userId, code })))
      assert.equal(r.filter((x) => x.ok).length, 1)
      assert.equal((await totpStatusWith(db, userId)).backupRemaining, 10)
    })
  })

  describe('verificacion TOTP', () => {
    it('codigo correcto abre el segundo factor de ESA sesion; incorrecto y usuario sin alta no', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      advance(31_000)
      const ok = await verifyFactorWith(deps, db, { userId: e.userId, code: hotp(e.secret, totpStep(t)), sessionId: 'sess_B', ip: '10.0.0.2' })
      assert.deepEqual(ok, { ok: true, method: 'totp' })
      assert.equal(await sessionPassedSecondFactorWith(db, e.userId, 'sess_B'), true)
      assert.equal(await sessionPassedSecondFactorWith(db, e.userId, 'sess_C'), false)
      assert.deepEqual(await verifyFactorWith(deps, db, { userId: e.userId, code: '000000', sessionId: 'sess_C' }), { ok: false, reason: 'invalid' })
      assert.deepEqual(await verifyFactorWith(deps, db, { userId: uid(), code: '123456', sessionId: 'sess_D' }), { ok: false, reason: 'not_enrolled' })
    })
    it('REPLAY: el mismo codigo no sirve dos veces ni uno de un paso anterior; uno posterior si', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      advance(30_000)
      const cur = totpStep(t)
      assert.equal((await verifyFactorWith(deps, db, { userId: e.userId, code: hotp(e.secret, cur), sessionId: 's1' })).ok, true)
      assert.deepEqual(await verifyFactorWith(deps, db, { userId: e.userId, code: hotp(e.secret, cur), sessionId: 's2' }), { ok: false, reason: 'replayed' })
      assert.deepEqual(await verifyFactorWith(deps, db, { userId: e.userId, code: hotp(e.secret, cur - 1), sessionId: 's2' }), { ok: false, reason: 'replayed' })
      assert.equal((await verifyFactorWith(deps, db, { userId: e.userId, code: hotp(e.secret, cur + 1), sessionId: 's3' })).ok, true)
      assert.equal(await sessionPassedSecondFactorWith(db, e.userId, 's2'), false)
    })
    it('REPLAY concurrente: 30 pedidos paralelos con el MISMO codigo, pasa exactamente uno', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      advance(30_000)
      const code = hotp(e.secret, totpStep(t))
      const r = await Promise.all(Array.from({ length: 30 }, (_, i) => verifyFactorWith(deps, db, { userId: e.userId, code, sessionId: `race_${i}` })))
      assert.equal(r.filter((x) => x.ok).length, 1)
      assert.equal(r.filter((x) => !x.ok && x.reason === 'replayed').length, 29)
      assert.equal((await pool.query(`SELECT count(*)::int n FROM admin_second_factor WHERE "userId"=$1 AND "sessionId" LIKE 'race_%'`, [e.userId])).rows[0].n, 1)
    })
    it('tope de intentos: 5 por 10 min (cuentan aciertos y fallos); despues bloquea y audita', async () => {
      const deps = mkDeps(false)
      const e = await enrol(deps)
      // el alta ya consumio 1 intento del cupo
      const res = []
      for (let i = 0; i < 6; i++) res.push(await verifyFactorWith(deps, db, { userId: e.userId, code: '111111', sessionId: 'x' }))
      assert.equal(res.filter((r) => !r.ok && r.reason === 'rate_limited').length, 2)
      assert.ok(audits.some((a) => a.userId === e.userId && a.action === 'TOTP_RATE_LIMITED'))
    })
    it('re-autenticacion con grant:false no abre el segundo factor de la sesion', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      advance(30_000)
      const r = await verifyFactorWith(deps, db, { userId: e.userId, code: hotp(e.secret, totpStep(t)), sessionId: 'sess_reauth', grant: false })
      assert.equal(r.ok, true)
      assert.equal(await sessionPassedSecondFactorWith(db, e.userId, 'sess_reauth'), false)
    })
  })

  describe('codigos de respaldo', () => {
    it('sirve una vez (en minusculas y sin guion tambien), luego no; descuenta; audita', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      const c = e.backupCodes[0]
      const r1 = await verifyFactorWith(deps, db, { userId: e.userId, code: c.toLowerCase().replace('-', ' '), sessionId: 'sb1' })
      assert.deepEqual(r1, { ok: true, method: 'backup_code', backupRemaining: 9 })
      assert.equal(await sessionPassedSecondFactorWith(db, e.userId, 'sb1'), true)
      assert.deepEqual(await verifyFactorWith(deps, db, { userId: e.userId, code: c, sessionId: 'sb2' }), { ok: false, reason: 'invalid' })
      assert.ok(audits.some((a) => a.userId === e.userId && a.action === 'BACKUP_CODE_USED'))
    })
    it('CONCURRENCIA: 30 usos paralelos del MISMO codigo, pasa exactamente uno y quedan 9', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      const r = await Promise.all(Array.from({ length: 30 }, (_, i) => verifyFactorWith(deps, db, { userId: e.userId, code: e.backupCodes[3], sessionId: `bc_${i}` })))
      assert.equal(r.filter((x) => x.ok).length, 1)
      assert.equal((await totpStatusWith(db, e.userId)).backupRemaining, 9)
    })
    it('el codigo de respaldo de otro usuario no sirve', async () => {
      const deps = mkDeps(true)
      const a = await enrol(deps)
      const b = await enrol(deps)
      assert.equal((await verifyFactorWith(deps, db, { userId: b.userId, code: a.backupCodes[0], sessionId: 'z' })).ok, false)
    })
    it('regenerar invalida los anteriores; 6 regeneraciones paralelas dejan exactamente 10 vigentes', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      const r = await Promise.all(Array.from({ length: 6 }, () => regenerateBackupCodesWith(deps, db, { userId: e.userId })))
      assert.equal(r.filter((x) => x.ok).length, 6)
      assert.equal((await totpStatusWith(db, e.userId)).backupRemaining, 10)
      assert.equal((await verifyFactorWith(deps, db, { userId: e.userId, code: e.backupCodes[0], sessionId: 'old' })).ok, false)
      const winner = (await pool.query(`SELECT "codeHash" FROM user_backup_code WHERE "userId"=$1`, [e.userId])).rows.length
      assert.equal(winner, 10)
      assert.deepEqual(await regenerateBackupCodesWith(deps, db, { userId: uid() }), { ok: false, reason: 'not_enrolled' })
    })
  })

  describe('desactivar', () => {
    it('borra secreto y codigos; despues ya no verifica', async () => {
      const deps = mkDeps(true)
      const e = await enrol(deps)
      await disableTotpWith(deps, db, { userId: e.userId })
      assert.equal(await userHasTotpWith(db, e.userId), false)
      assert.equal((await pool.query(`SELECT count(*)::int n FROM user_backup_code WHERE "userId"=$1`, [e.userId])).rows[0].n, 0)
      assert.deepEqual(await verifyFactorWith(deps, db, { userId: e.userId, code: e.backupCodes[0], sessionId: 'q' }), { ok: false, reason: 'not_enrolled' })
      assert.ok(audits.some((a) => a.userId === e.userId && a.action === 'TOTP_DISABLED'))
    })
  })

  describe('sesiones activas', () => {
    const addSession = (id: string, userId: string, o: { ua?: string; ip?: string; exp?: string } = {}) =>
      pool.query(`INSERT INTO session (id, token, "userId", "ipAddress", "userAgent", "expiresAt") VALUES ($1,$2,$3,$4,$5,$6)`, [id, `tok_${id}_secret`, userId, o.ip ?? '10.1.1.1', o.ua ?? 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36', o.exp ?? new Date(Date.now() + 86_400_000).toISOString()])

    it('lista solo las vigentes del usuario, marca la actual, describe el dispositivo y no expone el token', async () => {
      const userId = uid()
      await addSession(`${userId}_a`, userId)
      await addSession(`${userId}_b`, userId, { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604.1', ip: '190.2.3.4' })
      await addSession(`${userId}_old`, userId, { exp: new Date(Date.now() - 1000).toISOString() })
      await addSession(`other_${userId}`, `other_${userId}`)
      const list = await listSessionsWith(db, userId, `${userId}_a`)
      assert.equal(list.length, 2)
      assert.equal(list.find((s) => s.current)?.id, `${userId}_a`)
      assert.equal(list.find((s) => s.id === `${userId}_b`)?.device, 'Safari en iOS')
      assert.ok(!JSON.stringify(list).includes('secret'))
    })
    it('cierra una sesion propia; no la actual ni la de otra persona', async () => {
      const userId = uid()
      const other = uid()
      await addSession(`${userId}_a`, userId); await addSession(`${userId}_b`, userId); await addSession(`${other}_x`, other)
      assert.deepEqual(await revokeSessionWith(db, userId, `${userId}_a`, `${userId}_a`), { ok: false, reason: 'current' })
      assert.deepEqual(await revokeSessionWith(db, userId, `${other}_x`, `${userId}_a`), { ok: false, reason: 'not_found' })
      assert.deepEqual(await revokeSessionWith(db, userId, `${userId}_b`, `${userId}_a`), { ok: true })
      assert.equal((await listSessionsWith(db, other, null)).length, 1)
    })
    it('cerrar todas las demas deja solo la actual y no toca a otros usuarios', async () => {
      const userId = uid(); const other = uid()
      for (const s of ['a', 'b', 'c', 'd']) await addSession(`${userId}_${s}`, userId)
      await addSession(`${other}_x`, other)
      assert.deepEqual(await revokeOtherSessionsWith(db, userId, `${userId}_c`), { count: 3 })
      assert.deepEqual((await listSessionsWith(db, userId, `${userId}_c`)).map((s) => s.id), [`${userId}_c`])
      assert.equal((await listSessionsWith(db, other, null)).length, 1)
    })
    it('15 cierres simultaneos de la misma sesion: uno gana, el resto not_found', async () => {
      const userId = uid()
      await addSession(`${userId}_cur`, userId); await addSession(`${userId}_t`, userId)
      const r = await Promise.all(Array.from({ length: 15 }, () => revokeSessionWith(db, userId, `${userId}_t`, `${userId}_cur`)))
      assert.equal(r.filter((x) => x.ok).length, 1)
    })
  })
})