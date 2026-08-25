import { db } from '@/lib/db'
import { merchantDocument } from '@/lib/db/schema'
import { requireAdmin } from '@/app/actions/admin'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await context.params
  const [doc] = await db.select().from(merchantDocument).where(eq(merchantDocument.id, id)).limit(1)
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }
  const bytes = Buffer.from(doc.content, 'base64')
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': doc.mime,
      'Content-Disposition': `inline; filename="${doc.fileName.replace(/"/g, '')}"`,
      'Content-Length': String(bytes.length),
    },
  })
}
