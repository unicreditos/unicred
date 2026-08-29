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

  const ok = env.ok && database !== 'error'
  let payway: 'ok' | 'sandbox' | 'missing' = 'missing'
  try {
    const { getPaywayConfig } = await import('@/lib/payway')
    const cfg = getPaywayConfig()
    if (cfg.configured) payway = cfg.env === 'production' ? 'ok' : 'sandbox'
  } catch {
    payway = 'missing'
  }

  return NextResponse.json(
    {
      ok,
      service: 'unicred',
      time: new Date().toISOString(),
      database,
      bcra,
      payway,
      // Solo conteos: no exponer nombres de variables de entorno en público.
      env: {
        missingRequired: env.missingRequired.length,
        missingOptional: env.missingOptional.length,
      },
    },
    { status: ok ? 200 : 503 },
  )
}
