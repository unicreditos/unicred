import { MERCHANT_DOC_LABELS, requiredMerchantDocuments, type MerchantDocType, type RepresentativeRole } from '@/lib/merchant-kyb'
import type { ArcaPersonType } from '@/lib/arca/tax-condition'

/** Permisos operativos que el backoffice habilita por comercio. Solo banderas: no llaman a Mercado Pago. */
export const MERCHANT_FLAGS = {
  pos: { column: 'posEnabled', label: 'Punto de venta' },
  qr: { column: 'qrEnabled', label: 'QR de cobro' },
  virtualAccount: { column: 'virtualAccountEnabled', label: 'Cuenta virtual' },
} as const
export type MerchantFlag = keyof typeof MERCHANT_FLAGS
export const isMerchantFlag = (v: unknown): v is MerchantFlag => typeof v === 'string' && v in MERCHANT_FLAGS
export const FLAG_PENDING_NOTE = 'Pendiente de integración: hoy es solo una bandera interna. No crea sucursal, caja ni QR en Mercado Pago.'

export type DocState = 'missing' | 'uploaded' | 'approved' | 'observed'
export type DocRow = { id: string; type: string; status: string; fileName: string; sha256: string; createdAt: string | Date; reviewNote?: string | null }
export type ChecklistItem = { type: MerchantDocType; label: string; state: DocState; documentId: string | null; fileName: string | null; note: string | null }

export function docState(status: string | null | undefined): DocState {
  if (status === 'approved') return 'approved'
  if (status === 'observed') return 'observed'
  return 'uploaded'
}

/** Documentación exigida vs. cargada/aprobada. Persona humana: no se exige expediente societario. */
export function documentChecklist(personType: ArcaPersonType | string | null, role: string | null, docs: DocRow[]): ChecklistItem[] {
  const required = requiredMerchantDocuments((personType as ArcaPersonType) ?? 'DESCONOCIDA', (role as RepresentativeRole) || 'titular')
  return required.map((type) => {
    const d = docs.find((x) => x.type === type)
    return {
      type,
      label: MERCHANT_DOC_LABELS[type],
      state: d ? docState(d.status) : 'missing',
      documentId: d?.id ?? null,
      fileName: d?.fileName ?? null,
      note: d?.reviewNote ?? null,
    }
  })
}

export type MerchantAction = 'approve' | 'reject' | 'suspend' | 'reactivate'
const TRANSITIONS: Record<MerchantAction, { from: string[]; label: string; needsReason: boolean }> = {
  approve: { from: ['pending', 'rejected'], label: 'Aprobar y habilitar', needsReason: false },
  reject: { from: ['pending', 'active', 'paused'], label: 'Rechazar', needsReason: true },
  suspend: { from: ['active'], label: 'Suspender', needsReason: true },
  reactivate: { from: ['paused'], label: 'Reactivar', needsReason: false },
}
export const isMerchantAction = (v: unknown): v is MerchantAction => typeof v === 'string' && v in TRANSITIONS
export function availableActions(status: string): MerchantAction[] {
  return (Object.keys(TRANSITIONS) as MerchantAction[]).filter((a) => TRANSITIONS[a].from.includes(status))
}
export function checkTransition(status: string, action: MerchantAction, reason: string): { ok: true } | { ok: false; error: string } {
  const t = TRANSITIONS[action]
  if (!t.from.includes(status)) return { ok: false, error: `No se puede ${t.label.toLowerCase()} un comercio en estado "${status}".` }
  if (t.needsReason && reason.trim().length < 5) return { ok: false, error: 'Indicá el motivo (mínimo 5 caracteres).' }
  return { ok: true }
}
export const actionLabel = (a: MerchantAction) => TRANSITIONS[a].label

export const MESSAGE_MAX = 2000
export function cleanMessage(body: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const b = String(body ?? '').trim()
  if (b.length < 3) return { ok: false, error: 'Escribí un mensaje.' }
  if (b.length > MESSAGE_MAX) return { ok: false, error: `El mensaje supera ${MESSAGE_MAX} caracteres.` }
  return { ok: true, body: b }
}

export const EDITABLE_FIELDS = ['businessName', 'legalName', 'category', 'phone', 'city', 'province', 'address'] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]
