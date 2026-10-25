/**
 * Key 6 - verificacion de identidad de CLIENTES (nucleo puro, sin base de datos).
 *
 * Key 6 exige SI O SI tres elementos: DNI frente, DNI dorso e imagen de prueba de vida (selfie),
 * ademas de que la prueba de vida este aprobada y la sesion Didit este aprobada. Si falta cualquiera:
 * estado 'incompleto', no se abre la cuenta, no se marca nada como verificado y el flujo se detiene.
 *
 * Alcance: SOLO clientes (registro publico). Administradores, operadores y roles del personal que crea
 * el administrador desde el panel NO pasan por Key 6 (sus otros controles de seguridad siguen igual).
 */
import { extractDiditDecision } from '@/lib/didit-capture'

export const KEY6_ITEMS = ['dni_front', 'dni_back', 'selfie', 'liveness_passed', 'session_approved'] as const
export type Key6Item = (typeof KEY6_ITEMS)[number]
export type Key6State = 'completo' | 'incompleto'

export const KEY6_ITEM_LABEL: Record<Key6Item, string> = {
  dni_front: 'DNI frente',
  dni_back: 'DNI dorso',
  selfie: 'Selfie (imagen de prueba de vida)',
  liveness_passed: 'Prueba de vida aprobada',
  session_approved: 'Sesi\u00f3n de verificaci\u00f3n aprobada',
}

/** Roles del personal creado por el administrador: NO pasan por Key 6. Todo lo demas (incluido un rol desconocido) SI. */
export const STAFF_ROLES = ['admin', 'operator', 'treasury', 'tesoreria', 'futuro', 'staff'] as const

export function isStaffRole(role: string | null | undefined): boolean {
  const r = String(role ?? '').trim().toLowerCase()
  return (STAFF_ROLES as readonly string[]).includes(r)
}

/** Key 6 aplica a clientes (y comercios de alta publica). Rol vacio o desconocido => se exige (falla cerrado). */
export function requiresKey6(role: string | null | undefined): boolean {
  return !isStaffRole(role)
}

export type Key6Input = {
  hasFront: boolean
  hasBack: boolean
  hasSelfie: boolean
  livenessPassed: boolean
  sessionApproved: boolean
}

export type Key6Evaluation = {
  state: Key6State
  complete: boolean
  missing: Key6Item[]
  message: string
}

export const KEY6_BLOCK_MESSAGE =
  'No se abre la cuenta ni se verifica la identidad hasta completar DNI frente, DNI dorso y selfie de prueba de vida.'

export function key6Message(missing: readonly Key6Item[]): string {
  if (!missing.length) return 'Key 6 completa.'
  return `Key 6 incompleta: falta ${missing.map((m) => KEY6_ITEM_LABEL[m]).join(', ')}. ${KEY6_BLOCK_MESSAGE}`
}

/** Unica regla de Key 6. Verdadera solo con los tres elementos + prueba de vida aprobada + sesion aprobada. */
export function evaluateKey6(input: Key6Input): Key6Evaluation {
  const missing: Key6Item[] = []
  if (!input.hasFront) missing.push('dni_front')
  if (!input.hasBack) missing.push('dni_back')
  if (!input.hasSelfie) missing.push('selfie')
  if (!input.livenessPassed) missing.push('liveness_passed')
  if (!input.sessionApproved) missing.push('session_approved')
  const complete = missing.length === 0
  return { state: complete ? 'completo' : 'incompleto', complete, missing, message: key6Message(missing) }
}

export function hasKey6Complete(input: Key6Input): boolean {
  return evaluateKey6(input).complete
}

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
function recs(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(rec).filter((x): x is Record<string, unknown> => Boolean(x)) : []
}
function present(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/** Lee la decision de Didit (webhook o API): id_verifications front/back, liveness_checks y estado de la sesion. */
export function key6InputFromDecision(raw: unknown, fallbackStatus?: string | null): Key6Input {
  const decision = extractDiditDecision(raw)
  const ids = recs(decision?.id_verifications)
  const live = recs(decision?.liveness_checks)
  const status = String(decision?.status ?? fallbackStatus ?? '')
  return {
    hasFront: ids.some((i) => present(i.front_image) || present(i.full_front_image)),
    hasBack: ids.some((i) => present(i.back_image) || present(i.full_back_image)),
    hasSelfie: live.some((l) => present(l.reference_image)),
    livenessPassed: live.length > 0 && live.some((l) => String(l.status) === 'Approved') && !live.some((l) => String(l.status) === 'Declined'),
    sessionApproved: status === 'Approved',
  }
}

export type Key6StoredFacts = {
  /** decision de Didit guardada (ocrData.didit.decision) o null */
  decision: unknown
  /** estado de sesion Didit guardado (ocrData.didit.status) */
  diditStatus?: string | null
  /** columnas legacy de kyc_verification con captura persistida */
  columns: { dniFrontImageUrl?: string | null; dniBackImageUrl?: string | null; selfieImageUrl?: string | null }
  /** tipos presentes en kyc_evidence (dni_front, dni_back, selfie) */
  evidenceKinds: readonly string[]
}

/** Key 6 sobre lo ya guardado: las capturas pueden venir de la decision, de las columnas o de kyc_evidence. */
export function key6InputFromStored(f: Key6StoredFacts): Key6Input {
  const d = key6InputFromDecision(f.decision, f.diditStatus)
  const kinds = new Set(f.evidenceKinds)
  return {
    ...d,
    hasFront: d.hasFront || present(f.columns.dniFrontImageUrl) || kinds.has('dni_front'),
    hasBack: d.hasBack || present(f.columns.dniBackImageUrl) || kinds.has('dni_back'),
    hasSelfie: d.hasSelfie || present(f.columns.selfieImageUrl) || kinds.has('selfie'),
  }
}

export type Key6Gate = { allow: true; exempt: boolean } | { allow: false; evaluation: Key6Evaluation; message: string }

/** Decision de compuerta por rol: personal exento; cliente solo con Key 6 completa. */
export function key6Gate(role: string | null | undefined, input: Key6Input): Key6Gate {
  if (!requiresKey6(role)) return { allow: true, exempt: true }
  const evaluation = evaluateKey6(input)
  if (evaluation.complete) return { allow: true, exempt: false }
  return { allow: false, evaluation, message: evaluation.message }
}

/** Clientes ya aprobados antes de Key 6 (sin registro key6): se proponen, no se tocan solos. KEY6_ENFORCE_EXISTING=yes los exige ya. */
export function key6EnforceExisting(env: Record<string, string | undefined> = process.env): boolean {
  return (env.KEY6_ENFORCE_EXISTING ?? 'no').trim().toLowerCase() === 'yes'
}

/** Registro que se guarda en kyc_verification.ocrData.key6 (sin datos personales). */
export function key6Record(evaluation: Key6Evaluation, where: string, now: Date = new Date()) {
  return { state: evaluation.state, missing: evaluation.missing, where, checkedAt: now.toISOString() }
}

export class Key6IncompleteError extends Error {
  code = 'KEY6_INCOMPLETE' as const
  missing: Key6Item[]
  constructor(missing: Key6Item[]) {
    super(key6Message(missing))
    this.missing = missing
  }
}