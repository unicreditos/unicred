/**
 * CVU/CBU argentino: dos bloques con dígito verificador módulo 10.
 * En sandbox UNICRÉDITOS emite un CVU Prisma (prefijo 0003220) por cliente.
 */

import { createHash } from 'node:crypto'
import { isValidBankAlias, normalizeBankAlias } from '@/lib/finance'

function weightedCheck(digits: string, weights: number[]) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * weights[i]
  }
  return String((10 - (sum % 10)) % 10)
}

export function cbuBlock1Check(seven: string) {
  return weightedCheck(seven, [7, 1, 3, 9, 7, 1, 3])
}

export function cbuBlock2Check(thirteen: string) {
  return weightedCheck(thirteen, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])
}

export function isValidCbuOrCvu(value: string) {
  const d = String(value ?? '').replace(/\D/g, '')
  if (d.length !== 22) return false
  if (!/^\d{22}$/.test(d)) return false
  return d[7] === cbuBlock1Check(d.slice(0, 7)) && d[21] === cbuBlock2Check(d.slice(8, 21))
}

function digitsFromHex(hex: string, length: number) {
  const n = BigInt('0x' + hex)
  let mod = BigInt(1)
  for (let i = 0; i < length; i++) mod *= BigInt(10)
  return (n % mod).toString().padStart(length, '0')
}

export function buildSandboxCvu(userId: string) {
  const digest = createHash('sha256').update(`unicred-wallet:${userId}`).digest('hex')
  const block1 = `0003220${cbuBlock1Check('0003220')}`
  const account = digitsFromHex(digest.slice(0, 16), 13)
  return `${block1}${account}${cbuBlock2Check(account)}`
}

export function buildSandboxAlias(userId: string) {
  const slug = createHash('sha256').update(`unicred-alias:${userId}`).digest('hex').slice(0, 8)
  return `unicred.${slug}`
}

export type WalletDestination = {
  kind: 'cbu' | 'cvu' | 'alias'
  value: string
}

export function parseWalletDestination(raw: string): WalletDestination {
  const trimmed = String(raw ?? '').trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 22) {
    if (!isValidCbuOrCvu(digits)) throw new Error('CBU/CVU inválido. Revisá los 22 dígitos.')
    return { kind: digits.startsWith('000') ? 'cvu' : 'cbu', value: digits }
  }
  const alias = normalizeBankAlias(trimmed)
  if (!isValidBankAlias(alias)) {
    throw new Error('Ingresá un CBU o CVU de 22 dígitos, o un alias Coelsa (6 a 20 caracteres).')
  }
  return { kind: 'alias', value: alias }
}
