import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  OTP_MAX_ATTEMPTS, OTP_MAX_SENDS_PER_HOUR, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, generateOtpCode,
} from '../../lib/admin-otp-core'
import { OtpError, issueOtp, verifyOtp, type MailResult, type OtpDeps, type OtpRecord, type OtpStore } from '../../lib/otp-service'
import { gateDecision, secondFactorRequiredFor } from '../../lib/second-factor-core'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

function harness(opts: { mail?: (code: string) => MailResult; production?: boolean } = {}) {
  let t = new Date('2026-10-09T12:00:00Z').getTime()
  const rows: OtpRecord[] = []
  const factors: Array<{ userId: string; sessionId: string }> = []
  const audits: Array<{ action: string; summary: string; changes?: Record<string, unknown> }> = []
  const mails: Array<{ to: string; code: string }> = []
  let n = 0
  const store: OtpStore = {
    async countSendsSince(userId, since) { return rows.filter((r) => r.userId === userId && r.createdAt > since).length },
    async latestCreatedAt(userId) { const x = rows.filter((r) => r.userId === userId).map((r) => r.createdAt.getTime()); return x.length ? new Date(Math.max(...x)) : null },
    async invalidateOpen(userId, now) { rows.filter((r) => r.userId === userId && !r.usedAt).forEach((r) => { r.usedAt = now }) },
    async insert(rec) { rows.push({ ...rec }) },
    async latest(userId) { const m = rows.filter((r) => r.userId === userId); return m.length ? { ...m[m.length - 1] } : null },
    async consumeAttempt(id, now) {
      const r = rows.find((x) => x.id === id)
      if (!r || r.usedAt || r.attempts >= OTP_MAX_ATTEMPTS || r.expiresAt <= now) return null
      r.attempts++
      return { ...r }
    },
    async markUsed(id, now) { const r = rows.find((x) => x.id === id); if (!r || r.usedAt) return false; r.usedAt = now; return true },
    async grantFactor({ userId, sessionId }) { factors.push({ userId, sessionId }) },
  }
  const deps: OtpDeps = {
    store,
    now: () => new Date(t),
    pepper: () => 'p'.repeat(32),
    production: opts.production ?? false,
    newId: (p) => `${p}_${++n}`,
    audit: async (e) => { audits.push({ action: e.action, summary: e.summary, changes: e.changes }) },
    sendMail: async ({ to, code }) => { mails.push({ to, code }); return opts.mail ? opts.mail(code) : { ok: true, delivered: true } },
  }
  return { deps, rows, factors, audits, mails, advance: (ms: number) => { t += ms }, last: () => mails[mails.length - 1].code }
}
const U = { userId: 'u1', email: 'a@b.com' }

describe('2FA por correo: generacion', () => {
  it('codigo de 6 digitos con CSPRNG (randomInt), bien repartido', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) { const c = generateOtpCode(); assert.match(c, /^\d{6}$/); seen.add(c) }
    assert.ok(seen.size > 290)
    assert.match(src('lib/admin-otp-core.ts'), /randomInt/)
    assert.doesNotMatch(src('lib/admin-otp-core.ts'), /Math\.random/)
  })
})

describe('2FA por correo: envio', () => {
  it('guarda solo el hash, manda el codigo por correo y audita sin incluirlo', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const code = h.last()
    assert.equal(h.mails[0].to, 'a@b.com')
    assert.doesNotMatch(JSON.stringify(h.rows), new RegExp(code))
    assert.match(h.rows[0].codeHash, /^[0-9a-f]{64}$/)
    assert.equal(h.audits[0].action, 'AUTH_2FA_CODE_SENT')
    assert.doesNotMatch(JSON.stringify(h.audits), new RegExp(code))
  })
  it('usa sendEmail + brandedEmailHtml', () => {
    const o = src('lib/admin-otp.ts')
    assert.match(o, /sendEmail\(/)
    assert.match(o, /brandedEmailHtml\(/)
  })
  it('falla cerrado: si el correo no sale el codigo queda invalido y se audita', async () => {
    const h = harness({ mail: () => ({ ok: false, delivered: false, error: 'resend 500' }) })
    await assert.rejects(issueOtp(h.deps, U), (e: unknown) => e instanceof OtpError && e.code === 'mail_failed')
    assert.ok(h.rows.every((r) => r.usedAt))
    assert.equal(h.audits.at(-1)?.action, 'AUTH_2FA_SEND_FAILED')
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code: '000000', sessionId: 's1' }), { ok: false, reason: 'none' })
  })
  it('en produccion sin confirmacion de entrega tambien falla cerrado', async () => {
    const h = harness({ production: true, mail: () => ({ ok: true, delivered: false }) })
    await assert.rejects(issueOtp(h.deps, U), (e: unknown) => e instanceof OtpError && e.code === 'mail_failed')
  })
  it('sin clave de firma no emite codigo', async () => {
    const h = harness()
    h.deps.pepper = () => { throw new Error('falta') }
    await assert.rejects(issueOtp(h.deps, U), (e: unknown) => e instanceof OtpError && e.code === 'config')
    assert.equal(h.rows.length, 0)
  })
})

