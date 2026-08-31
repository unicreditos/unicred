'use server'

import { markItemsRead } from '@/lib/inbox-read'
import { getInbox } from '@/lib/notifications'
import { revalidateOps } from '@/lib/revalidate'
import { assertRole, getRoleForUser } from '@/lib/session'
import {
  assertCanAccessCase,
  closeSupportCase,
  countAgentsOnline,
  getOrOpenChatCase,
  heartbeatPresence,
  insertSupportMessage,
  listAdminCases,
  listRelatedLoans,
  listThread,
  listUserCases,
  markCaseViewed,
} from '@/lib/support'

export async function pulseSupportPresence(viewingCaseId?: string | null) {
  const userId = await assertRole('customer', 'merchant', 'admin')
  const role = await getRoleForUser(userId)
  await heartbeatPresence(userId, role, viewingCaseId)
  return { ok: true as const, agentsOnline: await countAgentsOnline() }
}

export async function getMySupportState(caseId?: string) {
  const userId = await assertRole('customer', 'merchant')
  const role = await getRoleForUser(userId)
  await heartbeatPresence(userId, role, caseId ?? null)
  const agentsOnline = await countAgentsOnline()
  const cases = await listUserCases(userId)
  const live = cases.find((c) => c.channel === 'chat' && (c.status === 'open' || c.status === 'in_review'))
  const selected = (caseId && cases.find((c) => c.id === caseId)) || live || cases[0] || null
  if (selected) {
    await markCaseViewed(selected.id, userId, role)
  }
  const thread = selected ? await listThread(selected.id) : []
  const loans = await listRelatedLoans(userId)
  return { agentsOnline, cases, selected, thread, loans }
}

export async function openMySupportChat(input?: { category?: string; relatedLoanId?: string | null }) {
  const userId = await assertRole('customer', 'merchant')
  const role = await getRoleForUser(userId)
  const row = await getOrOpenChatCase(userId, input)
  await markCaseViewed(row.id, userId, role)
  revalidateOps()
  return { id: row.id }
}

export async function sendSupportMessage(caseId: string, body: string) {
  const userId = await assertRole('customer', 'merchant', 'admin')
  const role = await getRoleForUser(userId)
  const row = await assertCanAccessCase(caseId, userId, role)
  if (row.status === 'resolved' || row.status === 'closed') {
    if (role === 'admin') {
      /* el admin puede reabrir al responder */
    }
  }
  await insertSupportMessage({
    caseId,
    authorUserId: userId,
    authorRole: role,
    body,
  })
  await markCaseViewed(caseId, userId, role)
  return { ok: true as const, agentsOnline: await countAgentsOnline() }
}

export async function loadSupportThread(caseId: string, opts?: { markViewed?: boolean }) {
  const userId = await assertRole('customer', 'merchant', 'admin')
  const role = await getRoleForUser(userId)
  await assertCanAccessCase(caseId, userId, role)
  if (opts?.markViewed !== false) await markCaseViewed(caseId, userId, role)
  const thread = await listThread(caseId)
  return { thread, agentsOnline: await countAgentsOnline() }
}

export async function getAdminSupportDesk(caseId?: string) {
  const userId = await assertRole('admin')
  await heartbeatPresence(userId, 'admin', caseId ?? null)
  const cases = await listAdminCases()
  const selected = caseId ? cases.find((c) => c.id === caseId) ?? null : null
  if (caseId && selected) await markCaseViewed(caseId, userId, 'admin')
  const thread = selected ? await listThread(selected.id) : []
  return { agentsOnline: await countAgentsOnline(), cases, selected, thread }
}

export async function resolveSupportCase(caseId: string, note?: string) {
  const userId = await assertRole('admin')
  await assertCanAccessCase(caseId, userId, 'admin')
  await closeSupportCase(caseId, userId, note)
  revalidateOps()
  return { ok: true as const }
}

export async function markNotificationRead(itemId: string) {
  const userId = await assertRole('customer', 'merchant', 'admin')
  return markItemsRead(userId, [itemId])
}

export async function markAllNotificationsRead() {
  const userId = await assertRole('customer', 'merchant', 'admin')
  const role = await getRoleForUser(userId)
  const inbox = await getInbox(userId, role)
  return markItemsRead(
    userId,
    inbox.items.map((it) => it.id),
  )
}
