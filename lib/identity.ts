import { arcaConfigured, lookupCuitsByDocumento, lookupPersonaByCuit } from '@/lib/arca/padron'
import { taxConditionLabel, type TaxCondition } from '@/lib/arca/tax-condition'
import { getDeudas, getDeudasHistoricas, isValidCuit, normalizeCuit } from '@/lib/bcra'

export type AccountKind = 'persona' | 'comercio'

export type IdentitySource = {
  id: 'checksum' | 'bcra' | 'arca'
  ok: boolean
  label: string
  detail: string
}

export type IdentityMatch = {
  cuil: string
  dni: string | null
  name: string
  personType: 'FISICA' | 'JURIDICA' | 'DESCONOCIDA'
  address: string
  city: string
  province: string
  postalCode: string
  taxStatus: string
  taxCondition: TaxCondition | ''
  taxConditionLabel: string
  monotributoCategory: string
  sources: IdentitySource[]
}

export type IdentityLookupResult =
  | {
      ok: true
      inputKind: 'cuit' | 'dni'
      match: IdentityMatch
      alternatives: IdentityMatch[]
      alreadyRegistered: boolean
      needsUserName: boolean
    }
  | { ok: false; error: string }

const PERSON_PREFIXES = [20, 27, 23, 24]
const COMPANY_PREFIXES = [30, 33, 34]

function checkDigit(first10: string): string {
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += Number(first10[i]) * factors[i]
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return String(expected)
}

export function buildCuit(prefix: number, dni: string): string {
  const body = `${prefix}${dni.replace(/\D/g, '').padStart(8, '0')}`
  return `${body}${checkDigit(body)}`
}

export function dniFromCuit(cuit: string): string | null {
  const n = normalizeCuit(cuit)
  if (!/^\d{11}$/.test(n)) return null
  if (!['20', '23', '24', '27'].includes(n.slice(0, 2))) return null
  return n.slice(2, 10).replace(/^0+/, '') || n.slice(2, 10)
}

function emptyMatch(cuil: string): IdentityMatch {
  return {
    cuil,
    dni: dniFromCuit(cuil),
    name: '',
    personType: 'DESCONOCIDA',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    taxStatus: '',
    taxCondition: '',
    taxConditionLabel: '',
    monotributoCategory: '',
    sources: [],
  }
}

async function lookupArcaPadron(cuit: string): Promise<Partial<IdentityMatch> | null> {
  if (!arcaConfigured()) return null
  const persona = await lookupPersonaByCuit(cuit)
  if (!persona) return null
  return {
    name: persona.name,
    personType: persona.personType,
    address: persona.address,
    city: persona.city,
    province: persona.province,
    postalCode: persona.postalCode,
    taxStatus: persona.taxStatus,
    taxCondition: persona.taxCondition,
    taxConditionLabel: taxConditionLabel(persona.taxCondition),
    monotributoCategory: persona.monotributoCategory,
    dni: persona.dni,
  }
}

async function enrichFromPublicApis(cuit: string): Promise<IdentityMatch> {
  const match = emptyMatch(cuit)
  match.sources.push({
    id: 'checksum',
    ok: true,
    label: 'Clave fiscal',
    detail: 'CUIT/CUIL válido (dígito verificador AFIP/ARCA).',
  })

  const arca = await lookupArcaPadron(cuit)
  if (arca) {
    match.name = arca.name || match.name
    match.personType = arca.personType || match.personType
    match.address = arca.address || match.address
    match.city = arca.city || match.city
    match.province = arca.province || match.province
    match.postalCode = arca.postalCode || match.postalCode
    match.taxStatus = arca.taxStatus || match.taxStatus
    match.taxCondition = arca.taxCondition || match.taxCondition
    match.taxConditionLabel = arca.taxConditionLabel || match.taxConditionLabel
    match.monotributoCategory = arca.monotributoCategory || match.monotributoCategory
    match.dni = arca.dni || match.dni
    match.sources.push({
      id: 'arca',
      ok: Boolean(arca.name),
      label: 'ARCA',
      detail: arca.name
        ? `Padrón de contribuyentes. ${arca.taxConditionLabel || arca.taxStatus || ''}`.trim()
        : 'Sin datos nominativos en el padrón configurado.',
    })
  } else {
    match.sources.push({
      id: 'arca',
      ok: false,
      label: 'ARCA',
      detail: arcaConfigured()
        ? 'El padrón no devolvió datos para esta clave. Puede no estar inscripta o el servicio no estar habilitado en el certificado.'
        : 'Falta el certificado WSAA (AFIP_CERT / AFIP_KEY) para leer el padrón.',
    })
  }

  const [deudas, historicas] = await Promise.all([getDeudas(cuit), getDeudasHistoricas(cuit)])
  const denominacion = deudas.denominacion || historicas.denominacion || ''
  if (denominacion) {
    match.name = match.name || denominacion
    if (match.personType === 'DESCONOCIDA') {
      match.personType = dniFromCuit(cuit) ? 'FISICA' : 'JURIDICA'
    }
    match.sources.push({
      id: 'bcra',
      ok: true,
      label: 'BCRA',
      detail: 'Denominación informada en Central de Deudores.',
    })
  } else {
    match.sources.push({
      id: 'bcra',
      ok: !deudas.unavailable && !historicas.unavailable,
      label: 'BCRA',
      detail: deudas.unavailable
        ? 'La Central de Deudores no respondió en este momento.'
        : 'Sin denominación vigente. El CUIT es válido; confirmá tu nombre.',
    })
  }

  return match
}

export async function lookupIdentity(raw: string, kind: AccountKind): Promise<IdentityLookupResult> {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return { ok: false, error: 'Ingresá tu CUIT, CUIL o DNI.' }

  if (digits.length >= 7 && digits.length <= 8) {
    const fromPadron = await lookupCuitsByDocumento(digits)
    const prefixes = kind === 'comercio' ? [...PERSON_PREFIXES, ...COMPANY_PREFIXES] : PERSON_PREFIXES
    const guessed = prefixes.map((prefix) => buildCuit(prefix, digits))
    const candidates = Array.from(new Set(fromPadron.length ? fromPadron : guessed))
    const enriched = await Promise.all(candidates.map((cuit) => enrichFromPublicApis(cuit)))
    const named = enriched.filter((row) => row.name)
    const match = named[0] ?? enriched[0]
    return {
      ok: true,
      inputKind: 'dni',
      match: { ...match, dni: digits },
      alternatives: enriched
        .filter((row) => row.cuil !== match.cuil)
        .map((row) => ({ ...row, dni: digits })),
      alreadyRegistered: false,
      needsUserName: !match.name,
    }
  }

  if (digits.length !== 11) {
    return { ok: false, error: 'Usá un DNI (7 u 8 dígitos) o un CUIT/CUIL de 11 dígitos.' }
  }
  if (!isValidCuit(digits)) {
    return { ok: false, error: 'Ese CUIT/CUIL no supera el dígito verificador. Revisá el número.' }
  }

  const match = await enrichFromPublicApis(digits)
  if (kind === 'persona' && match.dni) {
    match.dni = match.dni
  }
  return {
    ok: true,
    inputKind: 'cuit',
    match,
    alternatives: [],
    alreadyRegistered: false,
    needsUserName: !match.name,
  }
}
