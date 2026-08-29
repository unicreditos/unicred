/**
 * Reporta qué falta para producción sin imprimir secretos.
 */
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { checkEnv } from '../lib/env'

const prodFile = path.join(process.cwd(), '.env.production.local')
const existsSync = fs.existsSync
if (existsSync(prodFile)) dotenv.config({ path: prodFile, override: true })
else dotenv.config({ path: path.join(process.cwd(), '.env.local') })

function mask(name: string) {
  const v = process.env[name]
  if (!v) return 'FALTA'
  if (v.startsWith('TEST-')) return 'TEST (no sirve en prod)'
  if (name === 'RESEND_API_KEY' && !v.startsWith('re_')) return 'formato inválido (debe ser re_…)'
  if (v.includes('localhost')) return 'localhost (cambiar en el host)'
  return `ok (${v.length} chars)`
}

const checklist = [
  'NEXT_PUBLIC_SITE_URL',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'DATABASE_URL',
  'CRON_SECRET',
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_PUBLIC_KEY',
  'MERCADO_PAGO_WEBHOOK_SECRET',
  'DIDIT_API_KEY',
  'DIDIT_WORKFLOW_ID',
  'DIDIT_WEBHOOK_SECRET',
  'PAYWAY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'AFIP_CUIT',
  'AFIP_CERT',
  'AFIP_KEY',
] as const

console.log('Archivo .env.production.local:', existsSync(prodFile) ? 'presente' : 'no existe')
console.log('---')
for (const name of checklist) {
  console.log(`${name}: ${mask(name)}`)
}

const previous = process.env.NODE_ENV
process.env.NODE_ENV = 'production'
const report = checkEnv()
process.env.NODE_ENV = previous
if (report.missingRequired.length) {
  console.log('\nEl arranque en producción cortaría por:')
  for (const item of report.missingRequired) console.log(`  - ${item.name}: ${item.detail}`)
} else {
  console.log('\n✓ Variables obligatorias de producción: completas')
}

const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
if (site && !/^https:\/\/(www\.)?unicreditos\.com\/?$/i.test(site)) {
  console.log('\nAviso: NEXT_PUBLIC_SITE_URL no es https://unicreditos.com (canónico).')
}
if (process.env.VERCEL === '1') {
  console.log('\nAviso Vercel: comprobantes y avatares deben ir en DB/Blob (no public/uploads).')
}
if (process.env.ALLOW_SESSION_OVERRIDE === 'true') {
  console.log('\nBLOQUEO: ALLOW_SESSION_OVERRIDE=true no puede ir a producción.')
}
