import { db } from '@/lib/db'
import { adminAuditLog, user as userTable } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'

export type AuditSeverity = 'info' | 'warning' | 'error'

export type AuditEntry = {
  actorUserId: string
  action: string
  entityType: string
  entityId?: string | null
  targetUserId?: string | null
  severity?: AuditSeverity
  summary: string
  changes?: Record<string, unknown> | null
}

/**
 * Deja constancia de una intervención manual. Nunca lanza: perder una operación
 * de negocio porque falló el registro sería peor que quedarse sin la línea de
 * log, así que el error se reporta y la operación sigue.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    let actorEmail: string | null = null
    if (entry.actorUserId) {
      const [row] = await db
        .select({ email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, entry.actorUserId))
        .limit(1)
      actorEmail = row?.email ?? null
    }

    await db.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      actorUserId: entry.actorUserId || null,
      actorEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      targetUserId: entry.targetUserId ?? null,
      severity: entry.severity ?? 'info',
      summary: entry.summary,
      changes: entry.changes ? (JSON.parse(JSON.stringify(entry.changes)) as any) : null,
      createdAt: new Date(),
    })
  } catch (err) {
    console.error('[audit] no se pudo registrar la acción:', (err as Error).message, entry.action)
  }
}

/** Compara dos snapshots y devuelve sólo los campos que cambiaron. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { antes: unknown; despues: unknown }> | null {
  const changes: Record<string, { antes: unknown; despues: unknown }> = {}
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue
    const prev = before[key]
    if (String(prev ?? '') === String(value ?? '')) continue
    changes[key] = { antes: prev ?? null, despues: value ?? null }
  }
  return Object.keys(changes).length ? changes : null
}

export async function getAuditLog(limit = 100) {
  return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit)
}

export async function getAuditLogForEntity(entityType: string, entityId: string, limit = 40) {
  return db
    .select()
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.entityType, entityType), eq(adminAuditLog.entityId, entityId)))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
}
