import { applyEmitiaAfipEnv } from '@/lib/arca/emitia-certs'
import {
  asArray,
  classifyTaxCondition,
  collectActivities,
  collectTaxes,
  dniFromPersonCuit,
  monotributoCategoryFromRaw,
  personTypeFromCuit,
  type ArcaActivity,
  type ArcaPersonType,
  type ArcaTax,
  type TaxCondition,
} from '@/lib/arca/tax-condition'
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
  personType: ArcaPersonType
  address: string
  city: string
  province: string
  postalCode: string
  /** Estado de la clave fiscal (ACTIVO, INACTIVO, …). */
  taxStatus: string
  taxCondition: TaxCondition
  monotributoCategory: string
  taxes: ArcaTax[]
  activities: ArcaActivity[]
  service: 'a13' | 'a5' | 'a4'
  /** Mensajes de errorConstancia (CUIT limitada, sin DDJJ, etc.). */
  constanciaErrors: string[]
}

function soapText(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const s = String(value).trim()
    return s === '[object Object]' ? '' : s
  }
  if (Array.isArray(value)) return soapText(value[0])
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>
    if ('$value' in rec) return soapText(rec.$value)
    if ('_' in rec) return soapText(rec._)
  }
  return ''
}

function firstObject(value: any): any {
  if (Array.isArray(value)) return firstObject(value[0])
  return value && typeof value === 'object' ? value : {}
}

function pickDomicilio(raw: any) {
  const list = asArray(raw?.domicilio ?? raw?.domicilioFiscal ?? raw?.datosGenerales?.domicilioFiscal)
  if (!list.length) return null
  return (
    list.find((d) => soapText(d?.tipoDomicilio).toUpperCase() === 'FISCAL') ??
    list[0]
  )
}

function unwrapConstancia(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  return (
    raw.personaReturn ??
    raw.getPersonaReturn ??
    raw.getPersona_v2Return ??
    raw.persona ??
    raw
  )
}

function generalBlock(raw: any): any {
  if (!raw || typeof raw !== 'object') return {}
  if (raw.datosGenerales) return firstObject(raw.datosGenerales)
  if (raw.persona) return firstObject(raw.persona)
  if (raw.errorConstancia && raw.razonSocial == null && raw.idPersona == null) return {}
  return raw
}

function errorConstanciaBlock(raw: any): any {
  const body = unwrapConstancia(raw)
  return firstObject(body?.errorConstancia ?? raw?.errorConstancia)
}

export function collectConstanciaErrors(raw: any): string[] {
  const block = errorConstanciaBlock(raw)
  return asArray(block?.error ?? block?.mensaje)
    .map((item) => soapText(item))
    .filter(Boolean)
}

function limitedKeyStatus(errors: string[]): string {
  const blob = errors.join(' ').toUpperCase()
  if (blob.includes('LIMITADA') || blob.includes('NO CONFIABLE') || blob.includes('CANCELADA')) {
    return 'LIMITADA'
  }
  return ''
}

export function mapArcaPersona(raw: any, service: ArcaPersona['service'] = 'a5'): ArcaPersona | null {
  const body = unwrapConstancia(raw)
  const persona = generalBlock(body)
  const constanciaErrors = collectConstanciaErrors(raw)
  if (!persona || typeof persona !== 'object') return null
  const cuil = soapText(
    persona.idPersona ?? persona.cuit ?? body?.idPersona ?? errorConstanciaBlock(raw)?.idPersona,
  ).replace(/\D/g, '')
  if (!/^\d{11}$/.test(cuil)) return null
  const name =
    soapText(persona.razonSocial) ||
    soapText(body?.razonSocial) ||
    [soapText(persona.apellido), soapText(persona.nombre)].filter(Boolean).join(', ') ||
    soapText(persona.denominacion)
  const dom = pickDomicilio(persona) ?? pickDomicilio(body)
  const doc = soapText(persona.numeroDocumento ?? persona.nroDocumento ?? body?.numeroDocumento).replace(/\D/g, '')
  const tipo = soapText(persona.tipoPersona || body?.tipoPersona).toUpperCase()
  const personType: ArcaPersonType =
    tipo === 'JURIDICA' ? 'JURIDICA' : tipo === 'FISICA' ? 'FISICA' : personTypeFromCuit(cuil)
  const taxStatus =
    soapText(persona.estadoClave ?? persona.estadoClaveFiscal ?? body?.estadoClave) ||
    limitedKeyStatus(constanciaErrors)
  const taxes = collectTaxes(body)
  const activities = collectActivities(body)
  const monotributoCategory = monotributoCategoryFromRaw(body)
  const dni =
    doc.length >= 7 && doc.length <= 8 ? doc : dniFromPersonCuit(cuil)
  return {
    cuil,
    dni,
    name,
    personType,
    address: soapText(dom?.direccion),
    city: soapText(dom?.localidad),
    province: AFIP_PROVINCIAS[soapText(dom?.idProvincia)] || soapText(dom?.descripcionProvincia),
    postalCode: soapText(dom?.codPostal ?? dom?.codigoPostal),
    taxStatus,
    taxCondition: classifyTaxCondition({
      keyStatus: taxStatus,
      taxes,
      monotributoCategory,
      raw: body,
    }),
    monotributoCategory,
    taxes,
    activities,
    service,
    constanciaErrors,
  }
}

