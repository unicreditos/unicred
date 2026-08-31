import { db } from '@/lib/db'
import { ensureSupportCaseTable } from '@/lib/db/ensure-support-case'
import { inboxReceipt } from '@/lib/db/schema'
import { newId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function loadReadItemIds(userId: string): Promise<Set<string>> {
  try {
    await ensureSupportCaseTable()
    const rows = await db
      .select({ itemId: inboxReceipt.itemId })
      .from(inboxReceipt)
      .where(eq(inboxReceipt.userId, userId))
    return new Set(rows.map((r) => r.itemId))
  } catch {
    return new Set()
  }
}

export async function markItemsRead(userId: string, itemIds: string[]) {
  const ids = [...new Set(itemIds.map((id) => String(id ?? '').trim()).filter(Boolean))].slice(0, 80)
  if (!ids.length) return { ok: true as const, count: 0 }
  await ensureSupportCaseTable()
  const now = new Date()
  await db
    .insert(inboxReceipt)
    .values(
      ids.map((itemId) => ({
        id: newId('ir'),
        userId,
        itemId,
        readAt: now,
      })),
    )
    .onConflictDoNothing({ target: [inboxReceipt.userId, inboxReceipt.itemId] })
  return { ok: true as const, count: ids.length }
}
