import { NextResponse } from 'next/server'
import { checkEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const env = checkEnv()
  let database: 'ok' | 'error' | 'unconfigured' = 'unconfigured'

  if (process.env.DATABASE_URL) {
    try {
      const { pool } = await import('@/lib/db')
      await pool.query('select 1 as ok')
      database = 'ok'
    } catch {
      database = 'error'
    }
  }

  let bcra: 'ok' | 'error' | 'empty' = 'empty'
  try {
    const { getCotizaciones } = await import('@/lib/bcra')
    const fx = await getCotizaciones()
    bcra = fx.length ? 'ok' : 'empty'
  } catch {
    bcra = 'error'
  }

  // Payway es solo referencia de diseño; cobro/billetera = API propia UNICRÉDITOS.
  const wallet = 'native' as const
  let paywayRef: 'configured' | 'absent' = 'absent'
  try {
    const { getPaywayConfig } = await import('@/lib/payway')
    paywayRef = getPaywayConfig().configured ? 'configured' : 'absent'
  } catch {
    paywayRef = 'absent'
  }

  let dbHost = 'none'
  try {
    if (process.env.DATABASE_URL) {
      const { createHash } = await import('node:crypto')
      const host = new URL(process.env.DATABASE_URL).hostname
      dbHost = createHash('sha256').update(host).digest('hex').slice(0, 10)
    }
  } catch {
    dbHost = 'invalid'
  }

  let users = -1
  try {
    if (database === 'ok') {
      const { pool } = await import('@/lib/db')
      const r = await pool.query<{ n: string }>('select count(*)::text as n from "user"')
      users = Number(r.rows[0]?.n || 0)
    }
  } catch {
    users = -1
  }

  const cron = process.env.CRON_SECRET?.trim() ? 'ok' : 'missing'
  const ok = env.ok && database !== 'error'

  return NextResponse.json(
    {
      ok,
      service: 'unicred',
      time: new Date().toISOString(),
      database,
      dbHost,
      users,
      bcra,
      wallet,
      paywayRef,
      cron,
      env: {
        missingRequired: env.missingRequired.length,
        missingOptional: env.missingOptional.length,
      },
    },
    { status: ok ? 200 : 503 },
  )
}
