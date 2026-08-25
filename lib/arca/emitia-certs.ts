import fs from 'node:fs'
import path from 'node:path'

export type EmitiaAfipBundle = {
  certPem: string
  keyPem: string
  cuit: string
  environment: 'testing' | 'production'
  source: string
}

const AFIP_KEYS = new Set(['AFIP_CERT', 'AFIP_KEY', 'AFIP_CUIT', 'AFIP_ENVIRONMENT'])

function onVercel() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION)
}

function safeCwd() {
  try {
    return process.cwd()
  } catch {
    return ''
  }
}

function emitiaRoots() {
  const extra = process.env.EMITIA_ROOT?.trim()
  const cwd = safeCwd()
  const fromCwd = cwd
    ? [path.join(cwd, 'emitia'), path.join(cwd, '..', 'emitia')]
    : []
  return [
    extra,
    ...fromCwd,
    path.join(__dirname, '..', '..', 'emitia'),
    path.join(__dirname, '..', '..', '..', 'emitia'),
  ].filter((v): v is string => Boolean(v))
}

function isFile(file: string) {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function findEmitiaRoot() {
  if (onVercel()) return null
  for (const root of emitiaRoots()) {
    try {
      const abs = path.resolve(root)
      if (isFile(path.join(abs, 'certificates', 'afip-prod.crt'))) return abs
      if (isFile(path.join(abs, 'certificates', 'afip_private.key'))) return abs
      if (isFile(path.join(abs, '.env.local'))) return abs
    } catch {
      continue
    }
  }
  return null
}

function parseAfipEnv(file: string) {
  const out: Record<string, string> = {}
  try {
    if (!file || !isFile(file)) return out
    const text = fs.readFileSync(file, 'utf8')
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      if (!AFIP_KEYS.has(key)) continue
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      out[key] = value
    }
  } catch {
    return out
  }
  return out
}

function decodePem(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.includes('BEGIN')) return trimmed.replace(/\\n/g, '\n')
  return Buffer.from(trimmed, 'base64').toString('utf8')
}

function readIfExists(file: string) {
  try {
    if (!isFile(file)) return ''
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function bundleFromEnv(fromEmitia: Record<string, string> = {}): EmitiaAfipBundle | null {
  const environmentRaw = (
    process.env.AFIP_ENVIRONMENT ||
    fromEmitia.AFIP_ENVIRONMENT ||
    'production'
  ).toLowerCase()
  const environment: 'testing' | 'production' =
    environmentRaw === 'testing' || environmentRaw === 'homo' ? 'testing' : 'production'

  const certPem = decodePem(process.env.AFIP_CERT || fromEmitia.AFIP_CERT || '')
  const keyPem = decodePem(process.env.AFIP_KEY || fromEmitia.AFIP_KEY || '')
  const cuit = (process.env.AFIP_CUIT || fromEmitia.AFIP_CUIT || '').replace(/\D/g, '')
  if (!certPem || !keyPem || !cuit) return null
  return { certPem, keyPem, cuit, environment, source: 'env' }
}

let cached: EmitiaAfipBundle | null | undefined

export function loadEmitiaAfipBundle(): EmitiaAfipBundle | null {
  if (cached !== undefined) return cached

  try {
    const fromEnv = bundleFromEnv()
    if (fromEnv) {
      cached = fromEnv
      return cached
    }

    if (onVercel()) {
      cached = null
      return null
    }

    const root = findEmitiaRoot()
    const envFile = root ? path.join(root, '.env.local') : ''
    const fromEmitia = envFile ? parseAfipEnv(envFile) : {}

    const environmentRaw = (
      process.env.AFIP_ENVIRONMENT ||
      fromEmitia.AFIP_ENVIRONMENT ||
      'production'
    ).toLowerCase()
    const environment: 'testing' | 'production' =
      environmentRaw === 'testing' || environmentRaw === 'homo' ? 'testing' : 'production'
    const certName = environment === 'testing' ? 'afip-homo.crt' : 'afip-prod.crt'
    const certPem =
      decodePem(process.env.AFIP_CERT || '') ||
      (root ? readIfExists(path.join(root, 'certificates', certName)) : '') ||
      decodePem(fromEmitia.AFIP_CERT || '')
    const keyPem =
      decodePem(process.env.AFIP_KEY || '') ||
      (root ? readIfExists(path.join(root, 'certificates', 'afip_private.key')) : '') ||
      decodePem(fromEmitia.AFIP_KEY || '')
    const cuit = (process.env.AFIP_CUIT || fromEmitia.AFIP_CUIT || '').replace(/\D/g, '')

    if (!certPem || !keyPem || !cuit) {
      cached = null
      return cached
    }

    const cwd = safeCwd()
    cached = {
      certPem,
      keyPem,
      cuit,
      environment,
      source: root
        ? (cwd ? path.relative(cwd, path.join(root, 'certificates')) : 'emitia/certificates') ||
          'emitia/certificates'
        : 'emitia/.env.local',
    }
    return cached
  } catch (err) {
    console.warn('[arca] no se pudieron leer certificados Emitia:', (err as Error).message)
    cached = null
    return null
  }
}

export function applyEmitiaAfipEnv() {
  const bundle = loadEmitiaAfipBundle()
  if (!bundle) return null
  if (!process.env.AFIP_CUIT) process.env.AFIP_CUIT = bundle.cuit
  if (!process.env.AFIP_ENVIRONMENT) process.env.AFIP_ENVIRONMENT = bundle.environment
  return bundle
}
