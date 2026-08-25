import {
  dniFromPersonCuit,
  isActiveKeyStatus,
  isAllowedMerchantTaxCondition,
  personTypeFromCuit,
  taxConditionLabel,
  type ArcaPersonType,
  type TaxCondition,
} from '@/lib/arca/tax-condition'
import type { ArcaPersona } from '@/lib/arca/padron'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'

export type RepresentativeRole = 'titular' | 'apoderado' | 'presidente' | 'socio_gerente' | 'administrador'

export type MerchantDocType = 'estatuto_contrato_social' | 'acta_designacion' | 'poder'

export const MERCHANT_DOC_LABELS: Record<MerchantDocType, string> = {
  estatuto_contrato_social: 'Estatuto o contrato social',
  acta_designacion: 'Acta de designación de autoridades',
  poder: 'Poder / mandato vigente',
}

export const ALLOWED_MERCHANT_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
export const MERCHANT_DOC_MAX_BYTES = 4 * 1024 * 1024
export const MERCHANT_DOC_MIN_BYTES = 1024

export type MerchantKybStatus = 'incomplete' | 'ready_for_review' | 'approved' | 'rejected'

export type TitularMatch = 'matched' | 'mismatch' | 'pending_pj' | 'missing_identity'

export type MerchantKybInput = {
  declaredCuit: string
  padron: ArcaPersona | null
  padronConfigured: boolean
  titular: {
    diditApproved: boolean
    dni: string | null
    cuil: string | null
    name?: string | null
  }
  representativeRole: RepresentativeRole
  uploadedDocTypes: MerchantDocType[]
}

export type MerchantKybResult = {
  cuit: string
  cuitValid: boolean
  personType: ArcaPersonType
  taxCondition: TaxCondition
  taxConditionLabel: string
  taxStatus: string
  legalName: string
  address: string
  city: string
  province: string
  postalCode: string
  monotributoCategory: string
  titularMatch: TitularMatch
  requiredDocuments: MerchantDocType[]
  missingDocuments: MerchantDocType[]
  blockers: string[]
  warnings: string[]
  canPersist: boolean
  canSubmit: boolean
  canActivate: boolean
  kybStatus: MerchantKybStatus
}

