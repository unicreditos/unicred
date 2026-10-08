import { NextResponse } from 'next/server'
import { checkEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Público: solo "¿está vivo y ve la base?" (para el monitoreo). El detalle interno (variables faltantes,
 * integraciones, cron) solo se entrega con HEALTH_DETAIL_TOKEN: a un desconocido le serviría para elegir qué atacar.
 */
export async function GET(req: Request) {
  const token = process.env.HEALTH_DETAIL_TOKEN?.trim()
  const detailed = Boolean(token) && req.headers.get('x-health-token') === token
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
  if (detailed) {
    try {
      const { getCotizaciones } = await import('@/lib/bcra')
      const fx = await getCotizaciones()
      bcra = fx.length ? 'ok' : 'empty'
    } catch {
      bcra = 'error'
    }
  }

  const wallet = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ? 'configured' : 'unconfigured'
  const paywayRef = 'not_configured' as const

  const cron = process.env.CRON_SECRET?.trim() ? 'ok' : 'missing'
  const ok = env.ok && database !== 'error'

  return NextResponse.json(
    detailed
      ? {
          ok,
          service: 'unicred',
          time: new Date().toISOString(),
          database,
          bcra,
          wallet,
          paywayRef,
          cron,
          env: {
            missingRequired: env.missingRequired.length,
            missingOptional: env.missingOptional.length,
          },
        }
      : { ok, service: 'unicred', time: new Date().toISOString() },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
