import { auth } from '@/lib/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string } | null
    const email = String(body?.email ?? '').trim()
    if (email) {
      try {
        await auth.api.requestPasswordReset({
          body: {
            email,
            redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.unicreditos.com').replace(/\/$/, '')}/restablecer-clave`,
          },
        })
      } catch {
        // Misma respuesta genérica
      }
    }
    return mobileJson(req, {
      success: true,
      message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.',
    })
  } catch (err) {
    return mobileJson(req, { message: (err as Error).message }, { status: 500 })
  }
}
