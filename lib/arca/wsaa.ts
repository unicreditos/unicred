import fs from 'node:fs'
import path from 'node:path'
import * as forge from 'node-forge'
import { applyEmitiaAfipEnv, loadEmitiaAfipBundle } from '@/lib/arca/emitia-certs'
import '@/lib/arca/tls-compat'

const WSAA = {
  testing: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL',
  production: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL',
} as const

export type AfipEnv = 'testing' | 'production'

export type TicketAcceso = {
  token: string
  sign: string
  expirationTime: string
  generationTime: string
}

const mem = new Map<string, TicketAcceso>()

function argTime(d: Date) {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return `${local.toISOString().replace(/\.\d{3}Z$/, '')}-03:00`
}

function traXml(service: string) {
  const now = new Date()
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${argTime(new Date(now.getTime() - 10 * 60 * 1000))}</generationTime>
    <expirationTime>${argTime(new Date(now.getTime() + 12 * 60 * 60 * 1000))}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`
}

function signCms(xml: string, certPem: string, keyPem: string) {
  const cert = forge.pki.certificateFromPem(certPem)
  const key = forge.pki.privateKeyFromPem(keyPem)
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(xml, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  })
  p7.sign()
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
}

function decodePem(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes('BEGIN')) return trimmed.replace(/\\n/g, '\n')
  return Buffer.from(trimmed, 'base64').toString('utf8')
}

function resolveExisting(...candidates: string[]) {
  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel)
    if (fs.existsSync(abs)) return abs
  }
  return null
}

export function getAFIPCredentials() {
  const fromEmitia = applyEmitiaAfipEnv() ?? loadEmitiaAfipBundle()
  if (fromEmitia) {
    return {
      certPem: fromEmitia.certPem,
      keyPem: fromEmitia.keyPem,
      cuit: fromEmitia.cuit,
      environment: fromEmitia.environment,
    }
  }

  const cuit = (process.env.AFIP_CUIT ?? '').replace(/\D/g, '')
  const raw = (process.env.AFIP_ENVIRONMENT || 'production').toLowerCase()
  const environment: AfipEnv = raw === 'testing' || raw === 'homo' ? 'testing' : 'production'
  const certEnv = process.env.AFIP_CERT
  const keyEnv = process.env.AFIP_KEY

  let certPem = certEnv ? decodePem(certEnv) : ''
  let keyPem = keyEnv ? decodePem(keyEnv) : ''

  if (!certPem || !keyPem) {
    const certPath = resolveExisting(
      process.env.AFIP_CERT_PATH || '',
      'certificates/afip-prod.crt',
    )
    const keyPath = resolveExisting(
      process.env.AFIP_KEY_PATH || '',
      'certificates/afip_private.key',
    )
    if (certPath) certPem = fs.readFileSync(certPath, 'utf8')
    if (keyPath) keyPem = fs.readFileSync(keyPath, 'utf8')
  }

  if (!certPem || !keyPem || !cuit) return null
  return { certPem, keyPem, cuit, environment }
}

function cacheDir() {
  return path.join(process.cwd(), '.afip-cache')
}

function readFileCache(key: string): TicketAcceso | null {
  try {
    const file = path.join(cacheDir(), `${key}.json`)
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8')) as TicketAcceso
  } catch {
    return null
  }
}

function writeFileCache(key: string, ticket: TicketAcceso) {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true })
    fs.writeFileSync(path.join(cacheDir(), `${key}.json`), JSON.stringify(ticket))
  } catch {
    /* ignore */
  }
}

function stillValid(ticket: TicketAcceso) {
  return new Date(ticket.expirationTime).getTime() - Date.now() > 5 * 60 * 1000
}

export async function getTicketAcceso(service: string): Promise<TicketAcceso> {
  const creds = getAFIPCredentials()
  if (!creds) throw new Error('Faltan certificado, clave o AFIP_CUIT')
  const cacheKey = `${service}_${creds.environment}`
  const cached = mem.get(cacheKey) || readFileCache(cacheKey)
  if (cached && stillValid(cached)) {
    mem.set(cacheKey, cached)
    return cached
  }

  const soap = await import('soap')
  const { Parser } = await import('xml2js')
  const cms = signCms(traXml(service), creds.certPem, creds.keyPem)
  const client = await soap.createClientAsync(WSAA[creds.environment], {
    wsdl_options: { timeout: 30000 },
  })
  const [result] = await client.loginCmsAsync({ in0: cms })
  const parsed = await new Parser({ explicitArray: false }).parseStringPromise(result.loginCmsReturn)
  const ticket: TicketAcceso = {
    token: parsed.loginTicketResponse.credentials.token,
    sign: parsed.loginTicketResponse.credentials.sign,
    expirationTime: parsed.loginTicketResponse.header.expirationTime,
    generationTime: parsed.loginTicketResponse.header.generationTime,
  }
  mem.set(cacheKey, ticket)
  writeFileCache(cacheKey, ticket)
  return ticket
}
