import { createHash } from 'node:crypto'
import type { Sensitivity } from './registry'
import { stableStringify } from './diff'
export { stableStringify }
export { diffValues, formatDiffValue, labelForPath, type DiffRow } from './diff'

/** Reglas puras del flujo borrador → revisión → publicación (sin base de datos, fáciles de probar). */

export type VersionStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'superseded'

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  approved: 'Aprobado (falta publicar)',
  published: 'Publicado',
  superseded: 'Reemplazado',
}

export const OPEN_STATUSES: readonly VersionStatus[] = ['draft', 'in_review', 'approved']

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'forbidden'
      | 'not_found'
      | 'invalid'
      | 'conflict'
      | 'dual_control'
      | 'state'
      | 'reauth' = 'invalid',
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

export const requiresDualControl = (s: Sensitivity) => s !== 'normal'

/** Permiso que habilita aprobar y publicar según la sensibilidad. */
export const publishPermissionFor = (s: Sensitivity): 'content.publish' | 'pricing.publish' =>
  s === 'pricing' ? 'pricing.publish' : 'content.publish'

/** Las claves sensibles nunca son visibles por defecto; las normales sí al publicarse. */
export const defaultPublicVisible = (s: Sensitivity) => s === 'normal'

/** ¿Se puede mostrar en la web pública esta versión publicada? */
export function isPubliclyVisible(sensitivity: Sensitivity, version: { status: string; publicVisible: boolean }): boolean {
  if (version.status !== 'published') return false
  if (sensitivity === 'normal') return true
  return version.publicVisible === true
}

type Actor = { userId: string; perms: ReadonlySet<string> }
type VersionLike = {
  status: VersionStatus
  authorId: string
  lastEditorId: string | null
  approvedById?: string | null
}

/** Quién puede aprobar: permiso de publicación y, en claves sensibles, alguien que no escribió el contenido. */
export function approvalBlocker(sensitivity: Sensitivity, v: VersionLike, actor: Actor): string | null {
  const perm = publishPermissionFor(sensitivity)
  if (!actor.perms.has(perm)) return `Necesitás el permiso "${perm}" para aprobar este contenido.`
  if (v.status !== 'in_review') return 'Solo se puede aprobar una versión que está en revisión.'
  if (requiresDualControl(sensitivity) && (actor.userId === v.authorId || actor.userId === v.lastEditorId)) {
    return 'Doble control: la aprobación tiene que hacerla otro administrador distinto de quien escribió el cambio.'
  }
  return null
}

/** Quién puede publicar: permiso y estado correcto (las claves sensibles exigen aprobación previa de otra persona). */
export function publishBlocker(sensitivity: Sensitivity, v: VersionLike, actor: Actor): string | null {
  const perm = publishPermissionFor(sensitivity)
  if (!actor.perms.has(perm)) return `Necesitás el permiso "${perm}" para publicar este contenido.`
  if (requiresDualControl(sensitivity)) {
    if (v.status !== 'approved') return 'Este contenido es sensible: tiene que estar aprobado por un segundo administrador antes de publicarse.'
    if (!v.approvedById || v.approvedById === v.authorId || v.approvedById === v.lastEditorId) {
      return 'Doble control: falta la aprobación de un administrador distinto de quien escribió el cambio.'
    }
  } else if (v.status !== 'in_review' && v.status !== 'approved') {
    return 'Primero hay que enviar el borrador a revisión.'
  }
  return null
}

export const valueHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex')

