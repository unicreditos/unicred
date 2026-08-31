import { db } from '@/lib/db'
import { ensureSupportCaseTable } from '@/lib/db/ensure-support-case'
import { loan, supportCase, supportMessage, supportPresence, user as userTable } from '@/lib/db/schema'
import { type Role, newId } from '@/lib/session'
import { and, desc, eq, gt, inArray } from 'drizzle-orm'

export const AGENT_ONLINE_MS = 45_000
export const SUPPORT_CATEGORIES = ['cobros', 'identidad', 'desembolso', 'contrato', 'comercio', 'otro'] as const
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]

export type SupportMessageDTO = {
  id: string
  caseId: string
  authorUserId: string
  authorRole: string
  authorName: string
  body: string
  kind: 'message' | 'system'
  createdAt: string
}

export type SupportCaseDTO = {
  id: string
  userId: string
  userName: string
  userEmail: string
  category: string
  subject: string
  status: string
  channel: string
  waitingOn: string
  relatedLoanId: string | null
  lastMessageAt: string | null
  lastAgentSeenAt: string | null
  lastPreview: string
  unread: number
}

function asCategory(value: string | undefined): SupportCategory {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(value ?? '')
    ? (value as SupportCategory)
    : 'otro'
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null
  return new Date(value).toISOString()
}

export async function heartbeatPresence(userId: string, role: Role, viewingCaseId?: string | null) {
  await ensureSupportCaseTable()
  const now = new Date()
  const patch: { role: string; lastSeenAt: Date; viewingCaseId?: string | null } = {
    role,
    lastSeenAt: now,
  }
  if (viewingCaseId !== undefined) patch.viewingCaseId = viewingCaseId || null
  await db
    .insert(supportPresence)
    .values({
      userId,
      role,
      viewingCaseId: viewingCaseId || null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: supportPresence.userId,
      set: patch,
    })
}

export async function countAgentsOnline() {
  try {
    await ensureSupportCaseTable()
    const since = new Date(Date.now() - AGENT_ONLINE_MS)
    const rows = await db
      .select({ userId: supportPresence.userId })
      .from(supportPresence)
      .where(and(eq(supportPresence.role, 'admin'), gt(supportPresence.lastSeenAt, since)))
    return rows.length
  } catch {
    return 0
  }
}

