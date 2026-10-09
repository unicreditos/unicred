import { auth } from '@/lib/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileClientKey } from '@/lib/mobile/auth'
import { consumeRateLimit } from '@/lib/rate-limit'
import { isEmailConfigured } from '@/lib/email'
import { RESET_MAIL_UNAVAILABLE_MESSAGE, padToMinDuration, resetMailLooksDown } from '@/lib/reset-mail-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    // Mismo límite tanto si el email existe como si no, para no filtrar cuáles
    // están registrados a través del comportamiento del rate limit.
    const limit = await consumeRateLimit(`mobile-reset:${mobileClientKey(req)}`, 5, 60 * 60 * 1000)
    if (!limit.ok) {
      return mobileJson(req, { message: 'Demasiadas solicitudes. Probá más tarde.' }, { status: 429 })
    }
    if (resetMailLooksDown({ configured: isEmailConfigured(), production: process.env.NODE_ENV === 'production' })) {
      await padToMinDuration(startedAt)
      return mobileJson(req, { message: RESET_MAIL_UNAVAILABLE_MESSAGE }, { status: 503 })
    }
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
    await padToMinDuration(startedAt)
    return mobileJson(req, {
      success: true,
      message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.',
    })
  } catch (err) {
    return mobileJson(req, { message: (err as Error).message }, { status: 500 })
  }
}
