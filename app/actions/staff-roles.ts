'use server'

import { assignAdminRole as assignAdminRoleRbac } from '@/lib/rbac'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { adminRole, user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function assignAdminRole(targetUserId: string, roleId: string) {
  const result = await assignAdminRoleRbac(targetUserId, roleId)

  const [role] = await db.select({ label: adminRole.label }).from(adminRole).where(eq(adminRole.id, roleId)).limit(1)
  const [target] = await db.select({ email: userTable.email }).from(userTable).where(eq(userTable.id, targetUserId)).limit(1)

  await recordAudit({
    actorUserId: result.by,
    action: 'ADMIN_ROLE_ASSIGNED',
    entityType: 'user',
    entityId: targetUserId,
    targetUserId,
    severity: 'warning',
    summary: `Rol "${role?.label ?? roleId}" asignado a ${target?.email ?? targetUserId}`,
  })

  revalidatePath('/admin')
  return result
}
