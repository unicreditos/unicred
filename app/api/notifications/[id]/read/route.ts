import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { markItemsRead } from '@/lib/inbox-read'
import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

async function resolveUserId(req: Request) {
  const bearer = req.headers.get('authorization')
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    return requireMobileUserId(req)
  }
  const session = await getSession()
  return session?.user?.id ?? null
}

export async function PUT(req: Request, { params }: { params: Promise<Record<string, string>> }) {
  try {
    const userId = await resolveUserId(req)
    if (!userId) {
      if (req.headers.get('authorization')) return mobileJson(req, { message: 'unauthorized' }, { status: 401 })
      return NextResponse.json({ message: 'unauthorized' }, { status: 401 })
    }
    const id = String((await params).id ?? '')
    const result = await markItemsRead(userId, [id])
    if (req.headers.get('authorization')) return mobileJson(req, { success: true, ...result })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    const status = /unauthor/i.test(message) ? 401 : 400
    if (req.headers.get('authorization')) return mobileJson(req, { message }, { status })
    return NextResponse.json({ message }, { status })
  }
}
