/**
 * Arma .env.production.local para el host.
 * Preserva secretos ya guardados. No imprime secretos. No pisa .env.local de desarrollo.
 *
 * Uso:
 *   npx tsx scripts/write-prod-env.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadProjectEnv } from './load-env'

loadProjectEnv(path.join(process.cwd()))

function parseEnvFile(file: string) {
  const out: Record<string, string> = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

function q(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function secretBytes(n: number) {
  return crypto.randomBytes(n).toString('base64url')
}

const root = process.cwd()
const local = parseEnvFile(path.join(root, '.env.local'))
const prodExisting = parseEnvFile(path.join(root, '.env.production.local'))
const emitia = parseEnvFile(path.join(root, 'emitia', '.env.local'))

function pick(...keys: string[]) {
  for (const key of keys) {
    const value = prodExisting[key] ?? local[key] ?? process.env[key]
    if (value?.trim()) return value.trim()
  }
  return ''
}

const mpAccess =
  process.env.UNICRED_MP_LIVE_ACCESS_TOKEN ||
  pick('MERCADO_PAGO_ACCESS_TOKEN') ||
  (local.MERCADO_PAGO_ACCESS_TOKEN?.startsWith('APP_USR-') ? local.MERCADO_PAGO_ACCESS_TOKEN : '')
const mpPublic =
  process.env.UNICRED_MP_LIVE_PUBLIC_KEY ||
  pick('MERCADO_PAGO_PUBLIC_KEY') ||
  (local.MERCADO_PAGO_PUBLIC_KEY?.startsWith('APP_USR-') ? local.MERCADO_PAGO_PUBLIC_KEY : '')

const authSecret = pick('BETTER_AUTH_SECRET') || crypto.randomBytes(48).toString('base64')
const cronSecret = pick('CRON_SECRET') || secretBytes(32)
const paywayWebhookSecret = pick('PAYWAY_WEBHOOK_SECRET') || secretBytes(24)

const lines = [
  '# UNICRÉDITOS — SOLO host de produccion. No usar con npm run dev.',
  '# Cargalo en Vercel / el VPS como variables de entorno.',
  '',
  '# --- Sitio -------------------------------------------------',
  `NEXT_PUBLIC_SITE_URL='https://unicreditos.com'`,
  `NEXT_PUBLIC_BRAND_CUIT=${q(pick('NEXT_PUBLIC_BRAND_CUIT', 'BRAND_CUIT') || '30716036010')}`,
  `NEXT_PUBLIC_BRAND_ADDRESS=${q(pick('NEXT_PUBLIC_BRAND_ADDRESS', 'BRAND_ADDRESS'))}`,
  `NEXT_PUBLIC_BRAND_PHONE=${q(pick('NEXT_PUBLIC_BRAND_PHONE', 'BRAND_PHONE'))}`,
  `TREASURY_CBU=${q(pick('TREASURY_CBU'))}`,
  `BETTER_AUTH_URL='https://unicreditos.com'`,
  `BETTER_AUTH_TRUSTED_HOSTS='unicreditos.com,www.unicreditos.com,unicreditos.com.ar,www.unicreditos.com.ar,unicreditos.store,unicreditos.online'`,
  `BETTER_AUTH_SECRET=${q(authSecret)}`,
  '',
  '# --- Base --------------------------------------------------',
  `DATABASE_URL=${q(pick('DATABASE_URL'))}`,
  '',
  '# --- Mercado Pago LIVE (app unicred 8124126485542210) ------',
  `MERCADO_PAGO_ACCESS_TOKEN=${q(mpAccess)}`,
  `MERCADO_PAGO_PUBLIC_KEY=${q(mpPublic)}`,
  `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=${q(mpPublic)}`,
  `MERCADO_PAGO_CLIENT_ID='8124126485542210'`,
  `MERCADO_PAGO_USER_ID='2927120164'`,
  `MERCADO_PAGO_BASE_URL='https://api.mercadopago.com'`,
  `MERCADO_PAGO_REDIRECT_URL='https://unicreditos.com'`,
  `MERCADO_PAGO_NOTIFICATION_URL='https://unicreditos.com/api/webhooks/mercadopago'`,
  '# Secreto HMAC del webhook de Mercado Pago (panel → Webhooks).',
  `MERCADO_PAGO_WEBHOOK_SECRET=${q(
    pick('MERCADO_PAGO_WEBHOOK_SECRET') &&
      !pick('MERCADO_PAGO_ACCESS_TOKEN')?.startsWith('TEST-')
      ? pick('MERCADO_PAGO_WEBHOOK_SECRET')
      : pick('MERCADO_PAGO_WEBHOOK_SECRET'),
  )}`,
  '',
  '# --- Didit -------------------------------------------------',
  `DIDIT_API_KEY=${q(pick('DIDIT_API_KEY'))}`,
  `DIDIT_WORKFLOW_ID=${q(pick('DIDIT_WORKFLOW_ID'))}`,
  `DIDIT_APPLICATION_ID=${q(pick('DIDIT_APPLICATION_ID'))}`,
  '# secret_shared_key del destino HTTPS en Didit.',
  `DIDIT_WEBHOOK_SECRET=${q(pick('DIDIT_WEBHOOK_SECRET'))}`,
  '',
  '# --- Payway (sandbox hasta homologación) -------------------',
  `PAYWAY_ENV=${q(pick('PAYWAY_ENV') || 'sandbox')}`,
  `PAYWAY_BASE_URL=${q(pick('PAYWAY_BASE_URL') || 'https://api-sandbox.payway.com.ar')}`,
  `PAYWAY_SANDBOX_PUBLIC_KEY=${q(pick('PAYWAY_SANDBOX_PUBLIC_KEY'))}`,
  `PAYWAY_SANDBOX_SECRET_KEY=${q(pick('PAYWAY_SANDBOX_SECRET_KEY'))}`,
  `PAYWAY_SANDBOX_AUTH_B64=${q(pick('PAYWAY_SANDBOX_AUTH_B64'))}`,
  '# Secreto del webhook Payway (header o query). Generado si faltaba.',
  `PAYWAY_WEBHOOK_SECRET=${q(paywayWebhookSecret)}`,
  `PAYWAY_PROJECT_ID=${q(pick('PAYWAY_PROJECT_ID'))}`,
  '',
  '# --- Cron (Vercel inyecta Authorization: Bearer $CRON_SECRET) --',
  `CRON_SECRET=${q(cronSecret)}`,
  '',
  '# --- Correo / CBU ------------------------------------------',
  `RESEND_API_KEY=${q(pick('RESEND_API_KEY'))}`,
  `EMAIL_FROM=${q(pick('EMAIL_FROM') || 'UNICRÉDITOS <no-responder@unicreditos.com>')}`,
  `ARGENAPI_API_KEY=${q(pick('ARGENAPI_API_KEY'))}`,
  `ARGENAPI_BASE_URL=${q(pick('ARGENAPI_BASE_URL') || 'https://www.argenapi.com/api/v1')}`,
  `ARGENAPI_TIMEOUT_MS=${q(pick('ARGENAPI_TIMEOUT_MS') || '10000')}`,
  '',
  '# --- ARCA / AFIP (certs de Emitia, ambiente produccion) ----',
  `AFIP_CUIT=${q(pick('AFIP_CUIT') || emitia.AFIP_CUIT || '')}`,
  `AFIP_ENVIRONMENT='production'`,
  `AFIP_CERT=${q(pick('AFIP_CERT') || emitia.AFIP_CERT || '')}`,
  `AFIP_KEY=${q(pick('AFIP_KEY') || emitia.AFIP_KEY || '')}`,
  '',
  'ALLOW_SESSION_OVERRIDE=false',
  '',
]

const dest = path.join(root, '.env.production.local')
fs.writeFileSync(dest, lines.join('\n'), 'utf8')

const missing: string[] = []
if (!mpAccess) missing.push('MERCADO_PAGO_ACCESS_TOKEN live')
if (!mpPublic) missing.push('MERCADO_PAGO_PUBLIC_KEY live')
if (!pick('DIDIT_API_KEY')) missing.push('DIDIT_API_KEY')
if (!pick('DIDIT_WEBHOOK_SECRET')) missing.push('DIDIT_WEBHOOK_SECRET')
if (!pick('DATABASE_URL')) missing.push('DATABASE_URL')
if (!pick('RESEND_API_KEY')) missing.push('RESEND_API_KEY (correo transaccional)')
if (!pick('AFIP_CERT', 'AFIP_KEY', 'AFIP_CUIT') && !(emitia.AFIP_CERT && emitia.AFIP_KEY)) {
  missing.push('AFIP_CERT/KEY/CUIT')
}

console.log(`Escrito ${dest}`)
console.log(`Generado/preservado: CRON_SECRET, PAYWAY_WEBHOOK_SECRET, BETTER_AUTH_SECRET`)
console.log(`Falta completar: ${missing.length ? missing.join(', ') : 'nada de lo automatico'}`)
console.log('Subí las mismas variables a Vercel (Settings → Environment Variables).')
console.log('Webhooks en paneles externos:')
console.log('  - Didit  → https://unicreditos.com/api/webhooks/didit')
console.log('  - MP     → https://unicreditos.com/api/webhooks/mercadopago')
console.log('  - Payway → https://unicreditos.com/api/webhooks/payway (sandbox/homologación)')