describe('2FA por correo: validacion, vencimiento e intentos', () => {
  it('acepta el codigo correcto una sola vez y compara en tiempo constante', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const code = h.last()
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code, sessionId: 's1' }), { ok: true })
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code, sessionId: 's1' }), { ok: false, reason: 'none' })
    assert.match(src('lib/admin-otp-core.ts'), /timingSafeEqual/)
    assert.equal(h.audits.at(-1)?.action, 'AUTH_2FA_VERIFIED')
  })
  it('vence a los 10 minutos', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const code = h.last()
    h.advance(OTP_TTL_MS - 1000)
    const ok = await verifyOtp(h.deps, { ...U, code: '000000', sessionId: 's1' })
    assert.equal(ok.ok, false)
    h.advance(2000)
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code, sessionId: 's1' }), { ok: false, reason: 'expired' })
    assert.equal(OTP_TTL_MS, 600_000)
  })
  it('5 intentos: al 5.o fallido se invalida y ni el codigo correcto sirve', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const code = h.last()
    const wrong = code === '111111' ? '222222' : '111111'
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) assert.deepEqual(await verifyOtp(h.deps, { ...U, code: wrong, sessionId: 's1' }), { ok: false, reason: 'invalid' })
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code: wrong, sessionId: 's1' }), { ok: false, reason: 'locked' })
    assert.equal(h.audits.at(-1)?.action, 'AUTH_2FA_LOCKED')
    assert.equal((await verifyOtp(h.deps, { ...U, code, sessionId: 's1' })).ok, false)
  })
  it('acertar en el 5.o intento todavia sirve', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const code = h.last()
    const wrong = code === '111111' ? '222222' : '111111'
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) await verifyOtp(h.deps, { ...U, code: wrong, sessionId: 's1' })
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code, sessionId: 's1' }), { ok: true })
  })
  it('el descuento de intentos es atomico en la base', () => {
    const o = src('lib/admin-otp.ts')
    assert.match(o, /SET attempts = attempts \+ 1[\s\S]*"usedAt" IS NULL AND attempts < 5[\s\S]*RETURNING/)
    assert.equal(OTP_MAX_ATTEMPTS, 5)
  })
})

describe('2FA por correo: reenvio', () => {
  it('espera minima entre envios', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    await assert.rejects(issueOtp(h.deps, U), (e: unknown) => e instanceof OtpError && e.code === 'cooldown' && (e.retryAfterSec ?? 0) > 0)
    h.advance(OTP_RESEND_COOLDOWN_MS + 1)
    await issueOtp(h.deps, U)
    assert.equal(h.mails.length, 2)
  })
  it('un codigo nuevo invalida el anterior', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const first = h.last()
    h.advance(OTP_RESEND_COOLDOWN_MS + 1)
    await issueOtp(h.deps, U)
    const second = h.last()
    if (first !== second) assert.equal((await verifyOtp(h.deps, { ...U, code: first, sessionId: 's1' })).ok, false)
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code: second, sessionId: 's1' }), { ok: true })
  })
  it('maximo 5 envios por hora', async () => {
    const h = harness()
    for (let i = 0; i < OTP_MAX_SENDS_PER_HOUR; i++) { await issueOtp(h.deps, U); h.advance(OTP_RESEND_COOLDOWN_MS + 1) }
    await assert.rejects(issueOtp(h.deps, U), (e: unknown) => e instanceof OtpError && e.code === 'rate_limited')
    assert.equal(h.audits.at(-1)?.action, 'AUTH_2FA_SEND_LIMIT')
    h.advance(3_600_000)
    await issueOtp(h.deps, U)
  })
})

describe('2FA por correo: ligado a la sesion y gate', () => {
  it('el factor se concede a la sesion que valido; sin sesion no se concede', async () => {
    const h = harness()
    await issueOtp(h.deps, U)
    const code = h.last()
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code, sessionId: null }), { ok: false, reason: 'no_session' })
    assert.deepEqual(await verifyOtp(h.deps, { ...U, code, sessionId: 'sesion-A' }), { ok: true })
    assert.deepEqual(h.factors, [{ userId: 'u1', sessionId: 'sesion-A' }])
    assert.match(src('lib/second-factor.ts'), /"sessionId" = \$\{sessionId\}/)
  })
  it('flags apagados por defecto y decision del gate', () => {
    assert.equal(secondFactorRequiredFor('admin', {}), false)
    assert.equal(secondFactorRequiredFor('admin', { ADMIN_2FA_LOGIN: 'yes' }), true)
    assert.equal(secondFactorRequiredFor('customer', { CUSTOMER_2FA_LOGIN: 'yes' }), true)
    assert.equal(gateDecision(false, false), 'allow')
    assert.equal(gateDecision(true, false), 'challenge')
    assert.equal(gateDecision(true, true), 'allow')
  })
  it('el gate esta en requireAdmin, assertAdmin, requireCustomer, requireMerchant y assertRole', () => {
    const s = src('lib/session.ts')
    for (const fn of ['requireAdmin', 'assertAdmin', 'requireCustomer', 'requireMerchant', 'assertRole']) {
      const i = s.indexOf(`export async function ${fn}(`)
      assert.ok(i > 0, fn)
      const body = s.slice(i, s.indexOf('\n}\n', i))
      assert.match(body, /secondFactorSatisfied\(/, fn)
    }
  })
})

describe('2FA por correo: pantalla /verificar-2fa', () => {
  const f = src('components/auth/second-factor-form.tsx')
  it('formulario accesible con codigo, reenvio con cuenta regresiva y estados', () => {
    assert.match(f, /<form/)
    assert.match(f, /htmlFor="sf-code"/)
    assert.match(f, /autoComplete="one-time-code"/)
    assert.match(f, /inputMode="numeric"/)
    assert.match(f, /aria-live="polite"/)
    assert.match(f, /role="alert"/)
    assert.match(f, /Reenviar código \(\$\{cooldown\} s\)/)
    assert.match(f, /El código venció/)
    assert.match(f, /Superaste los 5 intentos/)
    assert.match(f, /minHeight: 44/)
    assert.match(f, /width: '100%'/)
  })
})