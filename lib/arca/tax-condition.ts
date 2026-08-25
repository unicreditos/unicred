/** Condición fiscal y tipo de persona a partir del padrón ARCA/AFIP. */

export type ArcaPersonType = 'FISICA' | 'JURIDICA' | 'DESCONOCIDA'

export type TaxCondition =
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento'
  | 'no_alcanzado'
  | 'no_inscripto'
  | 'desconocida'

export type ArcaTax = {
  id: string
  description: string
}

export type ArcaActivity = {
  id: string
  description: string
}

export const TAX_CONDITION_LABELS: Record<TaxCondition, string> = {
  monotributo: 'Monotributo',
  responsable_inscripto: 'IVA Responsable Inscripto',
  exento: 'IVA Exento',
  no_alcanzado: 'IVA no alcanzado',
  no_inscripto: 'No inscripto / clave inactiva',
  desconocida: 'Condición fiscal no informada',
}

const PERSON_PREFIXES = new Set(['20', '23', '24', '27'])
const COMPANY_PREFIXES = new Set(['30', '33', '34'])

/** Impuestos AFIP: 20/21 monotributo, 30 IVA, 32 IVA exento. */
const MONOTRIBUTO_TAX_IDS = new Set(['20', '21'])
const IVA_TAX_IDS = new Set(['30'])
const IVA_EXENTO_TAX_IDS = new Set(['32'])

const INACTIVE_KEYS = new Set([
  'INACTIVO',
  'BAJA',
  'SUSPENDIDO',
  'ANULADO',
  'NO ACTIVO',
  'INACTIVA',
])

export function digitsOnly(value: unknown) {
  return String(value ?? '').replace(/\D/g, '')
}

export function personTypeFromCuit(cuit: string): ArcaPersonType {
  const prefix = digitsOnly(cuit).slice(0, 2)
  if (PERSON_PREFIXES.has(prefix)) return 'FISICA'
  if (COMPANY_PREFIXES.has(prefix)) return 'JURIDICA'
  return 'DESCONOCIDA'
}

export function dniFromPersonCuit(cuit: string): string | null {
  const n = digitsOnly(cuit)
  if (n.length !== 11) return null
  if (!PERSON_PREFIXES.has(n.slice(0, 2))) return null
  return n.slice(2, 10).replace(/^0+/, '') || n.slice(2, 10)
}

export function normalizeKeyStatus(raw: string | null | undefined): string {
  const value = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
  return value
}

export function isActiveKeyStatus(raw: string | null | undefined) {
  const status = normalizeKeyStatus(raw)
  if (!status) return false
  if (INACTIVE_KEYS.has(status)) return false
  return status === 'ACTIVO' || status === 'ACTIVA' || status.includes('ACTIVO')
}

function taxId(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return digitsOnly(raw)
  const row = raw as Record<string, unknown>
  return digitsOnly(row.idImpuesto ?? row.id ?? row.codigo)
}

