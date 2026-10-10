import { handleSendCode } from '@/lib/second-factor-api'
import { assertAdmin } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Envía al correo del operador un código de 6 dígitos (10 min, 5 envíos por hora). */
export async function POST(req: Request) {
  return handleSendCode(req, () => assertAdmin({ skipSecondFactor: true }))
}