export function mergeArcaPersona(a: ArcaPersona, b: ArcaPersona): ArcaPersona {
  const rank = (p: ArcaPersona) =>
    (p.name ? 8 : 0) +
    (p.address ? 4 : 0) +
    (p.taxes.length ? 2 : 0) +
    (p.taxCondition !== 'desconocida' && p.taxCondition !== 'no_inscripto' ? 2 : 0) +
    (p.service === 'a5' ? 1 : 0)
  const base = rank(b) > rank(a) ? b : a
  const other = base === a ? b : a
  return {
    ...base,
    name: base.name || other.name,
    dni: base.dni || other.dni,
    address: base.address || other.address,
    city: base.city || other.city,
    province: base.province || other.province,
    postalCode: base.postalCode || other.postalCode,
    taxStatus: base.taxStatus || other.taxStatus,
    taxCondition: base.taxCondition === 'desconocida' ? other.taxCondition : base.taxCondition,
    monotributoCategory: base.monotributoCategory || other.monotributoCategory,
    taxes: base.taxes.length ? base.taxes : other.taxes,
    activities: base.activities.length ? base.activities : other.activities,
    personType: base.personType === 'DESCONOCIDA' ? other.personType : base.personType,
    constanciaErrors: [...new Set([...base.constanciaErrors, ...other.constanciaErrors])],
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

type PadronAttempt = {
  service: string
  kind: keyof typeof WSDL
  method: string
  mappedKind: ArcaPersona['service']
}

async function fetchPadron(attempt: PadronAttempt, idPersona: string): Promise<ArcaPersona | null> {
  try {
    const client = await soapClient(attempt.kind)
    const payload = { ...(await auth(attempt.service)), idPersona }
    const [result] = await client[`${attempt.method}Async`](payload)
    return mapArcaPersona(result, attempt.mappedKind)
  } catch (err) {
    console.warn(`[arca] ${attempt.service} falló:`, ((err as Error).message ?? String(err)).slice(0, 180))
    return null
  }
}

function mergePersonas(rows: Array<ArcaPersona | null>): ArcaPersona | null {
  return rows.reduce<ArcaPersona | null>((acc, row) => {
    if (!row) return acc
    return acc ? mergeArcaPersona(acc, row) : row
  }, null)
}

export async function lookupPersonaByCuit(cuit: string): Promise<ArcaPersona | null> {
  const idPersona = cuit.replace(/\D/g, '')
  if (!/^\d{11}$/.test(idPersona)) return null

  let merged = mergePersonas(
    await Promise.all([
      fetchPadron(
        { service: 'ws_sr_constancia_inscripcion', kind: 'a5', method: 'getPersona_v2', mappedKind: 'a5' },
        idPersona,
      ),
      fetchPadron(
        { service: 'ws_sr_padron_a13', kind: 'a13', method: 'getPersona', mappedKind: 'a13' },
        idPersona,
      ),
    ]),
  )

  if (!merged?.name || !merged.address) {
    merged = mergePersonas([
      merged,
      await fetchPadron(
        { service: 'ws_sr_padron_a4', kind: 'a4', method: 'getPersona', mappedKind: 'a4' },
        idPersona,
      ),
    ])
  }
  return merged
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
