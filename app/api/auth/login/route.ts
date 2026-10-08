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
    // Además del límite por IP: por cuenta, para frenar la fuerza bruta distribuida contra un mismo email.
    const perAccount = await consumeRateLimit(`mobile-login-email:${email.toLowerCase().trim().slice(0, 200)}`, 8, 15 * 60 * 1000)
    if (!perAccount.ok) {
      return mobileJson(req, { message: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' }, { status: 429 })
    }
    const result = await mobileLogin(email, password)
    return mobileJson(req, result)
  } catch (err) {
    // Siempre el mismo texto: ningún error interno (base, red) se devuelve al cliente.
    console.warn('[login] fallo:', (err as Error)?.message)
    return mobileJson(req, { message: 'Credenciales inválidas' }, { status: 401 })
  }
}
