import { handleSendCode } from '@/lib/second-factor-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Clientes y comercios: código de 6 dígitos por correo para la sesión actual. */
export async function POST(req: Request) {
  return handleSendCode(req)
}