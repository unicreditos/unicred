'use server'

import { enforceActionLimit } from '@/lib/action-rate-limit'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { ensureSupportCaseTable } from '@/lib/db/ensure-support-case'
import { supportCase } from '@/lib/db/schema'
import { notifySupportClaim } from '@/lib/notify-email'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'
import { assertRole, getRoleForUser, newId } from '@/lib/session'
import { asCategory, insertSupportMessage } from '@/lib/support'
import { desc, eq } from 'drizzle-orm'

export async function listMyClaims() {
  const userId = await assertRole('customer', 'merchant')
  await ensureSupportCaseTable()
  return db
    .select()
    .from(supportCase)
    .where(eq(supportCase.userId, userId))
    .orderBy(desc(supportCase.createdAt))
    .limit(40)
}

export async function createClaim(input: { category: string; subject: string; body: string }) {
  const userId = await assertRole('customer', 'merchant')
  await enforceActionLimit('claim', userId)
  const role = await getRoleForUser(userId)
  await ensureSupportCaseTable()

  const subject = String(input.subject ?? '').trim().slice(0, 160)
  const body = String(input.body ?? '').trim().slice(0, 4000)
  if (subject.length < 8) throw new Error('El asunto debe tener al menos 8 caracteres.')
  if (body.length < 20) throw new Error('Describí el reclamo con al menos 20 caracteres.')

  const id = newId('case')
  const now = new Date()
  const [row] = await db
    .insert(supportCase)
    .values({
      id,
      userId,
      category: asCategory(input.category),
      subject,
      body,
      status: 'open',
      channel: 'dashboard',
      lawRef: 'Ley 24.240',
      waitingOn: 'agent',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await insertSupportMessage({
    caseId: row.id,
    authorUserId: userId,
    authorRole: role,
    body,
  })

  await recordAudit({
    actorUserId: userId,
    action: 'CLAIM_CREATED',
    entityType: 'support_case',
    entityId: row.id,
    targetUserId: userId,
    summary: 'El cliente presentó un reclamo',
    changes: { categoria: input.category },
  })
  void notifySupportClaim({ userId, caseId: row.id, subject: row.subject })
  revalidateCustomer()
  revalidateOps()
  return { ok: true as const, id: row.id }
}

