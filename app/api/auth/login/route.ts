import { mobileLogin } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request) {
  try {
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
