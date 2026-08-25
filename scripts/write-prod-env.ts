/**
 * Arma .env.production.local para el host.
 * No imprime secretos. No pisa .env.local de desarrollo.
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

const root = process.cwd()
const local = parseEnvFile(path.join(root, '.env.local'))
const emitia = parseEnvFile(path.join(root, 'emitia', '.env.local'))

const mpAccess =
  process.env.UNICRED_MP_LIVE_ACCESS_TOKEN ||
  (local.MERCADO_PAGO_ACCESS_TOKEN?.startsWith('APP_USR-') ? local.MERCADO_PAGO_ACCESS_TOKEN : '')
const mpPublic =
  process.env.UNICRED_MP_LIVE_PUBLIC_KEY ||
  (local.MERCADO_PAGO_PUBLIC_KEY?.startsWith('APP_USR-') ? local.MERCADO_PAGO_PUBLIC_KEY : '')

const authSecret = crypto.randomBytes(48).toString('base64')

const lines = [
  '# UNICRÉDITOS — SOLO host de produccion. No usar con npm run dev.',
  '# Cargalo en Vercel / el VPS como variables de entorno.',
  '',
  '# --- Sitio -------------------------------------------------',
  `NEXT_PUBLIC_SITE_URL='https://unicreditos.com'`,
  `NEXT_PUBLIC_BRAND_CUIT=${q(local.NEXT_PUBLIC_BRAND_CUIT || local.BRAND_CUIT || '30716036010')}`,
  `NEXT_PUBLIC_BRAND_ADDRESS=${q(local.NEXT_PUBLIC_BRAND_ADDRESS || local.BRAND_ADDRESS || '')}`,
  `NEXT_PUBLIC_BRAND_PHONE=${q(local.NEXT_PUBLIC_BRAND_PHONE || '')}`,
  `TREASURY_CBU=${q(local.TREASURY_CBU || '')}`,
  `BETTER_AUTH_URL='https://unicreditos.com'`,
  `BETTER_AUTH_TRUSTED_HOSTS='unicreditos.com,www.unicreditos.com,unicreditos.com.ar,www.unicreditos.com.ar,unicreditos.store,unicreditos.online'`,
  `BETTER_AUTH_SECRET=${q(authSecret)}`,
  '',
  '# --- Base --------------------------------------------------',
  `DATABASE_URL=${q(local.DATABASE_URL || '')}`,
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
  '# Pegar el secreto HMAC que muestra MP al crear el webhook de produccion.',
  `MERCADO_PAGO_WEBHOOK_SECRET=${q(local.MERCADO_PAGO_WEBHOOK_SECRET && !local.MERCADO_PAGO_ACCESS_TOKEN?.startsWith('TEST-') ? local.MERCADO_PAGO_WEBHOOK_SECRET : '')}`,
  '',
  '# --- Didit -------------------------------------------------',
  `DIDIT_API_KEY=${q(local.DIDIT_API_KEY || '')}`,
  `DIDIT_WORKFLOW_ID=${q(local.DIDIT_WORKFLOW_ID || '')}`,
  `DIDIT_APPLICATION_ID=${q(local.DIDIT_APPLICATION_ID || '')}`,
  '# Crear destino HTTPS en Didit y pegar secret_shared_key.',
  `DIDIT_WEBHOOK_SECRET=${q(local.DIDIT_WEBHOOK_SECRET || '')}`,
  '',
  '# --- Correo / CBU ------------------------------------------',
  `RESEND_API_KEY=${q(local.RESEND_API_KEY || '')}`,
  `EMAIL_FROM=${q(local.EMAIL_FROM || 'UNICRÉDITOS <no-responder@unicreditos.com>')}`,
  `ARGENAPI_API_KEY=${q(local.ARGENAPI_API_KEY || '')}`,
  `ARGENAPI_BASE_URL=${q(local.ARGENAPI_BASE_URL || 'https://www.argenapi.com/api/v1')}`,
  `ARGENAPI_TIMEOUT_MS=${q(local.ARGENAPI_TIMEOUT_MS || '10000')}`,
  '',
  '# --- ARCA / AFIP (certs de Emitia, ambiente produccion) ----',
  `AFIP_CUIT=${q(emitia.AFIP_CUIT || '')}`,
  `AFIP_ENVIRONMENT='production'`,
  `AFIP_CERT=${q(emitia.AFIP_CERT || '')}`,
  `AFIP_KEY=${q(emitia.AFIP_KEY || '')}`,
  '',
  'ALLOW_SESSION_OVERRIDE=false',
  '',
]

const dest = path.join(root, '.env.production.local')
fs.writeFileSync(dest, lines.join('\n'), 'utf8')

const missing: string[] = []
if (!mpAccess) missing.push('MERCADO_PAGO_ACCESS_TOKEN live')
if (!mpPublic) missing.push('MERCADO_PAGO_PUBLIC_KEY live')
if (!local.DIDIT_API_KEY) missing.push('DIDIT_API_KEY')
if (!local.DIDIT_WEBHOOK_SECRET) missing.push('DIDIT_WEBHOOK_SECRET')
if (!emitia.AFIP_CERT || !emitia.AFIP_KEY || !emitia.AFIP_CUIT) missing.push('AFIP_CERT/KEY/CUIT')

console.log(`Escrito ${dest}`)
console.log(`Falta completar: ${missing.length ? missing.join(', ') : 'nada de lo automatico'}`)
console.log('Todavia hay que crear en los paneles:')
console.log('  - Didit webhook → https://unicreditos.com/api/webhooks/didit')
console.log('  - MP webhook   → https://unicreditos.com/api/webhooks/mercadopago')
console.log('  - DNS de unicreditos.com (canónico) + alias .com.ar/.store/.online')
console.log('  - Verificar dominio en Resend antes de enviar mail transaccional')
