/**
 * Prueba de INTEGRACION del 2FA por correo contra un Postgres REAL (sin base real de la app).
 *   - Se omite sola si TEST_DATABASE_URL no esta definida (la suite normal sigue verde).
 *   - Se niega a correr si el host no es localhost/127.0.0.1 o si la base no termina en _test.
 *   - Aplica scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql SOLO a esa base de prueba.
 *   - El correo es un transporte FALSO (no se envia nada). No importa lib/db: nunca lee .env ni toca la base de la app.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from '../../lib/admin-otp-core'
import { createPgOtpStore, hasFreshSecondFactorWith, sessionPassedSecondFactorWith } from '../../lib/otp-pg-store'
import { OtpError, issueOtp, otpAuditEntry, verifyOtp, type MailResult, type OtpDeps } from '../../lib/otp-service'

const URL_ENV = process.env.TEST_DATABASE_URL
const MIN = 60_000

function assertSafeTestDb(raw: string) {
  const u = new URL(raw)
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error(`Prueba de integracion bloqueada: el host ${u.hostname} no es local.`)
  const name = decodeURIComponent(u.pathname.replace(/^\//, ''))
  if (!name.endsWith('_test')) throw new Error(`Prueba de integracion bloqueada: la base "${name}" no termina en _test.`)
}

describe('2FA por correo contra Postgres real', { skip: URL_ENV ? false : 'TEST_DATABASE_URL no definida: se omite' }, () => {
  let pool: pg.Pool
  let db: ReturnType<typeof drizzle>
  let seq = 0
  const mails: Array<{ to: string; code: string; at: number }> = []
  let mailMode: 'ok' | 'fail' | 'undelivered' = 'ok'

  before(async () => {
    assertSafeTestDb(URL_ENV!)
    pool = new pg.Pool({ connectionString: URL_ENV, max: 40 })
    db = drizzle(pool)
    for (const t of ['admin_email_otp', 'admin_second_factor', 'kyc_evidence_access_log', 'kyc_evidence', 'admin_audit_log']) {
      await pool.query(`DROP TABLE IF EXISTS ${t} CASCADE`)
    }
    await pool.query(readFileSync(new URL('../../scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql', import.meta.url), 'utf8'))
    // Idempotencia: aplicarlo dos veces no debe fallar.
    await pool.query(readFileSync(new URL('../../scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql', import.meta.url), 'utf8'))
    await pool.query(`CREATE TABLE admin_audit_log (id text PRIMARY KEY, "actorUserId" text, "actorEmail" text, action text NOT NULL, "entityType" text NOT NULL, "entityId" text, "targetUserId" text, severity text NOT NULL DEFAULT 'info', summary text NOT NULL, changes jsonb, "createdAt" timestamptz NOT NULL DEFAULT now())`)
  })
  after(async () => { await pool?.end() })

  function ctx(start = '2026-10-09T12:00:00Z', opts: { production?: boolean } = {}) {
    let t = new Date(start).getTime()
    const userId = `u_${Date.now()}_${++seq}`
    const deps: OtpDeps = {
      store: createPgOtpStore(db),
      now: () => new Date(t),
      pepper: () => 'integration-test-pepper-0123456789',
      production: opts.production ?? false,
      newId: (p) => `${p}_${userId}_${++seq}_${Math.random().toString(36).slice(2, 8)}`,
      async audit(e) {
        const a = otpAuditEntry(e)
        await pool.query(
          `INSERT INTO admin_audit_log (id, "actorUserId", action, "entityType", "entityId", "targetUserId", severity, summary, changes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [`a_${Math.random().toString(36).slice(2)}_${++seq}`, a.actorUserId, a.action, a.entityType, a.entityId, a.targetUserId, a.severity, a.summary, a.changes ? JSON.stringify(a.changes) : null],
        )
      },
      async sendMail({ to, code }): Promise<MailResult> {
        if (mailMode === 'fail') return { ok: false, delivered: false, error: 'fake transport down' }
        mails.push({ to, code, at: t })
        return mailMode === 'undelivered' ? { ok: true, delivered: false } : { ok: true, delivered: true }
      },
    }
    return { userId, deps, email: `${userId}@example.test`, advance: (ms: number) => { t += ms }, lastCode: () => mails.filter((m) => m.to.startsWith(userId)).at(-1)!.code }
  }
  const wrongOf = (code: string) => (code === '000000' ? '999999' : '000000')
  const rowsOf = async (userId: string) => (await pool.query(`SELECT * FROM admin_email_otp WHERE "userId" = $1 ORDER BY "createdAt"`, [userId])).rows
  const auditOf = async (userId: string) => (await pool.query(`SELECT action, summary, changes FROM admin_audit_log WHERE "targetUserId" = $1 ORDER BY "createdAt", id`, [userId])).rows

  it('el SQL se aplica dos veces sin errores (idempotente) y crea las tablas', async () => {
    const r = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('admin_email_otp','admin_second_factor','kyc_evidence','kyc_evidence_access_log')`)
    assert.equal(r.rows.length, 4)
  })

  it('genera, envia por transporte falso y guarda solo el hash; audita sin el codigo', async () => {
    mailMode = 'ok'
    const c = ctx()
    const out = await issueOtp(c.deps, { userId: c.userId, email: c.email, ip: '10.0.0.1' })
    const code = c.lastCode()
    assert.match(code, /^\d{6}$/)
    const [row] = await rowsOf(c.userId)
    assert.match(row.codeHash, /^[0-9a-f]{64}$/)
    assert.notEqual(row.codeHash, code)
    assert.equal(new Date(row.expiresAt).getTime() - new Date(row.createdAt).getTime(), OTP_TTL_MS)
    assert.equal(out.resendAfterSec, 60)
    const audit = await auditOf(c.userId)
    assert.equal(audit[0].action, 'AUTH_2FA_CODE_SENT')
    assert.doesNotMatch(JSON.stringify(audit), new RegExp(code))
    const dump = JSON.stringify((await pool.query(`SELECT * FROM admin_email_otp WHERE "userId" = $1`, [c.userId])).rows)
    assert.doesNotMatch(dump, new RegExp(`"${code}"`))
  })

  it('valida una sola vez y deja el factor ligado a la sesion', async () => {
    const c = ctx()
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    const code = c.lastCode()
    assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code, sessionId: 'sesion-A' }), { ok: true })
    assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code, sessionId: 'sesion-B' }), { ok: false, reason: 'none' })
    assert.equal(await sessionPassedSecondFactorWith(db, c.userId, 'sesion-A'), true)
    assert.equal(await sessionPassedSecondFactorWith(db, c.userId, 'sesion-B'), false)
    assert.equal(await sessionPassedSecondFactorWith(db, c.userId, null), false)
    assert.equal(await sessionPassedSecondFactorWith(db, 'otro-usuario', 'sesion-A'), false)
    assert.equal(await hasFreshSecondFactorWith(db, c.userId, 'sesion-A', c.deps.now()), true)
    assert.equal(await hasFreshSecondFactorWith(db, c.userId, 'sesion-B', c.deps.now()), false)
    assert.equal((await pool.query(`SELECT 1 FROM admin_second_factor WHERE "userId" = $1`, [c.userId])).rows.length, 1)
    assert.ok((await auditOf(c.userId)).some((a) => a.action === 'AUTH_2FA_VERIFIED'))
  })

  it('sin sesion no se concede el factor', async () => {
    const c = ctx()
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code: c.lastCode(), sessionId: null }), { ok: false, reason: 'no_session' })
    assert.equal((await pool.query(`SELECT 1 FROM admin_second_factor WHERE "userId" = $1`, [c.userId])).rows.length, 0)
  })

  it('vence a los 10 minutos con reloj controlado (a 9:59 sirve, a 10:01 no)', async () => {
    const a = ctx()
    await issueOtp(a.deps, { userId: a.userId, email: a.email })
    a.advance(OTP_TTL_MS - 1000)
    assert.deepEqual(await verifyOtp(a.deps, { userId: a.userId, code: a.lastCode(), sessionId: 's' }), { ok: true })
    const b = ctx()
    await issueOtp(b.deps, { userId: b.userId, email: b.email })
    b.advance(OTP_TTL_MS + 1000)
    assert.deepEqual(await verifyOtp(b.deps, { userId: b.userId, code: b.lastCode(), sessionId: 's' }), { ok: false, reason: 'expired' })
  })

  it('5 intentos fallidos secuenciales invalidan el codigo, tambien el correcto; queda auditado', async () => {
    const c = ctx()
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    const code = c.lastCode()
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code: wrongOf(code), sessionId: 's' }), { ok: false, reason: 'invalid' })
    assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code: wrongOf(code), sessionId: 's' }), { ok: false, reason: 'locked' })
    const [row] = await rowsOf(c.userId)
    assert.equal(row.attempts, 5)
    assert.ok(row.usedAt)
    assert.equal((await verifyOtp(c.deps, { userId: c.userId, code, sessionId: 's' })).ok, false)
    const actions = (await auditOf(c.userId)).map((a) => a.action)
    assert.equal(actions.filter((x) => x === 'AUTH_2FA_FAILED').length, 4)
    assert.equal(actions.filter((x) => x === 'AUTH_2FA_LOCKED').length, 1)
  })

  it('CONCURRENCIA: 25 intentos fallidos en paralelo consumen exactamente 5 y luego ni el correcto pasa', async () => {
    const c = ctx()
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    const code = c.lastCode()
    const res = await Promise.all(Array.from({ length: 25 }, (_, i) => verifyOtp(c.deps, { userId: c.userId, code: wrongOf(code), sessionId: `s${i}` })))
    assert.ok(res.every((r) => !r.ok))
    const [row] = await rowsOf(c.userId)
    assert.equal(row.attempts, OTP_MAX_ATTEMPTS)
    const afterwards = await Promise.all(Array.from({ length: 10 }, (_, i) => verifyOtp(c.deps, { userId: c.userId, code, sessionId: `z${i}` })))
    assert.ok(afterwards.every((r) => !r.ok))
    assert.equal((await pool.query(`SELECT 1 FROM admin_second_factor WHERE "userId" = $1`, [c.userId])).rows.length, 0)
  })

  it('CONCURRENCIA: 30 validaciones del codigo correcto en paralelo, solo una pasa (un solo uso)', async () => {
    const c = ctx()
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    const code = c.lastCode()
    const res = await Promise.all(Array.from({ length: 30 }, (_, i) => verifyOtp(c.deps, { userId: c.userId, code, sessionId: `s${i}` })))
    assert.equal(res.filter((r) => r.ok).length, 1)
    assert.equal((await pool.query(`SELECT 1 FROM admin_second_factor WHERE "userId" = $1`, [c.userId])).rows.length, 1)
  })

  it('CONCURRENCIA: 20 aciertos y fallos mezclados nunca superan 5 intentos ni 1 aprobacion', async () => {
    for (let round = 0; round < 5; round++) {
      const c = ctx()
      await issueOtp(c.deps, { userId: c.userId, email: c.email })
      const code = c.lastCode()
      const mix = Array.from({ length: 20 }, (_, i) => (i % 4 === 0 ? code : wrongOf(code)))
      const res = await Promise.all(mix.map((cd, i) => verifyOtp(c.deps, { userId: c.userId, code: cd, sessionId: `s${i}` })))
      const [row] = await rowsOf(c.userId)
      assert.ok(row.attempts <= OTP_MAX_ATTEMPTS, `attempts=${row.attempts}`)
      assert.ok(res.filter((r) => r.ok).length <= 1)
      assert.equal((await pool.query(`SELECT 1 FROM admin_second_factor WHERE "userId" = $1`, [c.userId])).rows.length, res.filter((r) => r.ok).length)
    }
  })

  it('reenvio: espera de 60 s, el codigo anterior queda invalido y solo sirve el nuevo', async () => {
    const c = ctx()
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    const first = c.lastCode()
    c.advance(OTP_RESEND_COOLDOWN_MS - 1000)
    await assert.rejects(issueOtp(c.deps, { userId: c.userId, email: c.email }), (e: unknown) => e instanceof OtpError && e.code === 'cooldown' && e.retryAfterSec === 1)
    c.advance(1500)
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
    const second = c.lastCode()
    const rows = await rowsOf(c.userId)
    assert.equal(rows.length, 2)
    assert.ok(rows[0].usedAt)
    if (first !== second) assert.equal((await verifyOtp(c.deps, { userId: c.userId, code: first, sessionId: 's' })).ok, false)
    assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code: second, sessionId: 's' }), { ok: true })
  })

  it('maximo 5 envios por hora y se libera pasada la hora', async () => {
    const c = ctx()
    for (let i = 0; i < OTP_MAX_SENDS_PER_HOUR; i++) {
      await issueOtp(c.deps, { userId: c.userId, email: c.email })
      c.advance(OTP_RESEND_COOLDOWN_MS + 1000)
    }
    await assert.rejects(issueOtp(c.deps, { userId: c.userId, email: c.email }), (e: unknown) => e instanceof OtpError && e.code === 'rate_limited')
    assert.equal(mails.filter((m) => m.to.startsWith(c.userId)).length, OTP_MAX_SENDS_PER_HOUR)
    assert.ok((await auditOf(c.userId)).some((a) => a.action === 'AUTH_2FA_SEND_LIMIT'))
    c.advance(3_600_000)
    await issueOtp(c.deps, { userId: c.userId, email: c.email })
  })

  it('CONCURRENCIA: 12 pedidos de envio en paralelo, solo uno se envia (espera de 60 s)', async () => {
    mailMode = 'ok'
    const c = ctx()
    const res = await Promise.allSettled(Array.from({ length: 12 }, () => issueOtp(c.deps, { userId: c.userId, email: c.email })))
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(mails.filter((m) => m.to.startsWith(c.userId)).length, 1)
    assert.equal((await rowsOf(c.userId)).length, 1)
  })

  it('CONCURRENCIA: 12 envios en paralelo con la hora casi agotada no superan 5 por hora', async () => {
    const c = ctx()
    for (let i = 0; i < OTP_MAX_SENDS_PER_HOUR - 1; i++) {
      await issueOtp(c.deps, { userId: c.userId, email: c.email })
      c.advance(OTP_RESEND_COOLDOWN_MS + 1000)
    }
    const res = await Promise.allSettled(Array.from({ length: 12 }, () => issueOtp(c.deps, { userId: c.userId, email: c.email })))
    assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1)
    assert.ok((await rowsOf(c.userId)).length <= OTP_MAX_SENDS_PER_HOUR)
  })

  it('falla cerrado: si el transporte falla el codigo queda invalido, se audita y no hay factor', async () => {
    mailMode = 'fail'
    const c = ctx()
    await assert.rejects(issueOtp(c.deps, { userId: c.userId, email: c.email }), (e: unknown) => e instanceof OtpError && e.code === 'mail_failed')
    mailMode = 'ok'
    const rows = await rowsOf(c.userId)
    assert.ok(rows.length >= 1 && rows.every((r) => r.usedAt))
    assert.deepEqual(await verifyOtp(c.deps, { userId: c.userId, code: '123456', sessionId: 's' }), { ok: false, reason: 'none' })
    assert.ok((await auditOf(c.userId)).some((a) => a.action === 'AUTH_2FA_SEND_FAILED'))
    assert.equal((await pool.query(`SELECT 1 FROM admin_second_factor WHERE "userId" = $1`, [c.userId])).rows.length, 0)
  })

  it('falla cerrado en produccion cuando el proveedor no confirma la entrega', async () => {
    mailMode = 'undelivered'
    const c = ctx('2026-10-09T12:00:00Z', { production: true })
    await assert.rejects(issueOtp(c.deps, { userId: c.userId, email: c.email }), (e: unknown) => e instanceof OtpError && e.code === 'mail_failed')
    mailMode = 'ok'
    assert.ok((await rowsOf(c.userId)).every((r) => r.usedAt))
  })
})