/** TOTP (RFC 6238) con node:crypto, sin dependencias. Funciones puras + cifrado del secreto y codigos de respaldo. */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const TOTP_PERIOD_S = 30
export const TOTP_DIGITS = 6
/** Pasos de tolerancia hacia atras/adelante (reloj del celular desfasado hasta ~30 s). */
export const TOTP_WINDOW = 1
export const BACKUP_CODE_COUNT = 10
export const TOTP_ATTEMPT_LIMIT = 5
export const TOTP_ATTEMPT_WINDOW_MS = 10 * 60_000

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx < 0) throw new Error('base32 invalido')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', secret).update(msg).digest()
  const off = h[h.length - 1] & 0x0f
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export const totpStep = (nowMs: number, period = TOTP_PERIOD_S) => Math.floor(nowMs / 1000 / period)

/** Devuelve el paso (counter) que coincide con el codigo dentro de la ventana, o null. Compara todos los pasos en tiempo constante. */
export function matchTotp(secret: Buffer, code: string, nowMs: number, window = TOTP_WINDOW, digits = TOTP_DIGITS): number | null {
  if (!new RegExp(`^\\d{${digits}}$`).test(code)) return null
  const cur = totpStep(nowMs)
  let found: number | null = null
  for (let s = cur - window; s <= cur + window; s++) {
    const expected = Buffer.from(hotp(secret, s, digits))
    if (timingSafeEqual(expected, Buffer.from(code)) && found === null) found = s
  }
  return found
}

export const generateTotpSecret = () => randomBytes(20)

export function otpauthUri(input: { secretBase32: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? 'UNICREDITOS'
  const label = encodeURIComponent(`${issuer}:${input.account}`)
  return `otpauth://totp/${label}?secret=${input.secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_S}`
}

// ---- Secreto cifrado en reposo (AES-256-GCM; la clave deriva del pepper; el userId va como dato autenticado) ----
const encKey = (pepper: string) => createHash('sha256').update(`totp-secret-key:${pepper}`).digest()

export function encryptSecret(plainBase32: string, pepper: string, userId: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', encKey(pepper), iv)
  c.setAAD(Buffer.from(userId))
  const ct = Buffer.concat([c.update(plainBase32, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':')
}

export function decryptSecret(blob: string, pepper: string, userId: string): string {
  const [v, iv, tag, ct] = blob.split(':')
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('secreto cifrado invalido')
  const d = createDecipheriv('aes-256-gcm', encKey(pepper), Buffer.from(iv, 'base64url'))
  d.setAAD(Buffer.from(userId))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
}

// ---- Codigos de respaldo: XXXXX-XXXXX (alfabeto sin ambiguos), hasheados con HMAC ----
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateBackupCodes(n = BACKUP_CODE_COUNT): string[] {
  const one = () => Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join('')
  return Array.from({ length: n }, () => {
    const c = one()
    return `${c.slice(0, 5)}-${c.slice(5)}`
  })
}

/** Acepta mayusculas/minusculas, espacios y guiones; devuelve null si no tiene la forma de un codigo de respaldo. */
export function normalizeBackupCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '')
  return new RegExp(`^[${BACKUP_ALPHABET}]{10}$`).test(c) ? c : null
}

export const hashBackupCode = (normalized: string, pepper: string) =>
  createHmac('sha256', pepper).update(`backup-code:${normalized}`).digest('hex')

export type FactorInput = { kind: 'totp'; code: string } | { kind: 'backup'; code: string } | { kind: 'invalid' }

/** Decide si lo tipeado es un codigo TOTP de 6 digitos o un codigo de respaldo. */
export function classifyFactorInput(raw: string): FactorInput {
  const t = raw.trim()
  if (/^\d{6}$/.test(t)) return { kind: 'totp', code: t }
  const n = normalizeBackupCode(t)
  return n ? { kind: 'backup', code: n } : { kind: 'invalid' }
}