'use server'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const WORKFLOW_ID = 'f173150d-cc2e-47ba-879c-ef32e6fcd1df'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.DIDIT_API_KEY) return NextResponse.json({ error: 'Identity provider is not configured.' }, { status: 503 })

  const base = process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

  const response = await fetch('https://verification.didit.me/v3/session/', {
    method: 'POST',
    headers: { 'x-api-key': process.env.DIDIT_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_id: WORKFLOW_ID,
      vendor_data: session.user.id,
      callback: `${base}/dashboard?verification=complete`,
    }),
    cache: 'no-store',
  })
  if (!response.ok) return NextResponse.json({ error: 'No se pudo iniciar la verificación.' }, { status: 502 })
  const data = await response.json()
  return NextResponse.json({ url: data.url, session_id: data.session_id })
}
