import { getInbox } from '@/lib/notifications'
import { getRoleForUser, getSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], stamp: '', unreadHint: 0 }, { status: 401 })
  }
  const role = await getRoleForUser(session.user.id)
  const inbox = await getInbox(session.user.id, role)
  return NextResponse.json(inbox)
}
