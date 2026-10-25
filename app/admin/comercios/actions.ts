'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { DESK_CACHE_TAG } from '@/lib/admin-desk/load'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { merchant, user } from '@/lib/db/schema'
import { ensureMerchantAdminSchema } from '@/lib/db/ensure-merchant-admin'
import { requirePermission } from '@/lib/rbac'
import { recordAudit, diffFields } from '@/lib/audit'
import { setMerchantStatus } from '@/app/actions/admin'
import { isValidCuit, normalizeCuit } from '@/lib/bcra'
import { MERCHANT_DOC_LABELS, type MerchantDocType } from '@/lib/merchant-kyb'
import { sendEmail } from '@/lib/email'
import { newId } from '@/lib/session'
import {
  EDITABLE_FIELDS, MERCHANT_FLAGS, checkTransition, cleanMessage, isMerchantAction, isMerchantFlag, type EditableField,
} from '@/lib/merchant-admin-core'
import type { SqlExecutor } from '@/lib/otp-pg-store'
import * as S from '@/lib/merchant-admin-store'

export type MerchantActionResult = { ok: true; id?: string } | { ok: false; error: string; conflict?: boolean }

const sx = () => db as unknown as SqlExecutor
const CONFLICT = 'El comercio cambió mientras lo mirabas. Recargá la ficha y volvé a intentar.'

function fail(err: unknown): MerchantActionResult {
  const message = err instanceof Error ? err.message : ''
  if (/^No autorizado|permiso/i.test(message)) return { ok: false, error: message }
  console.error('[admin/comercios]', message)
  return { ok: false, error: 'No se pudo completar la acción. Reintentá en unos segundos.' }
}

async function load(id: string) {
  const [m] = await db.select().from(merchant).where(eq(merchant.id, id)).limit(1)
  return m ?? null
}
const refresh = (id: string) => { updateTag(DESK_CACHE_TAG); revalidatePath('/admin/comercios'); revalidatePath(`/admin/comercios/${id}`) }

