import type { ArcaPersona } from '@/lib/arca/padron'
import { taxConditionLabel, type TaxCondition } from '@/lib/arca/tax-condition'

export type ArcaConstanciaSnapshot = {
  cuil: string
  name: string
  personType: string
  taxStatus: string
  taxCondition: string
  taxConditionLabel: string
  monotributoCategory: string
  taxes: Array<{ id: string; description: string }>
  activities: Array<{ id: string; description: string }>
  address: string
  city: string
  province: string
  postalCode: string
  service: string
  constanciaErrors: string[]
  consultedAt: string
}

export function snapshotFromPersona(persona: ArcaPersona, consultedAt = new Date().toISOString()): ArcaConstanciaSnapshot {
  return {
    cuil: persona.cuil,
    name: persona.name,
    personType: persona.personType,
    taxStatus: persona.taxStatus,
    taxCondition: persona.taxCondition,
    taxConditionLabel: taxConditionLabel(persona.taxCondition as TaxCondition),
    monotributoCategory: persona.monotributoCategory,
    taxes: persona.taxes,
    activities: persona.activities,
    address: persona.address,
    city: persona.city,
    province: persona.province,
    postalCode: persona.postalCode,
    service: persona.service,
    constanciaErrors: persona.constanciaErrors ?? [],
    consultedAt,
  }
}

export function parseConstanciaSnapshot(raw: unknown): ArcaConstanciaSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const cuil = String(row.cuil ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cuil)) return null
  return {
    cuil,
    name: String(row.name ?? ''),
    personType: String(row.personType ?? ''),
    taxStatus: String(row.taxStatus ?? ''),
    taxCondition: String(row.taxCondition ?? ''),
    taxConditionLabel: String(row.taxConditionLabel ?? ''),
    monotributoCategory: String(row.monotributoCategory ?? ''),
    taxes: Array.isArray(row.taxes) ? (row.taxes as ArcaConstanciaSnapshot['taxes']) : [],
    activities: Array.isArray(row.activities) ? (row.activities as ArcaConstanciaSnapshot['activities']) : [],
    address: String(row.address ?? ''),
    city: String(row.city ?? ''),
    province: String(row.province ?? ''),
    postalCode: String(row.postalCode ?? ''),
    service: String(row.service ?? ''),
    constanciaErrors: Array.isArray(row.constanciaErrors) ? row.constanciaErrors.map((v) => String(v)) : [],
    consultedAt: String(row.consultedAt ?? ''),
  }
}