export async function getOrOpenChatCase(
  userId: string,
  input?: { category?: string; relatedLoanId?: string | null },
) {
  await ensureSupportCaseTable()
  const [existing] = await db
    .select()
    .from(supportCase)
    .where(and(eq(supportCase.userId, userId), eq(supportCase.channel, 'chat'), inArray(supportCase.status, ['open', 'in_review'])))
    .orderBy(desc(supportCase.lastMessageAt), desc(supportCase.createdAt))
    .limit(1)

  if (existing) {
    if (input?.relatedLoanId && !existing.relatedLoanId) {
      await db
        .update(supportCase)
        .set({ relatedLoanId: input.relatedLoanId, updatedAt: new Date() })
        .where(eq(supportCase.id, existing.id))
      return { ...existing, relatedLoanId: input.relatedLoanId }
    }
    return existing
  }

  const now = new Date()
  const id = newId('case')
  const [row] = await db
    .insert(supportCase)
    .values({
      id,
      userId,
      category: asCategory(input?.category),
      subject: 'Chat de soporte',
      body: 'Consulta en línea desde el panel.',
      status: 'open',
      channel: 'chat',
      lawRef: 'Ley 24.240',
      waitingOn: 'agent',
      relatedLoanId: input?.relatedLoanId || null,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return row
}

export async function insertSupportMessage(input: {
  caseId: string
  authorUserId: string
  authorRole: Role | 'system'
  body: string
  kind?: 'message' | 'system'
}) {
  await ensureSupportCaseTable()
  const body = String(input.body ?? '').trim().slice(0, 4000)
  if (input.kind !== 'system' && body.length < 1) throw new Error('Escribí un mensaje.')
  const now = new Date()
  const [row] = await db
    .insert(supportMessage)
    .values({
      id: newId('smsg'),
      caseId: input.caseId,
      authorUserId: input.authorUserId,
      authorRole: input.authorRole,
      body: body || '—',
      kind: input.kind ?? 'message',
      createdAt: now,
    })
    .returning()

  const patch: {
    lastMessageAt: Date
    updatedAt: Date
    waitingOn?: string
    status?: string
    assignedAdminId?: string
  } = {
    lastMessageAt: now,
    updatedAt: now,
  }
  if (input.kind !== 'system') {
    patch.waitingOn = input.authorRole === 'admin' ? 'customer' : 'agent'
    if (input.authorRole === 'admin') {
      patch.assignedAdminId = input.authorUserId
      patch.status = 'in_review'
    } else {
      patch.status = 'open'
    }
  }
  await db.update(supportCase).set(patch).where(eq(supportCase.id, input.caseId))
  return row
}

export async function listThread(caseId: string): Promise<SupportMessageDTO[]> {
  await ensureSupportCaseTable()
  const rows = await db
    .select({
      id: supportMessage.id,
      caseId: supportMessage.caseId,
      authorUserId: supportMessage.authorUserId,
      authorRole: supportMessage.authorRole,
      body: supportMessage.body,
      kind: supportMessage.kind,
      createdAt: supportMessage.createdAt,
      authorName: userTable.name,
    })
    .from(supportMessage)
    .innerJoin(userTable, eq(supportMessage.authorUserId, userTable.id))
    .where(eq(supportMessage.caseId, caseId))
    .orderBy(supportMessage.createdAt)
    .limit(200)

  if (rows.length) {
    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      authorUserId: row.authorUserId,
      authorRole: row.authorRole,
      authorName: row.authorRole === 'system' ? 'UNICRÉDITOS' : row.authorName || 'Usuario',
      body: row.body,
      kind: row.kind === 'system' ? 'system' : 'message',
      createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    }))
  }

  const [legacy] = await db.select().from(supportCase).where(eq(supportCase.id, caseId)).limit(1)
  if (legacy?.body && legacy.body !== 'Consulta en línea desde el panel.') {
    await insertSupportMessage({
      caseId,
      authorUserId: legacy.userId,
      authorRole: 'customer',
      body: legacy.body,
    })
    if (legacy.response) {
      await insertSupportMessage({
        caseId,
        authorUserId: viewerFallback(legacy),
        authorRole: 'system',
        kind: 'system',
        body: legacy.response,
      })
    }
    return listThread(caseId)
  }

  return []
}

function viewerFallback(row: typeof supportCase.$inferSelect) {
  return row.assignedAdminId || row.userId
}

export async function markCaseViewed(caseId: string, viewerUserId: string, viewerRole: Role) {
  await ensureSupportCaseTable()
  const [row] = await db.select().from(supportCase).where(eq(supportCase.id, caseId)).limit(1)
  if (!row) throw new Error('Trámite no encontrado.')
  const now = new Date()

  if (viewerRole === 'admin') {
    const recent =
      row.lastAgentSeenAt && Date.now() - row.lastAgentSeenAt.getTime() < 120_000
    if (!recent) {
      const thread = await listThread(caseId)
      const lastUserMsg = [...thread].reverse().find((m) => m.kind === 'message' && m.authorRole !== 'admin' && m.authorRole !== 'system')
      const lastViewing = [...thread].reverse().find((m) => m.kind === 'system' && /viendo tu consulta/i.test(m.body))
      if (lastUserMsg && (!lastViewing || lastViewing.createdAt < lastUserMsg.createdAt)) {
        await insertSupportMessage({
          caseId,
          authorUserId: viewerUserId,
          authorRole: 'system',
          kind: 'system',
          body: 'Un operador está viendo tu consulta. Te responde por este chat.',
        })
      }
    }
    await db
      .update(supportCase)
      .set({
        lastAgentSeenAt: now,
        assignedAdminId: viewerUserId,
        status: row.status === 'open' ? 'in_review' : row.status,
        updatedAt: now,
      })
      .where(eq(supportCase.id, caseId))
  } else {
    await db
      .update(supportCase)
      .set({ lastCustomerSeenAt: now, updatedAt: now })
      .where(eq(supportCase.id, caseId))
  }

  await heartbeatPresence(viewerUserId, viewerRole, caseId)
  try {
    const { markItemsRead } = await import('@/lib/inbox-read')
    const thread = await listThread(caseId)
    await markItemsRead(viewerUserId, [
      `case-${caseId}`,
      `adm-case-${caseId}`,
      ...thread.map((m) => `msg-${m.id}`),
    ])
  } catch {
    /* recibo de inbox opcional */
  }
}

