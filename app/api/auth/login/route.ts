import { mobileLogin, mobileClientKey } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { consumeRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request) {
  try {
    // Sin esto, cualquiera podía probar contraseñas sin freno: fuerza bruta
    // por IP contra cualquier cuenta.
    const limit = await consumeRateLimit(`mobile-login:${mobileClientKey(req)}`, 10, 15 * 60 * 1000)
    if (!limit.ok) {
      return mobileJson(req, { message: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' }, { status: 429 })
    }
    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null
    const email = String(body?.email ?? '')
    const password = String(body?.password ?? '')
    if (!email || !password) return mobileJson(req, { message: 'Email y contraseña requeridos' }, { status: 400 })
    const result = await mobileLogin(email, password)
    return mobileJson(req, result)
  } catch (err) {
    return mobileJson(req, { message: (err as Error).message || 'Credenciales inválidas' }, { status: 401 })
  }
}
