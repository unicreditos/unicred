'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { deskMutate, type DeskMutateAction } from '@/lib/admin-desk/mutate'
import { DESK_CACHE_TAG } from '@/lib/admin-desk/load'
import { assertDeskPermission } from '@/lib/admin-desk/permissions'
import { assertAdmin } from '@/lib/session'

/** Solo las acciones que la UI del backoffice expone. */
const ALLOWED = new Set<DeskMutateAction>([
  'approveApplication',
  'rejectApplication',
  'decideKyc',
  'markDisbursed',
  'failDisbursement',
  'retryDisbursement',
  'matchTransfer',
  'rejectTransfer',
  'logCollectionContact',
  'resolveTicket',
])

export type DeskActionResult = { ok: true } | { ok: false; error: string }

export async function runDeskAction(
  action: DeskMutateAction,
  payload: Record<string, unknown>,
): Promise<DeskActionResult> {
  try {
    if (!ALLOWED.has(action)) return { ok: false, error: 'Acción no permitida.' }
    const userId = await assertAdmin()
    await assertDeskPermission(userId, action)
    const result = await deskMutate(userId, action, payload)
    if (!result.ok) return { ok: false, error: result.error }
    updateTag(DESK_CACHE_TAG)
    revalidatePath('/admin', 'layout')
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    // Los errores de permiso son seguros de mostrar; el resto, no.
    if (/^No autorizado/.test(message)) return { ok: false, error: message }
    console.error('[admin] runDeskAction failed:', action, message)
    return { ok: false, error: 'No se pudo completar la acción. Reintentá en unos segundos.' }
  }
}