function taxDescription(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return String(raw ?? '').trim()
  const row = raw as Record<string, unknown>
  return String(row.descripcionImpuesto ?? row.descripcion ?? row.nombre ?? '').trim()
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function collectTaxes(raw: unknown): ArcaTax[] {
  const root = (raw ?? {}) as Record<string, unknown>
  const regimen = (root.datosRegimenGeneral ?? root.regimenGeneral ?? {}) as Record<string, unknown>
  const fromRegimen = asArray(regimen.impuesto ?? regimen.impuestos)
  const fromPersona = asArray(root.impuesto ?? root.impuestos)
  const fromMono = asArray(
    ((root.datosMonotributo ?? {}) as Record<string, unknown>).impuesto,
  )
  const seen = new Map<string, ArcaTax>()
  for (const item of [...fromRegimen, ...fromPersona, ...fromMono]) {
    const id = taxId(item)
    const description = taxDescription(item)
    if (!id && !description) continue
    const key = id || description.toUpperCase()
    if (!seen.has(key)) seen.set(key, { id, description })
  }
  return [...seen.values()]
}

export function collectActivities(raw: unknown): ArcaActivity[] {
  const root = (raw ?? {}) as Record<string, unknown>
  const regimen = (root.datosRegimenGeneral ?? {}) as Record<string, unknown>
  const mono = (root.datosMonotributo ?? {}) as Record<string, unknown>
  const list = [
    ...asArray(regimen.actividad ?? regimen.actividades),
    ...asArray(mono.actividadMonotributista ?? mono.actividad),
    ...asArray(root.actividad ?? root.actividades),
  ]
  const seen = new Map<string, ArcaActivity>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = String(row.idActividad ?? row.id ?? '').trim()
    const description = String(row.descripcionActividad ?? row.descripcion ?? '').trim()
    if (!id && !description) continue
    const key = id || description.toUpperCase()
    if (!seen.has(key)) seen.set(key, { id, description })
  }
  return [...seen.values()]
}

export function monotributoCategoryFromRaw(raw: unknown): string {
  const root = (raw ?? {}) as Record<string, unknown>
  const mono = (root.datosMonotributo ?? root) as Record<string, unknown>
  const categoria = (mono.categoriaMonotributo ?? mono.categoria ?? null) as Record<string, unknown> | null
  if (!categoria || typeof categoria !== 'object') return String(mono.descripcionCategoria ?? '').trim()
  return String(
    categoria.descripcionCategoria ?? categoria.descripcion ?? categoria.idCategoria ?? '',
  ).trim()
}

function looksLikeMonotributo(taxes: ArcaTax[], category: string, raw: unknown) {
  if (category) return true
  if (taxes.some((t) => MONOTRIBUTO_TAX_IDS.has(t.id))) return true
  const blob = JSON.stringify(raw ?? {}).toUpperCase()
  return blob.includes('DATOSMONOTRIBUTO') && blob.includes('CATEGORIA')
}

function looksLikeExento(taxes: ArcaTax[]) {
  return taxes.some(
    (t) =>
      IVA_EXENTO_TAX_IDS.has(t.id) ||
      /IVA\s*EXENT/i.test(t.description) ||
      /EXENTO/i.test(t.description),
  )
}

function looksLikeIva(taxes: ArcaTax[]) {
  return taxes.some(
    (t) =>
      IVA_TAX_IDS.has(t.id) ||
      /^IVA$/i.test(t.description) ||
      /RESPONSABLE\s*INSCRIPT/i.test(t.description),
  )
}

export function classifyTaxCondition(input: {
  keyStatus?: string | null
  taxes?: ArcaTax[]
  monotributoCategory?: string | null
  raw?: unknown
}): TaxCondition {
  if (input.keyStatus && !isActiveKeyStatus(input.keyStatus)) return 'no_inscripto'
  const taxes = input.taxes ?? collectTaxes(input.raw)
  const category = String(input.monotributoCategory ?? monotributoCategoryFromRaw(input.raw)).trim()
  if (looksLikeMonotributo(taxes, category, input.raw)) return 'monotributo'
  if (looksLikeExento(taxes)) return 'exento'
  if (looksLikeIva(taxes)) return 'responsable_inscripto'
  if (isActiveKeyStatus(input.keyStatus) && taxes.length === 0 && !category) return 'no_alcanzado'
  if (isActiveKeyStatus(input.keyStatus)) return 'no_alcanzado'
  return 'desconocida'
}

export function taxConditionLabel(condition: TaxCondition) {
  return TAX_CONDITION_LABELS[condition]
}

export function allowedMerchantTaxConditions(): TaxCondition[] {
  return ['monotributo', 'responsable_inscripto', 'exento']
}

export function isAllowedMerchantTaxCondition(condition: TaxCondition) {
  return allowedMerchantTaxConditions().includes(condition)
}
