import { db } from '@/lib/db'
import { adminPermission, adminRolePermission, profile } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { assertAdmin } from '@/lib/session'
import { ensureRbacSchema, type PermissionKey } from '@/lib/db/ensure-rbac'
import { cache } from 'react'

export type { PermissionKey } from '@/lib/db/ensure-rbac'
export { PERMISSIONS, DEFAULT_ROLES } from '@/lib/db/ensure-rbac'

/**
 * Permisos del admin autenticado, según el rol asignado en profile.adminRoleId.
 * Memoizado con cache(): requirePermission() se llama una vez por cada acción
 * pedida en la misma navegación (hasta 7-8 veces en /admin), y sin esto cada
 * llamada repetía las mismas 2 consultas desde cero.
 */
export const getAdminPermissions = cache(async (userId: string): Promise<Set<PermissionKey>> => {
  await ensureRbacSchema()
  const [p] = await db.select({ adminRoleId: profile.adminRoleId }).from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!p?.adminRoleId) return new Set()
  const rows = await db
    .select({ key: adminPermission.key })
    .from(adminRolePermission)
    .innerJoin(adminPermission, eq(adminPermission.id, adminRolePermission.permissionId))
    .where(eq(adminRolePermission.roleId, p.adminRoleId))
  return new Set(rows.map((r) => r.key as PermissionKey))
})

/**
 * Server actions y API routes: exige que el admin autenticado tenga el
 * permiso indicado. No confiar en que el botón esté oculto en la UI — esto
 * es el gate real.
 */
export async function requirePermission(permissionKey: PermissionKey): Promise<string> {
  const userId = await assertAdmin()
  const perms = await getAdminPermissions(userId)
  if (!perms.has(permissionKey)) {
    throw new Error(`No tenés el permiso "${permissionKey}" para esta acción.`)
  }
  return userId
}

export async function hasPermission(userId: string, permissionKey: PermissionKey): Promise<boolean> {
  const perms = await getAdminPermissions(userId)
  return perms.has(permissionKey)
}

