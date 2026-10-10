'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { getAdminPermissions } from '@/lib/rbac'
import { verifyCurrentPassword } from '@/lib/reauth'
import { assertAdmin } from '@/lib/session'
import { ConfigError, STATUS_LABEL } from '@/lib/site-config/core'
import { SITE_CONFIG_TAG } from '@/lib/site-config/read'
import { getDefinition } from '@/lib/site-config/registry'
import * as store from '@/lib/site-config/store'

export type ConfigActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

async function actor(): Promise<store.Actor> {
  const userId = await assertAdmin()
  const perms = await getAdminPermissions(userId)
  const [u] = await db.select({ email: userTable.email }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  return { userId, email: u?.email ?? null, perms }
}

function fail(err: unknown, what: string): ConfigActionResult {
  if (err instanceof ConfigError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors }
  const message = err instanceof Error ? err.message : ''
  if (/^No autorizado/.test(message)) return { ok: false, error: message }
  console.error('[site-config] falló', what, message)
  return { ok: false, error: 'No se pudo completar la acción. Reintentá en unos segundos.' }
}

/** Invalida la capa de lectura y las páginas que muestran contenido editable. */
function refreshPublic() {
  updateTag(SITE_CONFIG_TAG)
  revalidatePath('/')
  revalidatePath('/legal/documentos')
  revalidatePath('/legal/documentos/[slug]', 'page')
}

function refreshAdmin() {
  revalidatePath('/admin/contenido', 'layout')
}

async function audit(a: store.Actor, action: string, key: string, summary: string, changes: Record<string, unknown>, severity: 'info' | 'warning' = 'info') {
  await recordAudit({ actorUserId: a.userId, action, entityType: 'site_config', entityId: key, summary, severity, changes })
}

function label(key: string) {
  return getDefinition(key)?.label ?? key
}

export async function saveDraftAction(input: { key: string; value: unknown; reason: string; publicVisible?: boolean }): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const detail = await store.getItemDetail(input.key)
    const v = detail.open
      ? await store.updateDraft(a, input.key, input.value, input.reason, { publicVisible: input.publicVisible })
      : await store.createDraft(a, input.key, input.value, input.reason, { publicVisible: input.publicVisible })
    await audit(a, detail.open ? 'SITE_CONFIG_DRAFT_UPDATED' : 'SITE_CONFIG_DRAFT_CREATED', input.key, `Borrador v${v.version} de "${label(input.key)}": ${v.reason}`, {
      version: v.version,
      valueHash: v.valueHash,
      publicVisible: v.publicVisible,
    })
    refreshAdmin()
    return { ok: true, message: `Borrador v${v.version} guardado.` }
  } catch (err) {
    return fail(err, 'saveDraft')
  }
}

export async function submitReviewAction(key: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const v = await store.submitForReview(a, key)
    await audit(a, 'SITE_CONFIG_SUBMITTED', key, `v${v.version} de "${label(key)}" enviada a revisión`, { version: v.version, valueHash: v.valueHash })
    refreshAdmin()
    return { ok: true, message: 'Enviado a revisión.' }
  } catch (err) {
    return fail(err, 'submitReview')
  }
}

export async function returnToDraftAction(key: string, note: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const v = await store.returnToDraft(a, key, note)
    await audit(a, 'SITE_CONFIG_RETURNED', key, `v${v.version} de "${label(key)}" devuelta a borrador: ${note.trim()}`, { version: v.version })
    refreshAdmin()
    return { ok: true, message: 'Devuelto a borrador.' }
  } catch (err) {
    return fail(err, 'returnToDraft')
  }
}

export async function approveAction(key: string, note: string, publicApprovalRef?: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const v = await store.approve(a, key, note, publicApprovalRef)
    await audit(a, 'SITE_CONFIG_APPROVED', key, `v${v.version} de "${label(key)}" aprobada (segundo control): ${note.trim()}`, {
      version: v.version,
      authorId: v.authorId,
      approvedById: v.approvedById,
      publicVisible: v.publicVisible,
      publicApprovalRef: v.publicApprovalRef,
    }, 'warning')
    refreshAdmin()
    return { ok: true, message: `Aprobado. Falta publicar (${STATUS_LABEL.approved}).` }
  } catch (err) {
    return fail(err, 'approve')
  }
}

export async function publishAction(key: string, password: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const gate = await verifyCurrentPassword(a.userId, password)
    if (gate === 'rate_limited') return { ok: false, error: 'Demasiados intentos. Esperá unos minutos.' }
    if (gate !== 'ok') return { ok: false, error: 'La clave actual no es correcta.' }
    const v = await store.publish(a, key)
    await audit(a, 'SITE_CONFIG_PUBLISHED', key, `v${v.version} de "${label(key)}" publicada${v.publicVisible ? ' (visible en la web pública)' : ' (oculta en la web pública)'}`, {
      version: v.version,
      valueHash: v.valueHash,
      publicVisible: v.publicVisible,
      authorId: v.authorId,
      approvedById: v.approvedById,
    }, 'warning')
    refreshPublic()
    refreshAdmin()
    return { ok: true, message: `Versión ${v.version} publicada.` }
  } catch (err) {
    return fail(err, 'publish')
  }
}

export async function unpublishAction(key: string, reason: string, password: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const gate = await verifyCurrentPassword(a.userId, password)
    if (gate === 'rate_limited') return { ok: false, error: 'Demasiados intentos. Esperá unos minutos.' }
    if (gate !== 'ok') return { ok: false, error: 'La clave actual no es correcta.' }
    await store.unpublish(a, key, reason)
    await audit(a, 'SITE_CONFIG_UNPUBLISHED', key, `"${label(key)}" retirada de la web (vuelve al valor del código): ${reason.trim()}`, {}, 'warning')
    refreshPublic()
    refreshAdmin()
    return { ok: true, message: 'Retirado: la web vuelve al valor original.' }
  } catch (err) {
    return fail(err, 'unpublish')
  }
}

export async function discardDraftAction(key: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    await store.discardDraft(a, key)
    await audit(a, 'SITE_CONFIG_DRAFT_DISCARDED', key, `Borrador de "${label(key)}" descartado`, {})
    refreshAdmin()
    return { ok: true, message: 'Borrador descartado.' }
  } catch (err) {
    return fail(err, 'discardDraft')
  }
}

export async function rollbackAction(key: string, fromVersion: number, reason: string): Promise<ConfigActionResult> {
  try {
    const a = await actor()
    const v = await store.createRollbackDraft(a, key, Number(fromVersion), reason)
    await audit(a, 'SITE_CONFIG_ROLLBACK_DRAFT', key, `Borrador v${v.version} de "${label(key)}" restaura la versión ${fromVersion}: ${reason.trim()}`, {
      version: v.version,
      rollbackOfVersion: v.rollbackOfVersion,
    })
    refreshAdmin()
    return { ok: true, message: `Se creó el borrador v${v.version} con el contenido de la versión ${fromVersion}.` }
  } catch (err) {
    return fail(err, 'rollback')
  }
}
