import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { getAdminPermissions, type PermissionKey } from '@/lib/rbac'
import { requireAdmin } from '@/lib/session'
import { recordAudit } from '@/lib/audit'
import { consumeRateLimit } from '@/lib/rate-limit'
import { buildAdminDeskSnapshot, type AdminDeskSnapshot } from './build-state'
import { filterDeskStateByPermissions } from './permissions'
import type { AdminDeskState } from './types'

/** Etiqueta del snapshot: las acciones del backoffice la invalidan para ver su cambio al instante. */
export const DESK_CACHE_TAG = 'admin-desk'

/** Un snapshot degradado (base caída, error de armado) no se guarda: se reintenta en la próxima carga. */
class DegradedSnapshot extends Error {
  constructor(readonly snapshot: AdminDeskSnapshot) {
    super('degraded-snapshot')
  }
}

/**
 * Armar el snapshot recorre toda la cartera (decenas de consultas): hacerlo en cada
 * navegación tarda segundos. Se comparte entre operadores durante 30 s y se invalida
 * al instante cuando alguien ejecuta una acción. El recorte por permisos se hace
 * después, por operador, así que lo cacheado es el estado completo.
 */
const cachedSnapshot = unstable_cache(
  async () => {
    const snap = await buildAdminDeskSnapshot()
    if (snap.degraded) throw new DegradedSnapshot(snap)
    return snap
  },
  ['admin-desk-snapshot'],
  { tags: [DESK_CACHE_TAG], revalidate: 30 },
)

async function getSnapshot(): Promise<AdminDeskSnapshot> {
  try {
    return await cachedSnapshot()
  } catch (err) {
    if (err instanceof DegradedSnapshot) return err.snapshot
    throw err
  }
}

export type DeskContext = {
  userId: string
  operator: { name: string; email: string }
  perms: Set<PermissionKey>
  state: AdminDeskState
  degraded: boolean
  buildError?: string
}

/**
 * Snapshot del backoffice para las páginas de /admin. Corre en el servidor con
 * la sesión por cookie (nada de tokens en el navegador) y recorta cada sección
 * según el RBAC del operador. `cache` evita rearmar el snapshot entre el layout
 * y la página dentro de la misma request.
 */
export const loadDesk = cache(async (): Promise<DeskContext> => {
  const userId = await requireAdmin()
  const [snap, perms, rows] = await Promise.all([
    getSnapshot(),
    getAdminPermissions(userId),
    db
      .select({ name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1),
  ])
  return {
    userId,
    operator: { name: rows[0]?.name || 'Operador', email: rows[0]?.email || '' },
    perms,
    state: filterDeskStateByPermissions(snap.state, perms),
    degraded: snap.degraded,
    buildError: snap.error,
  }
})

export function clientName(state: AdminDeskState, clientId: string | null | undefined) {
  if (!clientId) return '—'
  const c = state.clients.find((x) => x.id === clientId)
  if (!c) return 'Cliente'
  return `${c.firstName} ${c.lastName}`.trim() || c.email || 'Cliente'
}

/**
 * Registro de lectura: consultar datos personales o crediticios también es un acto auditable.
 * Una línea por operador, pantalla y registro cada 10 minutos (recargar no infla el registro).
 */
export async function auditAdminView(userId: string, area: string, entityId?: string) {
  try {
    const gate = await consumeRateLimit(`view:${userId}:${area}:${entityId ?? '-'}`, 1, 10 * 60 * 1000)
    if (!gate.ok) return
    await recordAudit({
      actorUserId: userId,
      action: 'ADMIN_VIEW',
      entityType: area,
      entityId: entityId ?? null,
      summary: `Consulta de ${area.replace(/_/g, ' ')}${entityId ? ` ${entityId.slice(-8)}` : ''}`,
    })
  } catch {
    /* un fallo del registro no debe impedir la consulta */
  }
}
