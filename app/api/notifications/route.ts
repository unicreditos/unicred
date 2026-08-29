import { requireMobileUserId } from '@/lib/mobile/auth'
import { mobileJson, mobileOptions } from '@/lib/mobile/cors'
import { mobileNotifications } from '@/lib/mobile/ops'
import { getSession } from '@/lib/session'
import { getInbox } from '@/lib/notifications'
import { getRoleForUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function OPTIONS(req: Request) {
  return mobileOptions(req)
}

/** Compatible cookie (web) + Bearer (mobile). */
export async function GET(req: Request) {
  const bearer = req.headers.get('authorization')
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    try {
      const userId = await requireMobileUserId(req)
      const u = new URL(req.url)
      return mobileJson(
        req,
        await mobileNotifications(
          userId,
          Number(u.searchParams.get('page') || 1),
          Number(u.searchParams.get('limit') || 20),
        ),
      )
    } catch {
      return mobileJson(req, { items: [], total: 0, page: 1, totalPages: 1 }, { status: 401 })
    }
  }

  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], stamp: '', unreadHint: 0 }, { status: 401 })
  }
  const role = await getRoleForUser(session.user.id)
  const inbox = await getInbox(session.user.id, role)
  return NextResponse.json(inbox)
}
