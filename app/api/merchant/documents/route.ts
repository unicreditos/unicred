import { deleteMerchantDocumentFile, saveMerchantDocumentFile } from '@/lib/merchant-documents'
import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function mimeOf(file: File) {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] || file.type || 'application/octet-stream'
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Ingresá para adjuntar documentos.' }, { status: 401 })
  }
  const form = await request.formData()
  const type = String(form.get('type') ?? '')
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Adjuntá un archivo.' }, { status: 400 })
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const saved = await saveMerchantDocumentFile({
    userId: session.user.id,
    type,
    fileName: file.name,
    mime: mimeOf(file),
    bytes,
  })
  return NextResponse.json(saved, { status: saved.ok ? 200 : 400 })
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Ingresá para borrar documentos.' }, { status: 401 })
  }
  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta el documento.' }, { status: 400 })
  }
  const deleted = await deleteMerchantDocumentFile(session.user.id, id)
  return NextResponse.json(deleted, { status: deleted.ok ? 200 : 400 })
}
