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

export function getAFIPCredentials() {
  try {
    const bundle = applyEmitiaAfipEnv() ?? loadEmitiaAfipBundle()
    if (!bundle) return null
    return {
      certPem: bundle.certPem,
      keyPem: bundle.keyPem,
      cuit: bundle.cuit,
      environment: bundle.environment,
    }
  } catch (err) {
    console.warn('[arca] no se pudieron cargar credenciales AFIP:', (err as Error).message)
    return null
  }
}

function cacheDir() {
  try {
    return path.join(process.cwd(), '.afip-cache')
  } catch {
    return ''
  }
}

function readFileCache(key: string): TicketAcceso | null {
  try {
    const dir = cacheDir()
    if (!dir) return null
    const file = path.join(dir, `${key}.json`)
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8')) as TicketAcceso
  } catch {
    return null
  }
}

function writeFileCache(key: string, ticket: TicketAcceso) {
  try {
    const dir = cacheDir()
    if (!dir) return
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(ticket))
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
