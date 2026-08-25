import { getSession, getDashboardUrlForUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ dashboardUrl: '/sign-in' })
  }
  const dashboardUrl = await getDashboardUrlForUser(session.user.id)
  return NextResponse.json({ dashboardUrl })
}
