'use server'

import { db } from '@/lib/db'
import { ensureSupportCaseTable } from '@/lib/db/ensure-support-case'
import { supportCase } from '@/lib/db/schema'
import { notifySupportClaim } from '@/lib/notify-email'
import { revalidateCustomer, revalidateOps } from '@/lib/revalidate'
import { assertRole, newId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

const CATEGORIES = ['cobros', 'identidad', 'desembolso', 'contrato', 'otro'] as const
export type ClaimCategory = (typeof CATEGORIES)[number]

function asCategory(value: string): ClaimCategory {
  return (CATEGORIES as readonly string[]).includes(value) ? (value as ClaimCategory) : 'otro'
}

export async function listMyClaims() {
  const userId = await assertRole('customer')
  await ensureSupportCaseTable()
  return db
    .select()
    .from(supportCase)
    .where(eq(supportCase.userId, userId))
    .orderBy(desc(supportCase.createdAt))
    .limit(40)
}

export async function createClaim(input: { category: string; subject: string; body: string }) {
  const userId = await assertRole('customer')
  await ensureSupportCaseTable()

  const subject = String(input.subject ?? '').trim().slice(0, 160)
  const body = String(input.body ?? '').trim().slice(0, 4000)
  if (subject.length < 8) throw new Error('El asunto debe tener al menos 8 caracteres.')
  if (body.length < 20) throw new Error('Describí el reclamo con al menos 20 caracteres.')

  const id = newId('case')
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
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  void notifySupportClaim({ userId, caseId: row.id, subject: row.subject })
  revalidateCustomer()
  revalidateOps()
  return { ok: true as const, id: row.id }
}

export async function listOpenClaimsAdmin() {
  await assertRole('admin')
  await ensureSupportCaseTable()
  return db.select().from(supportCase).orderBy(desc(supportCase.createdAt)).limit(80)
}

export async function respondClaimAdmin(id: string, response: string) {
  await assertRole('admin')
  await ensureSupportCaseTable()
  const text = String(response ?? '').trim().slice(0, 4000)
  if (text.length < 8) throw new Error('La respuesta debe tener al menos 8 caracteres.')
  const now = new Date()
  await db
    .update(supportCase)
    .set({
      response: text,
      status: 'resolved',
      respondedAt: now,
      updatedAt: now,
    })
    .where(and(eq(supportCase.id, id)))
  revalidateOps()
  return { ok: true as const }
}