export async function assertCanAccessCase(caseId: string, userId: string, role: Role) {
  await ensureSupportCaseTable()
  const [row] = await db.select().from(supportCase).where(eq(supportCase.id, caseId)).limit(1)
  if (!row) throw new Error('Trámite no encontrado.')
  if (role !== 'admin' && row.userId !== userId) throw new Error('No autorizado')
  return row
}

export async function hydrateCases(
  rows: (typeof supportCase.$inferSelect)[],
  viewerRole: Role,
): Promise<SupportCaseDTO[]> {
  if (!rows.length) return []
  const userIds = [...new Set(rows.map((r) => r.userId))]
  const people = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(inArray(userTable.id, userIds))
  const byId = new Map(people.map((u) => [u.id, u]))

  const caseIds = rows.map((r) => r.id)
  const messages = await db
    .select({
      id: supportMessage.id,
      caseId: supportMessage.caseId,
      authorRole: supportMessage.authorRole,
      body: supportMessage.body,
      createdAt: supportMessage.createdAt,
    })
    .from(supportMessage)
    .where(inArray(supportMessage.caseId, caseIds))
    .orderBy(desc(supportMessage.createdAt))
    .limit(400)

  const lastByCase = new Map<string, (typeof messages)[number]>()
  for (const msg of messages) {
    if (!lastByCase.has(msg.caseId)) lastByCase.set(msg.caseId, msg)
  }

  return rows.map((row) => {
    const last = lastByCase.get(row.id)
    const seenAt = viewerRole === 'admin' ? row.lastAgentSeenAt : row.lastCustomerSeenAt
    let unread = 0
    for (const msg of messages) {
      if (msg.caseId !== row.id) continue
      const fromOther =
        viewerRole === 'admin'
          ? msg.authorRole !== 'admin' && msg.authorRole !== 'system'
          : msg.authorRole === 'admin' || msg.authorRole === 'system'
      if (!fromOther) continue
      if (!seenAt || msg.createdAt > seenAt) unread += 1
    }
    const person = byId.get(row.userId)
    return {
      id: row.id,
      userId: row.userId,
      userName: person?.name || 'Cliente',
      userEmail: person?.email || '',
      category: row.category,
      subject: row.subject,
      status: row.status,
      channel: row.channel,
      waitingOn: row.waitingOn,
      relatedLoanId: row.relatedLoanId,
      lastMessageAt: iso(row.lastMessageAt ?? last?.createdAt ?? row.createdAt),
      lastAgentSeenAt: iso(row.lastAgentSeenAt),
      lastPreview: last?.body?.slice(0, 140) || row.body.slice(0, 140),
      unread,
    }
  })
}

export async function listUserCases(userId: string) {
  await ensureSupportCaseTable()
  const rows = await db
    .select()
    .from(supportCase)
    .where(eq(supportCase.userId, userId))
    .orderBy(desc(supportCase.lastMessageAt), desc(supportCase.createdAt))
    .limit(40)
  return hydrateCases(rows, 'customer')
}

export async function listAdminCases() {
  await ensureSupportCaseTable()
  const rows = await db
    .select()
    .from(supportCase)
    .orderBy(desc(supportCase.lastMessageAt), desc(supportCase.createdAt))
    .limit(80)
  return hydrateCases(rows, 'admin')
}

export async function listRelatedLoans(userId: string) {
  return db
    .select({
      id: loan.id,
      status: loan.status,
      principal: loan.principal,
      createdAt: loan.createdAt,
    })
    .from(loan)
    .where(eq(loan.userId, userId))
    .orderBy(desc(loan.createdAt))
    .limit(12)
}

export async function closeSupportCase(caseId: string, adminUserId: string, note?: string) {
  await ensureSupportCaseTable()
  const now = new Date()
  const text = String(note ?? '').trim().slice(0, 4000)
  if (text) {
    await insertSupportMessage({
      caseId,
      authorUserId: adminUserId,
      authorRole: 'admin',
      body: text,
    })
  }
  await db
    .update(supportCase)
    .set({
      status: 'resolved',
      waitingOn: 'none',
      response: text || undefined,
      respondedAt: now,
      updatedAt: now,
    })
    .where(eq(supportCase.id, caseId))
}

export { asCategory }
