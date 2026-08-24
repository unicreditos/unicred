import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { lookupBankAccount, lookupTaxIdentity } from '@/lib/provider-adapters'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
  const type = body?.type === 'tax' ? 'tax' : body?.type === 'bank' ? 'bank' : null
  if (!type || identifier.length < 3 || identifier.length > 120) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  try {
    const result = type === 'bank'
      ? await lookupBankAccount(identifier)
      : await lookupTaxIdentity(identifier)
    return NextResponse.json({ provider: type === 'bank' ? 'ArgenAPI' : 'Nosis/ARCA', result })
  } catch (error) {
    console.error('[v0] provider lookup failed', error)
    return NextResponse.json({ error: 'Proveedor no configurado o consulta no disponible' }, { status: 503 })
  }
}
