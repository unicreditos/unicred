import { db } from '@/lib/db'
import { adminPermission, adminRole, adminRolePermission, profile } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { assertAdmin } from '@/lib/session'
import { ensureRbacSchema, type PermissionKey } from '@/lib/db/ensure-rbac'

export type { PermissionKey } from '@/lib/db/ensure-rbac'
export { PERMISSIONS, DEFAULT_ROLES } from '@/lib/db/ensure-rbac'

/** Permisos del admin autenticado, según el rol asignado en profile.adminRoleId. */
export async function getAdminPermissions(userId: string): Promise<Set<PermissionKey>> {
  await ensureRbacSchema()
  const [p] = await db.select({ adminRoleId: profile.adminRoleId }).from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!p?.adminRoleId) return new Set()
  const rows = await db
    .select({ key: adminPermission.key })
    .from(adminRolePermission)
    .innerJoin(adminPermission, eq(adminPermission.id, adminRolePermission.permissionId))
    .where(eq(adminRolePermission.roleId, p.adminRoleId))
  return new Set(rows.map((r) => r.key as PermissionKey))
}

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

export type AdminRoleRow = {
  id: string
  key: string
  label: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}

/** Roles disponibles con sus permisos, para la pantalla de Operadores/Roles. */
export async function listAdminRoles(): Promise<AdminRoleRow[]> {
  await ensureRbacSchema()
  const roles = await db.select().from(adminRole).orderBy(adminRole.label)
  if (!roles.length) return []
  const roleIds = roles.map((r) => r.id)
  const rows = await db
    .select({ roleId: adminRolePermission.roleId, key: adminPermission.key })
    .from(adminRolePermission)
    .innerJoin(adminPermission, eq(adminPermission.id, adminRolePermission.permissionId))
    .where(inArray(adminRolePermission.roleId, roleIds))
  const byRole = new Map<string, string[]>()
  for (const r of rows) {
    const list = byRole.get(r.roleId) ?? []
    list.push(r.key)
    byRole.set(r.roleId, list)
  }
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    isSystem: r.isSystem,
    permissions: byRole.get(r.id) ?? [],
  }))
}

/** Asigna un rol RBAC a un admin. Requiere users.manage; el propio rol nunca se puede autoquitar sin ese permiso. */
export async function assignAdminRole(targetUserId: string, roleId: string) {
  const actorUserId = await requirePermission('users.manage')
  const [role] = await db.select().from(adminRole).where(eq(adminRole.id, roleId)).limit(1)
  if (!role) throw new Error('Rol no encontrado')
  const [target] = await db.select({ role: profile.role }).from(profile).where(eq(profile.userId, targetUserId)).limit(1)
  if (!target || target.role !== 'admin') throw new Error('El usuario no es un operador admin')
  await db.update(profile).set({ adminRoleId: roleId, updatedAt: new Date() }).where(eq(profile.userId, targetUserId))
  return { ok: true as const, by: actorUserId }
}
