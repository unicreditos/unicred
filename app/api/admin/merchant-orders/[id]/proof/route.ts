import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { ensureMerchantCommerceSchema } from '@/lib/db/ensure-merchant-commerce'
import { merchantOrder } from '@/lib/db/schema'
import { hasPermission } from '@/lib/rbac'
import { assertAdmin } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INLINE_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const noStore = { 'Cache-Control': 'no-store' }

/** Comprobante de transferencia del anticipo (solo tesorería / cobranzas). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let adminId: string
  try {
    adminId = await assertAdmin()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStore })
  }
  if (!(await hasPermission(adminId, 'payments.read'))) return NextResponse.json({ error: 'No autorizado' }, { status: 403, headers: noStore })
  const { id } = await context.params
  await ensureMerchantCommerceSchema()
  const [row] = await db.select({ proof: merchantOrder.downPaymentProof, code: merchantOrder.code }).from(merchantOrder).where(eq(merchantOrder.id, id)).limit(1)
  const m = row?.proof?.match(/^data:([a-z/+.-]+);base64,(.+)$/)
  if (!row || !m) return NextResponse.json({ error: 'Sin comprobante' }, { status: 404, headers: noStore })
  await recordAudit({ actorUserId: adminId, action: 'DOWN_PAYMENT_PROOF_VIEWED', entityType: 'merchant_order', entityId: id, summary: 'Vio el comprobante del anticipo' })
  const mime = m[1]
  return new NextResponse(new Uint8Array(Buffer.from(m[2], 'base64')), {
    headers: {
      ...noStore,
      'Content-Type': INLINE_MIME.has(mime) ? mime : 'application/octet-stream',
      'Content-Disposition': `${INLINE_MIME.has(mime) ? 'inline' : 'attachment'}; filename="anticipo-${row.code}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
