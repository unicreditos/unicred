import { mobileSignup } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: string
      password?: string
      name?: string
    } | null
    const email = String(body?.email ?? '')
    const password = String(body?.password ?? '')
    const name = String(body?.name ?? '')
    if (!email || !password) return mobileJson(req, { message: 'Email y contraseña requeridos' }, { status: 400 })
    const result = await mobileSignup(email, password, name)
    return mobileJson(req, result, { status: 201 })
  } catch (err) {
    const message = (err as Error).message || 'No se pudo registrar'
    const status = /ya está registrado/i.test(message) ? 409 : 400
    return mobileJson(req, { message }, { status })
  }
}
