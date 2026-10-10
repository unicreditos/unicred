import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { requireMobileAdmin } from '@/lib/mobile/ops'
import { deskMutate, type DeskMutateAction } from '@/lib/admin-desk/mutate'
import { assertDeskPermission, filterDeskStateByPermissions } from '@/lib/admin-desk/permissions'
import { buildAdminDeskSnapshot } from '@/lib/admin-desk'
import { getAdminPermissions } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

const ACTIONS = new Set<DeskMutateAction>([
  'approveApplication',
  'rejectApplication',
  'requestInformation',
  'cancelApplication',
  'decideKyc',
  'markDisbursed',
  'failDisbursement',
  'retryDisbursement',
  'registerPayment',
  'matchTransfer',
  'rejectTransfer',
  'logCollectionContact',
  'resolveTicket',
  'pauseMerchant',
  'activateMerchant',
  'createApplication',
  'reopenApplication',
  'editApplication',
])

/** Mutaciones del desk. Body: { action, payload?, refresh?: boolean } */
export async function POST(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    await requireMobileAdmin(userId)
    const body = (await req.json().catch(() => null)) as {
      action?: string
      payload?: Record<string, unknown>
      refresh?: boolean
    } | null
    const action = body?.action as DeskMutateAction | undefined
    if (!action || !ACTIONS.has(action)) {
      return mobileJson(req, { message: 'Acción inválida' }, { status: 400 })
    }
    await assertDeskPermission(userId, action)
    const result = await deskMutate(userId, action, body?.payload ?? {})
    if (!result.ok) {
      return mobileJson(req, { ok: false, error: result.error, code: result.code }, { status: result.code === 'conflict' ? 409 : 400 })
    }
    if (body?.refresh === false) {
      return mobileJson(req, { ok: true, id: result.id })
    }
    const [snap, perms] = await Promise.all([buildAdminDeskSnapshot(), getAdminPermissions(userId)])
    return mobileJson(req, {
      ok: true,
      id: result.id,
      state: filterDeskStateByPermissions(snap.state, perms),
      operatorId: userId,
      degraded: snap.degraded,
      buildError: snap.error,
      permissions: [...perms],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status =
      /unauthor/i.test(message) || message === 'unauthorized'
        ? 401
        : /No autorizado/i.test(message)
          ? 403
          : 500
    return mobileJson(req, { message }, { status })
  }
}
