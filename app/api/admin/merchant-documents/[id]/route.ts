import { db } from '@/lib/db'
import { ensureMerchantAdminSchema } from '@/lib/db/ensure-merchant-admin'
import { readMerchantDocVerifiedWith } from '@/lib/merchant-admin-store'
import type { SqlExecutor } from '@/lib/otp-pg-store'
import { auditAdminView } from '@/lib/admin-desk/load'
import { assertAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Solo estos tipos se muestran dentro del navegador; el resto se descarga (nunca se interpreta como página). */
const INLINE_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let adminId: string
  try {
    adminId = await assertAdmin()
  } catch (err) {
    // 401 sin sesión / 403 sin rol: antes caía en un 500 por el redirect de requireAdmin.
    const expired = /venció/.test(err instanceof Error ? err.message : '')
    return NextResponse.json({ error: 'No autorizado' }, { status: expired ? 401 : 403, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!(await hasPermission(adminId, 'merchants.read'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }

  const { id } = await context.params
  await ensureMerchantAdminSchema()
  // Verifica la huella SHA-256 antes de entregar y deja constancia del acceso (quién, cuándo, resultado).
  const doc = await readMerchantDocVerifiedWith(db as unknown as SqlExecutor, {
    documentId: id,
    actor: adminId,
    ip: _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: _request.headers.get('user-agent'),
  })
  if (!doc.ok) {
    if (doc.reason === 'hash_mismatch') {
      return NextResponse.json({ error: 'El archivo no coincide con su huella registrada. No se entrega.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  await auditAdminView(adminId, 'documento_comercio', id)

  const bytes = doc.bytes
  const inline = INLINE_MIME.has(doc.mime)
  const safeName = doc.fileName.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'documento'
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': inline ? doc.mime : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'Content-Length': String(bytes.length),
      // El contenido lo subió un tercero: aunque lo abran desde el origen del backoffice, no puede ejecutar nada.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
