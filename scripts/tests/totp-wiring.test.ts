import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { secondFactorRequiredFor } from '../../lib/second-factor-core'

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('TOTP / sesiones / login: cableado', () => {
  it('las flags de login siguen apagadas por defecto', () => {
    assert.equal(secondFactorRequiredFor('admin', {}), false)
    assert.equal(secondFactorRequiredFor('customer', {}), false)
  })
  it('el gate tambien desafia a quien activo la app autenticadora, aunque la flag este apagada', () => {
    const s = src('lib/session.ts')
    assert.match(s, /!secondFactorRequiredFor\(role\) && !\(await userHasTotp\(userId\)\)/)
    assert.match(src('lib/totp.ts'), /42P01/)
  })
  it('todas las rutas TOTP delegan en un handler y los POST rechazan otro origen', () => {
    for (const r of ['begin', 'confirm', 'verify', 'disable', 'regenerate']) assert.match(src(`app/api/2fa/totp/${r}/route.ts`), /export async function POST/)
    assert.match(src('app/api/2fa/status/route.ts'), /export async function GET/)
    const a = src('lib/totp-api.ts')
    assert.equal((a.match(/rejectCrossOrigin\(req\)/g) ?? []).length, 5)
  })
  it('alta, desactivar y regenerar exigen clave actual; desactivar/regenerar ademas un codigo vigente sin abrir la sesion', () => {
    const a = src('lib/totp-api.ts')
    assert.match(a, /handleBegin[\s\S]*verifyCurrentPassword/)
    assert.match(a, /async function reauth[\s\S]*verifyCurrentPassword[\s\S]*grant: false/)
    assert.match(a, /handleDisable[\s\S]*reauth\(req\)/)
    assert.match(a, /handleRegenerate[\s\S]*reauth\(req\)/)
  })
  it('enrolar, desactivar y regenerar exigen haber pasado el segundo factor ya exigido; el paso de verificar no', () => {
    const a = src('lib/totp-api.ts')
    const verify = a.slice(a.indexOf('export async function handleVerifyTotp'), a.indexOf('async function reauth'))
    assert.ok(!verify.includes('sessionSecondFactorOk'))
    assert.ok((a.match(/sessionSecondFactorOk\(/g) ?? []).length >= 3)
  })
  it('el secreto cifrado y los codigos de respaldo nunca se escriben en logs', () => {
    for (const f of ['lib/totp.ts', 'lib/totp-store.ts', 'lib/totp-api.ts', 'lib/totp-core.ts', 'lib/reauth.ts']) assert.ok(!/console\.(log|warn|error|info)/.test(src(f)), f)
  })
  it('sesiones: exige sesion y segundo factor, audita el cierre y nunca consulta el token', () => {
    const r = src('app/api/account/sessions/route.ts')
    assert.equal((r.match(/sessionSecondFactorOk/g) ?? []).length, 3)
    assert.match(r, /SESSION_REVOKED/)
    assert.match(r, /SESSIONS_REVOKED_ALL/)
    assert.match(r, /rejectCrossOrigin\(req\)/)
    assert.ok(!/token/i.test(src('lib/sessions-store.ts').replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/Nunca se selecciona el token[^\n]*/, '')))
  })
  it('el formulario de ingreso pide el segundo factor dentro del mismo flujo', () => {
    const f = src('components/auth-form.tsx')
    assert.match(f, /\/api\/2fa\/status/)
    assert.match(f, /<SecondFactorForm/)
    assert.match(f, /st\.required && !st\.passed/)
  })
  it('el selector ofrece app y correo; el correo sigue como alternativa', () => {
    const f = src('components/auth/second-factor-form.tsx')
    assert.match(f, /App autenticadora/)
    assert.match(f, /<EmailPanel/)
    assert.match(f, /aria-pressed/)
  })
  it('SQL 04 es idempotente y no guarda el secreto ni los codigos en claro', () => {
    const s = src('scripts/sql/2026-10-09_04_totp_backup_codes.sql')
    for (const t of ['user_totp', 'user_backup_code']) assert.match(s, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`))
    assert.match(s, /"secretEnc"/)
    assert.match(s, /"codeHash"\s+char\(64\)/)
    assert.ok(!/CREATE TABLE (?!IF NOT EXISTS)/.test(s))
  })
})