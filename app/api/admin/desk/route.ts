import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { requireMobileAdmin } from '@/lib/mobile/ops'
import { buildAdminDeskSnapshot } from '@/lib/admin-desk'
import { filterDeskStateByPermissions } from '@/lib/admin-desk/permissions'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminPermissions } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

/** Snapshot completo del backoffice para unicreditos-admin. */
export async function GET(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    await requireMobileAdmin(userId)
    const [snap, users, perms] = await Promise.all([
      buildAdminDeskSnapshot(),
      db
        .select({ id: userTable.id, name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1),
      getAdminPermissions(userId),
    ])
    const usr = users[0]
    return mobileJson(req, {
      state: filterDeskStateByPermissions(snap.state, perms),
      degraded: snap.degraded,
      buildError: snap.error,
      operatorId: userId,
      operator: usr
        ? { id: usr.id, name: usr.name, email: usr.email }
        : { id: userId, name: 'Admin', email: '' },
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