function normalizeDni(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

export function requiredMerchantDocuments(
  personType: ArcaPersonType,
  role: RepresentativeRole,
): MerchantDocType[] {
  if (personType !== 'JURIDICA') return []
  const docs: MerchantDocType[] = ['estatuto_contrato_social']
  if (role === 'apoderado') docs.push('poder')
  else docs.push('acta_designacion')
  return docs
}

export function matchTitularToCuit(input: {
  personType: ArcaPersonType
  cuit: string
  padronDni: string | null
  titularDni: string | null
  titularCuil: string | null
}): TitularMatch {
  if (input.personType === 'JURIDICA') return 'pending_pj'
  const titularDni = normalizeDni(input.titularDni)
  const padronDni = normalizeDni(input.padronDni) || normalizeDni(dniFromPersonCuit(input.cuit))
  const titularCuil = normalizeCuit(input.titularCuil ?? '')
  const cuit = normalizeCuit(input.cuit)
  if (!titularDni && !titularCuil) return 'missing_identity'
  if (titularCuil && titularCuil === cuit) return 'matched'
  if (titularDni && padronDni && titularDni === padronDni) return 'matched'
  return 'mismatch'
}

export function evaluateMerchantKyb(input: MerchantKybInput): MerchantKybResult {
  const cuit = normalizeCuit(input.declaredCuit)
  const cuitValid = isValidCuit(cuit)
  const padron = input.padron
  const personType = padron?.personType && padron.personType !== 'DESCONOCIDA'
    ? padron.personType
    : personTypeFromCuit(cuit)
  const taxCondition = padron?.taxCondition ?? 'desconocida'
  const taxStatus = padron?.taxStatus ?? ''
  const requiredDocuments = requiredMerchantDocuments(personType, input.representativeRole)
  const uploaded = new Set(input.uploadedDocTypes)
  const missingDocuments = requiredDocuments.filter((type) => !uploaded.has(type))
  const titularMatch = matchTitularToCuit({
    personType,
    cuit,
    padronDni: padron?.dni ?? null,
    titularDni: input.titular.dni,
    titularCuil: input.titular.cuil,
  })

  const blockers: string[] = []
  const warnings: string[] = []
  const hard: string[] = []
  const soft: string[] = []

  if (!cuitValid) {
    hard.push('El CUIT no supera el dígito verificador de AFIP.')
  }
  if (!input.padronConfigured) {
    hard.push('El padrón ARCA no está configurado en este entorno. No se puede dar de alta un comercio sin constancia oficial.')
  } else if (!padron) {
    hard.push('ARCA no devolvió la constancia de inscripción para ese CUIT. No se acepta un alta auto-declarada.')
  }
  if (padron && !isActiveKeyStatus(padron.taxStatus)) {
    hard.push(`La clave fiscal no está activa en ARCA (${padron.taxStatus || 'sin estado'}).`)
  }
  if (padron?.constanciaErrors?.length) {
    hard.push(padron.constanciaErrors[0])
  }
  if (padron && !isAllowedMerchantTaxCondition(padron.taxCondition)) {
    hard.push(
      `La condición fiscal (${taxConditionLabel(padron.taxCondition)}) no habilita adhesión como comercio. Se admite monotributo, IVA responsable inscripto o IVA exento.`,
    )
  }
  if (!input.titular.diditApproved) {
    hard.push('El titular o representante tiene que tener Didit aprobado (DNI + prueba de vida).')
  }
  if (titularMatch === 'mismatch') {
    hard.push('El DNI/CUIL verificado con Didit no coincide con el CUIT persona física consultado en ARCA.')
  }
  if (titularMatch === 'missing_identity') {
    hard.push('Falta el DNI o CUIL del titular verificado para cruzarlo con el padrón.')
  }
  if (personType === 'JURIDICA' && missingDocuments.length) {
    soft.push(
      `Persona jurídica: faltan ${missingDocuments.map((d) => MERCHANT_DOC_LABELS[d]).join(', ')}. La constancia AFIP se toma del padrón; no se carga a mano.`,
    )
  }
  blockers.push(...hard, ...soft)
  if (padron && !padron.name) {
    warnings.push('ARCA no informó la razón social. Completá el nombre solo si coincide con la constancia.')
  }
  if (personType === 'JURIDICA') {
    warnings.push('Didit verifica a la persona que representa al comercio. La sociedad se valida con ARCA y con el expediente societario.')
  }

  const canPersist = hard.length === 0
  const canSubmit = hard.length === 0 && soft.length === 0
  return {
    cuit,
    cuitValid,
    personType,
    taxCondition,
    taxConditionLabel: taxConditionLabel(taxCondition),
    taxStatus,
    legalName: padron?.name ?? '',
    address: padron?.address ?? '',
    city: padron?.city ?? '',
    province: padron?.province ?? '',
    postalCode: padron?.postalCode ?? '',
    monotributoCategory: padron?.monotributoCategory ?? '',
    titularMatch,
    requiredDocuments,
    missingDocuments,
    blockers,
    warnings,
    canPersist,
    canSubmit,
    canActivate: canSubmit,
    kybStatus: canSubmit ? 'ready_for_review' : 'incomplete',
  }
}

export function validateMerchantUpload(input: { mime: string; size: number; type: string }) {
  const type = input.type as MerchantDocType
  if (!(type in MERCHANT_DOC_LABELS)) {
    return { ok: false as const, error: 'Tipo de documento no admitido.' }
  }
  if (!ALLOWED_MERCHANT_DOC_MIME.includes(input.mime as (typeof ALLOWED_MERCHANT_DOC_MIME)[number])) {
    return { ok: false as const, error: 'Solo se aceptan PDF, JPG, PNG o WEBP.' }
  }
  if (input.size < MERCHANT_DOC_MIN_BYTES) {
    return { ok: false as const, error: 'El archivo está vacío o es demasiado chico.' }
  }
  if (input.size > MERCHANT_DOC_MAX_BYTES) {
    return { ok: false as const, error: 'El archivo supera 4 MB.' }
  }
  return { ok: true as const, type }
}
