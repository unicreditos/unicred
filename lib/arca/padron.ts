import { applyEmitiaAfipEnv } from '@/lib/arca/emitia-certs'
import { getAFIPCredentials, getTicketAcceso } from '@/lib/arca/wsaa'

try {
  applyEmitiaAfipEnv()
} catch (err) {
  console.warn('[arca] padron: certificados no disponibles:', (err as Error).message)
}

const WSDL = {
  a13: {
    testing: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13?WSDL',
    production: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13?WSDL',
  },
  a5: {
    testing: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5?WSDL',
    production: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5?WSDL',
  },
  a4: {
    testing: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA4?WSDL',
    production: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA4?WSDL',
  },
} as const

const AFIP_PROVINCIAS: Record<string, string> = {
  '0': 'CABA',
  '1': 'Buenos Aires',
  '2': 'Catamarca',
  '3': 'Córdoba',
  '4': 'Corrientes',
  '5': 'Entre Ríos',
  '6': 'Jujuy',
  '7': 'Mendoza',
  '8': 'La Rioja',
  '9': 'Salta',
  '10': 'San Juan',
  '11': 'San Luis',
  '12': 'Santa Fe',
  '13': 'Santiago del Estero',
  '14': 'Tucumán',
  '16': 'Chaco',
  '17': 'Chubut',
  '18': 'Formosa',
  '19': 'Misiones',
  '20': 'Neuquén',
  '21': 'La Pampa',
  '22': 'Río Negro',
  '23': 'Santa Cruz',
  '24': 'Tierra del Fuego',
}

export type ArcaPersona = {
  cuil: string
  dni: string | null
  name: string
  personType: 'FISICA' | 'JURIDICA' | 'DESCONOCIDA'
  address: string
  city: string
  province: string
  postalCode: string
  taxStatus: string
  service: 'a13' | 'a5' | 'a4'
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function pickDomicilio(raw: any) {
  const list = asArray(raw?.domicilio ?? raw?.domicilioFiscal)
  if (!list.length) return null
  return (
    list.find((d) => String(d?.tipoDomicilio || '').toUpperCase() === 'FISCAL') ??
    list[0]
  )
}

function mapPersona(raw: any, service: ArcaPersona['service']): ArcaPersona | null {
  const persona = raw?.persona ?? raw?.datosGenerales ?? raw
  if (!persona || typeof persona !== 'object') return null
  const cuil = String(persona.idPersona ?? persona.cuit ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cuil)) return null
  const name =
    String(persona.razonSocial || '').trim() ||
    [persona.apellido, persona.nombre].filter(Boolean).join(', ').trim() ||
    String(persona.denominacion || '').trim()
  const dom = pickDomicilio(persona)
  const doc = String(persona.numeroDocumento ?? persona.nroDocumento ?? '').replace(/\D/g, '')
  const tipo = String(persona.tipoPersona || '').toUpperCase()
  return {
    cuil,
    dni: doc.length >= 7 && doc.length <= 8 ? doc : null,
    name,
    personType: tipo === 'JURIDICA' ? 'JURIDICA' : tipo === 'FISICA' ? 'FISICA' : 'DESCONOCIDA',
    address: String(dom?.direccion ?? ''),
    city: String(dom?.localidad ?? ''),
    province: AFIP_PROVINCIAS[String(dom?.idProvincia ?? '')] || String(dom?.descripcionProvincia ?? ''),
    postalCode: String(dom?.codPostal ?? dom?.codigoPostal ?? ''),
    taxStatus: String(persona.estadoClave ?? persona.estadoClaveFiscal ?? ''),
    service,
  }
}

async function soapClient(kind: keyof typeof WSDL) {
  const creds = getAFIPCredentials()
  if (!creds) throw new Error('sin_certificado')
  const soap = await import('soap')
  return soap.createClientAsync(WSDL[kind][creds.environment], {
    wsdl_options: { timeout: 25000 },
  })
}

async function auth(service: string) {
  const creds = getAFIPCredentials()
  if (!creds) throw new Error('sin_certificado')
  const ticket = await getTicketAcceso(service)
  return {
    token: ticket.token,
    sign: ticket.sign,
    cuitRepresentada: creds.cuit,
  }
}

export function arcaConfigured() {
  return Boolean(getAFIPCredentials())
}

export async function lookupPersonaByCuit(cuit: string): Promise<ArcaPersona | null> {
  const idPersona = cuit.replace(/\D/g, '')
  if (!/^\d{11}$/.test(idPersona)) return null

  const attempts: Array<{ service: string; kind: keyof typeof WSDL; method: string }> = [
    { service: 'ws_sr_padron_a13', kind: 'a13', method: 'getPersona' },
    { service: 'ws_sr_constancia_inscripcion', kind: 'a5', method: 'getPersona_v2' },
    { service: 'ws_sr_padron_a5', kind: 'a5', method: 'getPersona_v2' },
    { service: 'ws_sr_padron_a4', kind: 'a4', method: 'getPersona' },
  ]

  let lastError = ''
  for (const attempt of attempts) {
    try {
      const client = await soapClient(attempt.kind)
      const payload = { ...(await auth(attempt.service)), idPersona }
      const [result] = await client[`${attempt.method}Async`](payload)
      const body =
        result?.personaReturn ??
        result?.getPersonaReturn ??
        result?.getPersona_v2Return ??
        result
      const mapped = mapPersona(body, attempt.kind === 'a5' ? 'a5' : attempt.kind)
      if (mapped) return mapped
    } catch (err) {
      lastError = (err as Error).message ?? String(err)
      console.warn(`[arca] ${attempt.service} falló:`, lastError.slice(0, 180))
    }
  }
  if (lastError) console.warn('[arca] padrón sin resultado:', lastError.slice(0, 180))
  return null
}

export async function lookupCuitsByDocumento(documento: string): Promise<string[]> {
  const doc = documento.replace(/\D/g, '')
  if (doc.length < 7 || doc.length > 8) return []
  try {
    const client = await soapClient('a13')
    const payload = { ...(await auth('ws_sr_padron_a13')), documento: doc }
    const [result] = await client.getIdPersonaListByDocumentoAsync(payload)
    const raw =
      result?.idPersonaListReturn?.idPersona ??
      result?.personaReturn?.idPersona ??
      result?.idPersona
    return asArray(raw)
      .map((v) => String(v).replace(/\D/g, ''))
      .filter((v) => /^\d{11}$/.test(v))
  } catch (err) {
    console.warn('[arca] getIdPersonaListByDocumento:', ((err as Error).message ?? String(err)).slice(0, 180))
    return []
  }
}
