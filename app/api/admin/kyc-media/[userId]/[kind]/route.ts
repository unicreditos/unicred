import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { kycVerification } from '@/lib/db/schema'
import { hasPermission } from '@/lib/rbac'
import { assertAdmin } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLUMNS = {
  front: kycVerification.dniFrontImageUrl,
  back: kycVerification.dniBackImageUrl,
  selfie: kycVerification.selfieImageUrl,
  video: kycVerification.videoUrl,
} as const

type Kind = keyof typeof COLUMNS

function mediaResponse(stored: string) {
  const data = stored.match(/^data:([^;,]+);base64,([\s\S]+)$/)
  if (data) {
    const bytes = Buffer.from(data[2], 'base64')
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': data[1],
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  }
  if (/^https?:\/\//i.test(stored)) {
    return Response.redirect(stored, 302)
  }
  return new Response('Captura no disponible', { status: 404 })
}

/** Sirve una captura Didit del legajo. Solo un admin con permiso de clientes o KYC. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string; kind: string }> }) {
  try {
    const adminId = await assertAdmin()
    const allowed =
      (await hasPermission(adminId, 'kyc.review')) || (await hasPermission(adminId, 'clients.read'))
    if (!allowed) return new Response('No autorizado', { status: 403 })

    const { userId, kind } = await params
    const column = COLUMNS[kind as Kind]
    if (!column || !userId) return new Response('No encontrado', { status: 404 })

    const [row] = await db
      .select({ url: column })
      .from(kycVerification)
      .where(eq(kycVerification.userId, userId))
      .limit(1)
    if (!row?.url) return new Response('No encontrado', { status: 404 })
    return mediaResponse(row.url)
  } catch {
    return new Response('No autorizado', { status: 401 })
  }
}
