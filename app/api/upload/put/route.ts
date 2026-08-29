import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileStoreUploadBlob } from '@/lib/mobile/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function PUT(req: Request) {
  try {
    const userId = await requireMobileUserId(req)
    const path = new URL(req.url).searchParams.get('path')?.trim()
    if (!path) return mobileJson(req, { message: 'path requerido' }, { status: 400 })
    if (!path.startsWith(`mobile/${userId}/`)) {
      return mobileJson(req, { message: 'Path no autorizado' }, { status: 403 })
    }

    const contentType = req.headers.get('content-type') || 'application/octet-stream'
    const buf = Buffer.from(await req.arrayBuffer())
    if (!buf.length) return mobileJson(req, { message: 'Archivo vacío' }, { status: 400 })
    if (buf.length > 4_000_000) {
      return mobileJson(req, { message: 'Archivo demasiado grande (máx. 4MB)' }, { status: 413 })
    }

    await mobileStoreUploadBlob(userId, path, contentType, buf.toString('base64'))
    return mobileJson(req, { ok: true, path })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status =
      /unauthor/i.test(message) || message === 'unauthorized'
        ? 401
        : /No autorizado|Path/i.test(message)
          ? 403
          : 400
    return mobileJson(req, { message }, { status })
  }
}
