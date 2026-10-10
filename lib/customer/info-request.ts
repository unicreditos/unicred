import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adminAuditLog } from '@/lib/db/schema'

/** Último pedido de información por préstamo, leído directo de auditoría. */
export async function latestLoanInfoRequests(userId: string) {
  const rows = await db
    .select({
      entityId: adminAuditLog.entityId,
      summary: adminAuditLog.summary,
    })
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.targetUserId, userId), eq(adminAuditLog.action, 'LOAN_INFO_REQUESTED')))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(40)
    .catch(() => [])
  const byLoan = new Map<string, string>()
  for (const row of rows) {
    if (!row.entityId || byLoan.has(row.entityId)) continue
    byLoan.set(row.entityId, row.summary)
  }
  return byLoan
}
