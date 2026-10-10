import { cache } from 'react'
import { getAdminPermissions } from '@/lib/rbac'
import { requireAdmin } from '@/lib/session'
import { publishPermissionFor } from './core'
import type { Sensitivity } from './registry'

export type ContentAccess = {
  userId: string
  canEdit: boolean
  canPublishText: boolean
  canPublishPricing: boolean
  any: boolean
  canApprove: (s: Sensitivity) => boolean
}

/** Permisos de "Configuración y contenido" del admin autenticado (memoizado por navegación). */
export const getContentAccess = cache(async (): Promise<ContentAccess> => {
  const userId = await requireAdmin()
  const perms = await getAdminPermissions(userId)
  const canEdit = perms.has('content.edit')
  const canPublishText = perms.has('content.publish')
  const canPublishPricing = perms.has('pricing.publish')
  return {
    userId,
    canEdit,
    canPublishText,
    canPublishPricing,
    any: canEdit || canPublishText || canPublishPricing,
    canApprove: (s) => perms.has(publishPermissionFor(s)),
  }
})
