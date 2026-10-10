import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureMerchantAdminSchema } from '@/lib/db/ensure-merchant-admin'
import { merchant } from '@/lib/db/schema'
import { consumeRateLimit } from '@/lib/rate-limit'
import { getSession } from '@/lib/session'
import { cleanMessage, documentChecklist } from '@/lib/merchant-admin-core'
import * as S from '@/lib/merchant-admin-store'
import type { SqlExecutor } from '@/lib/otp-pg-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

async function mine() {
  const session = await getSession()
  const userId = session?.user?.id
  if (!userId) return null
  const [m] = await db.select().from(merchant).where(eq(merchant.userId, userId)).limit(1)
  return m ? { userId, m } : null
}

/** Documentación exigida + historial de mensajes del propio comercio (sin las notas internas). Al abrirla marca como leídos los del admin. */
export async function GET() {
  const ctx = await mine()
  if (!ctx) return NextResponse.json({ ok: false, error: 'Ingresá con la cuenta de tu comercio.' }, { status: 401, headers: noStore })
  await ensureMerchantAdminSchema()
  const sx = db as unknown as SqlExecutor
  const [docs, messages, unread] = await Promise.all([
    S.listMerchantDocsWith(sx, ctx.m.id),
    S.listMessagesWith(sx, ctx.m.id, { includeNotes: false }),
    S.countUnreadWith(sx, ctx.m.id, 'merchant'),
  ])
  await S.markReadWith(sx, { merchantId: ctx.m.id, readerRole: 'merchant', reader: ctx.userId })
  return NextResponse.json(
    {
      ok: true,
      unread,
      checklist: documentChecklist(ctx.m.personType, ctx.m.representativeRole, docs),
      messages: messages.map((x) => ({ id: x.id, from: x.authorRole, author: x.authorRole === 'admin' ? 'Unicréditos' : 'Vos', kind: x.kind, body: x.body, requestedDocType: x.requestedDocType, hasDocument: Boolean(x.documentId), createdAt: x.createdAt, readAt: x.readAt })),
    },
    { headers: noStore },
  )
}

/** Respuesta de texto del comercio. La carga del archivo va por /api/merchant/documents y deja su propio mensaje. */
export async function POST(request: Request) {
  const ctx = await mine()
  if (!ctx) return NextResponse.json({ ok: false, error: 'Ingresá con la cuenta de tu comercio.' }, { status: 401, headers: noStore })
  const gate = await consumeRateLimit(`merch-msg:${ctx.userId}`, 20, 10 * 60 * 1000)
  if (!gate.ok) return NextResponse.json({ ok: false, error: 'Demasiados mensajes. Esperá unos minutos.' }, { status: 429, headers: noStore })
  const body = (await request.json().catch(() => null)) as { body?: string; replyToId?: string } | null
  const c = cleanMessage(body?.body)
  if (!c.ok) return NextResponse.json({ ok: false, error: c.error }, { status: 400, headers: noStore })
  await ensureMerchantAdminSchema()
  const id = await S.addMessageWith(db as unknown as SqlExecutor, { merchantId: ctx.m.id, authorUserId: ctx.userId, authorRole: 'merchant', kind: 'reply', body: c.body, replyToId: null })
  return NextResponse.json({ ok: true, id }, { headers: noStore })
}
