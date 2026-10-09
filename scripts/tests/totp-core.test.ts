import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  base32Decode,
  base32Encode,
  classifyFactorInput,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  hashBackupCode,
  hotp,
  matchTotp,
  normalizeBackupCode,
  otpauthUri,
  totpStep,
} from '../../lib/totp-core'

const RFC_SECRET = Buffer.from('12345678901234567890')

describe('TOTP (RFC 6238)', () => {
  it('coincide con los vectores de prueba oficiales (SHA-1, 8 digitos)', () => {
    const v: Array<[number, string]> = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']]
    for (const [t, code] of v) assert.equal(hotp(RFC_SECRET, totpStep(t * 1000), 8), code, `t=${t}`)
  })
  it('base32 ida y vuelta, y rechaza caracteres invalidos', () => {
    const b = Buffer.from('hola mundo seguro!')
    assert.deepEqual(base32Decode(base32Encode(b)), b)
    assert.equal(base32Encode(RFC_SECRET), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    assert.throws(() => base32Decode('abc1'))
  })
  it('ventana de +-1 paso: acepta el anterior y el siguiente, rechaza dos pasos', () => {
    const now = 1_700_000_000_000
    const cur = totpStep(now)
    assert.equal(matchTotp(RFC_SECRET, hotp(RFC_SECRET, cur), now), cur)
    assert.equal(matchTotp(RFC_SECRET, hotp(RFC_SECRET, cur - 1), now), cur - 1)
    assert.equal(matchTotp(RFC_SECRET, hotp(RFC_SECRET, cur + 1), now), cur + 1)
    assert.equal(matchTotp(RFC_SECRET, hotp(RFC_SECRET, cur - 2), now), null)
    assert.equal(matchTotp(RFC_SECRET, hotp(RFC_SECRET, cur + 2), now), null)
  })
  it('rechaza formatos que no son 6 digitos', () => {
    for (const c of ['', '12345', '1234567', 'abcdef', '12 456']) assert.equal(matchTotp(RFC_SECRET, c, Date.now()), null)
  })
  it('URI otpauth con emisor, cuenta codificada, 6 digitos y 30 s', () => {
    const u = otpauthUri({ secretBase32: 'ABC234', account: 'a+b@x.com' })
    assert.match(u, /^otpauth:\/\/totp\/UNICREDITOS%3Aa%2Bb%40x\.com\?secret=ABC234&issuer=UNICREDITOS&algorithm=SHA1&digits=6&period=30$/)
  })
})

describe('Secreto cifrado en reposo', () => {
  const pepper = 'pepper-de-prueba-0123456789'
  it('descifra lo cifrado, no deja el secreto en claro y cada cifrado es distinto', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP', pepper, 'u1')
    assert.ok(!a.includes('JBSWY3DPEHPK3PXP'))
    assert.match(a, /^v1:/)
    assert.equal(decryptSecret(a, pepper, 'u1'), 'JBSWY3DPEHPK3PXP')
    assert.notEqual(a, encryptSecret('JBSWY3DPEHPK3PXP', pepper, 'u1'))
  })
  it('falla con otro pepper, otro usuario (dato autenticado) o contenido alterado', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP', pepper, 'u1')
    assert.throws(() => decryptSecret(a, 'otro-pepper-distinto-0123', 'u1'))
    assert.throws(() => decryptSecret(a, pepper, 'u2'))
    const parts = a.split(':')
    parts[3] = Buffer.from('xxxxxxxxxxxxxxxxxxxx').toString('base64url')
    assert.throws(() => decryptSecret(parts.join(':'), pepper, 'u1'))
    assert.throws(() => decryptSecret('basura', pepper, 'u1'))
  })
})

describe('Codigos de respaldo', () => {
  it('10 codigos unicos con formato XXXXX-XXXXX', () => {
    const c = generateBackupCodes()
    assert.equal(c.length, 10)
    assert.equal(new Set(c).size, 10)
    for (const x of c) assert.match(x, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
  })
  it('normaliza minusculas, espacios y guiones; rechaza lo que no tiene forma', () => {
    assert.equal(normalizeBackupCode('abcde-fghjk'), 'ABCDEFGHJK')
    assert.equal(normalizeBackupCode(' ABCDE FGHJK '), 'ABCDEFGHJK')
    assert.equal(normalizeBackupCode('ABCDE-FGHJ'), null)
    assert.equal(normalizeBackupCode('ABCDE-FGHJ0'), null)
  })
  it('el hash depende del pepper y no es el codigo', () => {
    const h1 = hashBackupCode('ABCDEFGHJK', 'p1-0123456789abcdef')
    assert.match(h1, /^[0-9a-f]{64}$/)
    assert.notEqual(h1, hashBackupCode('ABCDEFGHJK', 'p2-0123456789abcdef'))
  })
  it('clasifica lo tipeado: 6 digitos = TOTP, codigo de respaldo, o invalido', () => {
    assert.deepEqual(classifyFactorInput(' 123456 '), { kind: 'totp', code: '123456' })
    assert.deepEqual(classifyFactorInput('abcde-fghjk'), { kind: 'backup', code: 'ABCDEFGHJK' })
    assert.deepEqual(classifyFactorInput('12345'), { kind: 'invalid' })
    assert.deepEqual(classifyFactorInput(''), { kind: 'invalid' })
  })
})