import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  OTP_MAX_ATTEMPTS, OTP_TTL_MS, generateOtpCode, hashOtp, otpMatches, otpState, requireSecondFactorForEvidence, secondFactorFresh,
} from '../../lib/admin-otp-core'
import {
  evidenceResponseHeaders, hashMatches, isEvidenceKind, nextVersionDecision, parseDataUrl, sha256Of,
} from '../../lib/evidence-core'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

describe('Evidencia KYC: versionado, hash y entrega', () => {
  it('parsea data URLs de imagen/video y rechaza otros tipos', () => {
    const png = parseDataUrl('data:image/png;base64,' + Buffer.from('hola').toString('base64'))
    assert.equal(png?.mime, 'image/png')
    assert.equal(png?.bytes.toString(), 'hola')
    assert.equal(parseDataUrl('data:text/html;base64,PGI+'), null)
    assert.equal(parseDataUrl('https://x/y.png'), null)
    assert.equal(parseDataUrl(null), null)
  })
  it('hash SHA-256 verificable; un byte distinto falla', () => {
    const b = Buffer.from('documento')
    const h = sha256Of(b)
    assert.equal(hashMatches(b, h), true)
    assert.equal(hashMatches(Buffer.from('documentO'), h), false)
    assert.equal(hashMatches(b, 'zz'), false)
  })
  it('una verificacion nueva crea version N+1; el mismo contenido no duplica', () => {
    assert.deepEqual(nextVersionDecision(null, 'a'), { action: 'create', version: 1 })
    assert.deepEqual(nextVersionDecision({ version: 1, sha256: 'a' }, 'a'), { action: 'skip', version: 1 })
    assert.deepEqual(nextVersionDecision({ version: 2, sha256: 'a' }, 'b'), { action: 'create', version: 3 })
  })
  it('tipos validos y cabeceras de entrega sin cache', () => {
    assert.equal(isEvidenceKind('selfie'), true)
    assert.equal(isEvidenceKind('../etc'), false)
    const h = evidenceResponseHeaders({ mime: 'image/png', sha256: 'ab', filename: 'a b/../c.png', size: 3 })
    assert.match(h['Cache-Control'], /no-store/)
    assert.equal(h['X-Content-Type-Options'], 'nosniff')
    assert.match(h['Content-Security-Policy'], /default-src 'none'/)
    assert.doesNotMatch(h['Content-Disposition'], /\.\.\//)
  })
  it('la ruta de entrega exige permiso, 2FA, verifica hash y registra cada vista', () => {
    const r = src('app/api/admin/kyc-evidence/[userId]/[kind]/route.ts')
    assert.match(r, /requirePermission\('kyc\.review'\)/)
    assert.match(r, /hasFreshSecondFactor/)
    assert.match(r, /2FA_REQUIRED/)
    assert.match(r, /readEvidenceVerified/)
    assert.match(r, /INTEGRITY_FAILED/)
    assert.match(r, /logEvidenceAccess/)
    assert.match(r, /KYC_EVIDENCE_VIEWED/)
  })
  it('una verificacion nueva conserva la anterior antes de reemplazar las columnas', () => {
    const d = src('lib/didit.ts')
    assert.match(d, /preserveLegacyEvidence\(userId\)/)
    assert.match(d, /saveVersionedEvidence\(/)
    assert.match(d, /sameSession/)
  })
  it('el SQL es idempotente, inmutable y no se aplico automaticamente', () => {
    const q = src('scripts/sql/2026-10-09_02_kyc_evidence_and_admin_otp.sql')
    assert.match(q, /CREATE TABLE IF NOT EXISTS kyc_evidence/)
    assert.match(q, /CREATE TABLE IF NOT EXISTS kyc_evidence_access_log/)
    assert.match(q, /CREATE TABLE IF NOT EXISTS admin_email_otp/)
    assert.match(q, /es inmutable/)
    assert.doesNotMatch(q, /DROP TABLE|TRUNCATE|DELETE FROM/)
  })
})

describe('OTP por correo de operadores', () => {
  const pepper = 'p'.repeat(32)
  it('codigo de 6 digitos, solo se guarda el hash', () => {
    for (let i = 0; i < 50; i++) assert.match(generateOtpCode(), /^\d{6}$/)
    const h = hashOtp('123456', 'u1', pepper)
    assert.match(h, /^[0-9a-f]{64}$/)
    assert.doesNotMatch(h, /123456/)
    assert.equal(otpMatches('123456', 'u1', pepper, h), true)
    assert.equal(otpMatches('123457', 'u1', pepper, h), false)
    assert.equal(otpMatches('123456', 'u2', pepper, h), false)
    assert.equal(otpMatches('12345', 'u1', pepper, h), false)
  })
  it('expira a los 10 minutos, se bloquea al 5.o intento y no se reutiliza', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const fresh = { expiresAt: new Date(now.getTime() + OTP_TTL_MS), attempts: 0, usedAt: null }
    assert.equal(otpState(fresh, now), 'ok')
    assert.equal(otpState({ ...fresh, expiresAt: new Date(now.getTime() - 1) }, now), 'expired')
    assert.equal(otpState({ ...fresh, attempts: OTP_MAX_ATTEMPTS }, now), 'locked')
    assert.equal(otpState({ ...fresh, usedAt: now }, now), 'used')
    assert.equal(OTP_TTL_MS, 600000)
    assert.equal(OTP_MAX_ATTEMPTS, 5)
  })
  it('el segundo factor vale 30 minutos; el requisito se apaga solo con ADMIN_EVIDENCE_REQUIRE_2FA=no', () => {
    const now = new Date('2026-10-09T12:00:00Z')
    assert.equal(secondFactorFresh(new Date(now.getTime() - 10 * 60_000), now), true)
    assert.equal(secondFactorFresh(new Date(now.getTime() - 31 * 60_000), now), false)
    assert.equal(secondFactorFresh(null, now), false)
    assert.equal(requireSecondFactorForEvidence({}), true)
    assert.equal(requireSecondFactorForEvidence({ ADMIN_EVIDENCE_REQUIRE_2FA: 'no' }), false)
  })
  it('el envio usa sendEmail con brandedEmailHtml y falla cerrado; limita envios por hora', () => {
    const o = src('lib/admin-otp.ts')
    assert.match(o, /sendEmail\(/)
    assert.match(o, /brandedEmailHtml\(/)
    assert.match(o, /OTP_MAX_SENDS_PER_HOUR/)
    assert.doesNotMatch(o, /console\.(log|info)\([^)]*code/)
  })
})