/** Alta de un comercio desde el backoffice, para un usuario ya registrado (por mail). Queda "pendiente": NO se habilita. */
export async function createMerchantAdmin(input: {
  ownerEmail: string; businessName: string; cuit: string; category?: string; province?: string; city?: string; address?: string; phone?: string
}): Promise<MerchantActionResult> {
  try {
    const admin = await requirePermission('merchants.write')
    await ensureMerchantAdminSchema()
    const email = input.ownerEmail.trim().toLowerCase()
    const businessName = input.businessName.trim()
    const cuit = normalizeCuit(input.cuit)
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Ingresá el mail del usuario titular.' }
    if (businessName.length < 2) return { ok: false, error: 'Ingresá el nombre del comercio.' }
    if (!isValidCuit(cuit)) return { ok: false, error: 'El CUIT no es válido (dígito verificador).' }
    const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
    if (!owner) return { ok: false, error: 'No hay un usuario registrado con ese mail. El titular tiene que crear su cuenta primero.' }
    const formatted = `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
    const [byUser] = await db.select({ id: merchant.id }).from(merchant).where(eq(merchant.userId, owner.id)).limit(1)
    if (byUser) return { ok: false, error: 'Ese usuario ya tiene un comercio.' }
    const [dup] = await db.select({ id: merchant.id }).from(merchant).where(or(eq(merchant.cuit, cuit), eq(merchant.cuit, formatted))).limit(1)
    if (dup) return { ok: false, error: 'Ese CUIT ya está cargado en otro comercio.' }
    const id = newId('merch')
    await db.insert(merchant).values({
      id, userId: owner.id, businessName, cuit: formatted,
      category: input.category?.trim() || null, province: input.province?.trim() || null, city: input.city?.trim() || null,
      address: input.address?.trim() || null, phone: input.phone?.trim() || null, status: 'pending', kybStatus: 'incomplete',
    })
    await recordAudit({ actorUserId: admin, action: 'MERCHANT_CREATED_BY_ADMIN', entityType: 'merchant', entityId: id, targetUserId: owner.id, summary: `Alta de comercio ${businessName} desde el backoffice (pendiente de documentación)` })
    refresh(id)
    return { ok: true, id }
  } catch (e) { return fail(e) }
}

/** Aprobar / rechazar / suspender / reactivar. Decisión humana, con motivo, auditada y con control de versión (409). */
export async function decideMerchantAction(id: string, action: string, expectedUpdatedAt: string, reason: string): Promise<MerchantActionResult> {
  try {
    const admin = await requirePermission('merchants.write')
    if (!isMerchantAction(action)) return { ok: false, error: 'Acción inválida.' }
    await ensureMerchantAdminSchema()
    const m = await load(id)
    if (!m) return { ok: false, error: 'Comercio no encontrado.' }
    const check = checkTransition(m.status, action, reason)
    if (!check.ok) return check
    if (!(await S.merchantUnchangedWith(sx(), id, expectedUpdatedAt))) return { ok: false, error: CONFLICT, conflict: true }
    if (action === 'approve') await setMerchantStatus(id, 'active') // reglas KYB completas (ARCA, Didit, expediente)
    else if (action === 'reject') await setMerchantStatus(id, 'rejected')
    else {
      const ok = await S.setStatusIfUnchangedWith(sx(), { merchantId: id, status: action === 'suspend' ? 'paused' : 'active', expectedUpdatedAt })
      if (!ok) return { ok: false, error: CONFLICT, conflict: true }
      await recordAudit({ actorUserId: admin, action: action === 'suspend' ? 'MERCHANT_PAUSED' : 'MERCHANT_ACTIVATED', entityType: 'merchant', entityId: id, targetUserId: m.userId, severity: action === 'suspend' ? 'warning' : 'info', summary: `Comercio ${m.businessName} ${action === 'suspend' ? 'suspendido' : 'reactivado'}${reason.trim() ? `: ${reason.trim()}` : ''}`, changes: { status: { antes: m.status, despues: action === 'suspend' ? 'paused' : 'active' } } })
    }
    if (reason.trim()) await S.addMessageWith(sx(), { merchantId: id, authorUserId: admin, authorRole: 'admin', kind: 'note', body: `[${action}] ${reason.trim()}` })
    refresh(id)
    return { ok: true }
  } catch (e) { return fail(e) }
}

export async function editMerchantFields(id: string, expectedUpdatedAt: string, fields: Partial<Record<EditableField, string>>): Promise<MerchantActionResult> {
  try {
    const admin = await requirePermission('merchants.write')
    const m = await load(id)
    if (!m) return { ok: false, error: 'Comercio no encontrado.' }
    const patch: Record<string, string | null> = {}
    for (const k of EDITABLE_FIELDS) if (fields[k] !== undefined) patch[k] = String(fields[k]).trim().slice(0, 200) || null
    if ('businessName' in patch && (patch.businessName ?? '').length < 2) return { ok: false, error: 'El nombre no puede quedar vacío.' }
    if (!(await S.merchantUnchangedWith(sx(), id, expectedUpdatedAt))) return { ok: false, error: CONFLICT, conflict: true }
    const changes = diffFields(m as unknown as Record<string, unknown>, patch)
    if (!changes) return { ok: true }
    const res = await db.update(merchant).set({ ...patch, updatedAt: new Date() }).where(eq(merchant.id, id)).returning({ id: merchant.id })
    if (!res.length) return { ok: false, error: 'Comercio no encontrado.' }
    await recordAudit({ actorUserId: admin, action: 'MERCHANT_EDITED', entityType: 'merchant', entityId: id, targetUserId: m.userId, summary: `Datos de ${m.businessName} editados`, changes })
    refresh(id)
    return { ok: true }
  } catch (e) { return fail(e) }
}

/** Banderas internas. NO crea sucursal, caja ni QR en Mercado Pago (integración pendiente). */
export async function setMerchantFlag(id: string, flag: string, value: boolean): Promise<MerchantActionResult> {
  try {
    const admin = await requirePermission('merchants.write')
    if (!isMerchantFlag(flag)) return { ok: false, error: 'Permiso inválido.' }
    await ensureMerchantAdminSchema()
    const m = await load(id)
    if (!m) return { ok: false, error: 'Comercio no encontrado.' }
    if (value && m.status !== 'active') return { ok: false, error: 'Solo se habilitan permisos a comercios activos.' }
    const r = await S.setPermissionWith(sx(), { merchantId: id, flag, value, actor: admin })
    await recordAudit({ actorUserId: admin, action: value ? 'MERCHANT_PERMISSION_ON' : 'MERCHANT_PERMISSION_OFF', entityType: 'merchant', entityId: id, targetUserId: m.userId, summary: `${MERCHANT_FLAGS[flag].label} ${value ? 'habilitado' : 'deshabilitado'} (bandera interna)`, changes: { [flag]: { antes: r.before, despues: r.after } } })
    refresh(id)
    return { ok: true }
  } catch (e) { return fail(e) }
}

export async function reviewMerchantDocument(merchantId: string, documentId: string, decision: 'approved' | 'observed', note: string): Promise<MerchantActionResult> {
  try {
    const admin = await requirePermission('merchants.write')
    await ensureMerchantAdminSchema()
    if (decision !== 'approved' && decision !== 'observed') return { ok: false, error: 'Decisión inválida.' }
    const r = await S.reviewDocWith(sx(), { documentId, merchantId, decision, note, actor: admin })
    if (!r.ok) return r
    await recordAudit({ actorUserId: admin, action: decision === 'approved' ? 'MERCHANT_DOC_APPROVED' : 'MERCHANT_DOC_OBSERVED', entityType: 'merchant_document', entityId: documentId, summary: `Documento ${r.type} ${decision === 'approved' ? 'aprobado' : 'observado'}${note.trim() ? `: ${note.trim()}` : ''}` })
    if (decision === 'observed') await S.addMessageWith(sx(), { merchantId, authorUserId: admin, authorRole: 'admin', kind: 'request', body: `Revisamos tu documento y necesitamos que lo vuelvas a subir: ${note.trim()}`, requestedDocType: r.type, documentId })
    refresh(merchantId)
    return { ok: true }
  } catch (e) { return fail(e) }
}

/** Pedido de documentación o mensaje al comercio. Queda registrado y es inmutable. El mail es opcional y está apagado por defecto. */
export async function sendMerchantMessage(merchantId: string, body: string, requestedDocType?: string | null): Promise<MerchantActionResult> {
  try {
    const admin = await requirePermission('merchants.write')
    await ensureMerchantAdminSchema()
    const c = cleanMessage(body)
    if (!c.ok) return c
    if (requestedDocType && !(requestedDocType in MERCHANT_DOC_LABELS)) return { ok: false, error: 'Documento inválido.' }
    const m = await load(merchantId)
    if (!m) return { ok: false, error: 'Comercio no encontrado.' }
    const id = await S.addMessageWith(sx(), { merchantId, authorUserId: admin, authorRole: 'admin', kind: 'request', body: c.body, requestedDocType: requestedDocType ?? null })
    await recordAudit({ actorUserId: admin, action: 'MERCHANT_MESSAGE_SENT', entityType: 'merchant', entityId: merchantId, targetUserId: m.userId, summary: requestedDocType ? `Pedido de ${MERCHANT_DOC_LABELS[requestedDocType as MerchantDocType]}` : 'Mensaje al comercio' })
    // Mail opcional: solo con MERCHANT_MESSAGE_EMAIL=1 (apagado por defecto). Sin la bandera no se envía nada.
    if (process.env.MERCHANT_MESSAGE_EMAIL === '1') {
      const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, m.userId)).limit(1)
      if (u?.email) await sendEmail({ to: u.email, subject: 'Tenés un mensaje de Unicréditos sobre tu comercio', text: 'Ingresá al panel de comercio, sección Documentación, para ver y responder el mensaje.', html: '<p>Ingresá al panel de comercio, sección Documentación, para ver y responder el mensaje.</p>' }).catch(() => undefined)
    }
    refresh(merchantId)
    return { ok: true, id }
  } catch (e) { return fail(e) }
}

