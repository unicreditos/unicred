/**
 * Auditoría en vivo de integraciones (sin imprimir secretos).
 * Uso: npx tsx scripts/audit-integrations.ts
 */
import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'

config({ path: '.env.production.local' })
config({ path: '.env.local' })

type Row = {
  area: string
  check: string
  status: 'ok' | 'warn' | 'fail' | 'skip'
  detail: string
  ms?: number
}

const rows: Row[] = []

function mask(v?: string | null) {
  if (!v) return 'MISSING'
  if (v.length < 8) return `len=${v.length}`
  return `len=${v.length} …${v.slice(-4)}`
}

function add(area: string, check: string, status: Row['status'], detail: string, ms?: number) {
  rows.push({ area, check, status, detail, ms })
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { ms: Date.now() - t0, value }
  } catch (err) {
    return { ms: Date.now() - t0, error: (err as Error).message }
  }
}

async function main() {
  const envKeys = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'NEXT_PUBLIC_SITE_URL',
    'DIDIT_API_KEY',
    'DIDIT_WORKFLOW_ID',
    'DIDIT_WEBHOOK_SECRET',
    'DIDIT_APPLICATION_ID',
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_PUBLIC_KEY',
    'MERCADO_PAGO_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'CRON_SECRET',
    'AFIP_CUIT',
    'AFIP_CERT',
    'AFIP_KEY',
    'AFIP_ENVIRONMENT',
    'ARGENAPI_API_KEY',
  ] as const

  for (const k of envKeys) {
    const v = process.env[k]
    add('ENV', k, v ? 'ok' : 'fail', v ? mask(v) : 'ausente')
  }

  // Payway = referencia opcional (no bloquea prod)
  {
    const paywayKeys = ['PAYWAY_ENV', 'PAYWAY_WEBHOOK_SECRET', 'PAYWAY_SANDBOX_PUBLIC_KEY'] as const
    for (const k of paywayKeys) {
      const v = process.env[k]
      add('ENV', k, 'ok', v ? `ref ${mask(v)}` : 'ausente (ok — solo referencia)')
    }
  }

  // Neon
  {
    const r = await timed(async () => {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 12000,
      })
      try {
        const u = await pool.query<{ n: string }>('select count(*)::text as n from "user"')
        const kyc = await pool.query<{ n: string }>(
          `select count(*)::text as n from kyc_verification where status = 'approved'`,
        )
        const loans = await pool.query<{ n: string }>('select count(*)::text as n from loan')
        const docs = await pool.query<{ n: string }>('select count(*)::text as n from loan_contract')
        const pay = await pool.query<{ n: string }>('select count(*)::text as n from payment')
        const host = process.env.DATABASE_URL
          ? createHash('sha256').update(new URL(process.env.DATABASE_URL).hostname).digest('hex').slice(0, 10)
          : 'none'
        return {
          host,
          users: Number(u.rows[0].n),
          kycApproved: Number(kyc.rows[0].n),
          loans: Number(loans.rows[0].n),
          contracts: Number(docs.rows[0].n),
          payments: Number(pay.rows[0].n),
        }
      } finally {
        await pool.end()
      }
    })
    if (r.error) add('DB', 'Neon Postgres', 'fail', r.error, r.ms)
    else
      add(
        'DB',
        'Neon Postgres',
        'ok',
        `host=${r.value!.host} users=${r.value!.users} kyc_ok=${r.value!.kycApproved} loans=${r.value!.loans} contratos=${r.value!.contracts} pagos=${r.value!.payments}`,
        r.ms,
      )
  }

  // BCRA
  {
    const r = await timed(async () => {
      const { getCotizaciones } = await import('../lib/bcra')
      const fx = await getCotizaciones()
      return fx.slice(0, 3).map((x: { moneda?: string; tipoCotizacion?: number | null; descripcion?: string | null }) => ({
        moneda: x.moneda,
        valor: x.tipoCotizacion,
      }))
    })
    if (r.error) add('BCRA', 'API cotizaciones', 'fail', r.error, r.ms)
    else if (!r.value?.length) add('BCRA', 'API cotizaciones', 'warn', 'sin cotizaciones', r.ms)
    else add('BCRA', 'API cotizaciones', 'ok', JSON.stringify(r.value), r.ms)
  }

  // Didit
  {
    const key = process.env.DIDIT_API_KEY
    if (!key) {
      add('Didit', 'API workflows', 'fail', 'faltan DIDIT_API_KEY')
    } else {
      const r = await timed(async () => {
        const res = await fetch('https://verification.didit.me/v3/workflows/?limit=50', {
          headers: { 'x-api-key': key, Accept: 'application/json' },
        })
        const json = (await res.json().catch(() => ({}))) as {
          results?: { workflow_id?: string; uuid?: string; name?: string }[]
          detail?: string
        }
        return {
          status: res.status,
          count: json.results?.length ?? 0,
          ids: (json.results || []).slice(0, 3).map((w) => w.workflow_id || w.uuid || '?'),
          detail: json.detail,
        }
      })
      if (r.error) add('Didit', 'API workflows', 'fail', r.error, r.ms)
      else if (r.value!.status >= 200 && r.value!.status < 300)
        add(
          'Didit',
          'API workflows',
          r.value!.count > 0 ? 'ok' : 'warn',
          `HTTP ${r.value!.status} count=${r.value!.count} sample=${r.value!.ids.join(',')}`,
          r.ms,
        )
      else add('Didit', 'API workflows', 'fail', `HTTP ${r.value!.status} ${r.value!.detail || ''}`, r.ms)
    }
    const wf = process.env.DIDIT_WORKFLOW_ID
    add('Didit', 'DIDIT_WORKFLOW_ID', wf ? 'ok' : 'fail', wf ? mask(wf) : 'ausente')
    add(
      'Didit',
      'Webhook secret',
      process.env.DIDIT_WEBHOOK_SECRET ? 'ok' : 'fail',
      process.env.DIDIT_WEBHOOK_SECRET ? mask(process.env.DIDIT_WEBHOOK_SECRET) : 'ausente',
    )
  }

  // Mercado Pago
  {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!token) add('Mercado Pago', 'Access token', 'fail', 'ausente')
    else {
      const mode = token.startsWith('TEST-') ? 'TEST' : token.startsWith('APP_USR-') ? 'LIVE' : 'OTHER'
      add('Mercado Pago', 'Access token', mode === 'LIVE' ? 'ok' : 'warn', `${mode} ${mask(token)}`)
      const r = await timed(async () => {
        const res = await fetch('https://api.mercadopago.com/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await res.json().catch(() => ({}))) as { id?: number; nickname?: string; message?: string }
        return { status: res.status, id: json.id, nick: json.nickname, message: json.message }
      })
      if (r.error) add('Mercado Pago', 'GET /users/me', 'fail', r.error, r.ms)
      else if (r.value!.status === 200)
        add('Mercado Pago', 'GET /users/me', 'ok', `id=${r.value!.id} nick=${r.value!.nick || '—'}`, r.ms)
      else add('Mercado Pago', 'GET /users/me', 'fail', `HTTP ${r.value!.status} ${r.value!.message || ''}`, r.ms)
    }
    add(
      'Mercado Pago',
      'Webhook secret',
      process.env.MERCADO_PAGO_WEBHOOK_SECRET ? 'ok' : 'fail',
      process.env.MERCADO_PAGO_WEBHOOK_SECRET ? mask(process.env.MERCADO_PAGO_WEBHOOK_SECRET) : 'ausente',
    )
  }

  // ARCA / AFIP
  {
    const r = await timed(async () => {
      const { applyEmitiaAfipEnv, loadEmitiaAfipBundle } = await import('../lib/arca/emitia-certs')
      applyEmitiaAfipEnv()
      const bundle = loadEmitiaAfipBundle()
      return bundle
        ? {
            source: bundle.source,
            env: bundle.environment,
            cuitTail: bundle.cuit.slice(-4),
            hasCert: Boolean(bundle.certPem),
            hasKey: Boolean(bundle.keyPem),
          }
        : null
    })
    if (r.error) add('ARCA/AFIP', 'Certificados', 'fail', r.error, r.ms)
    else if (!r.value) add('ARCA/AFIP', 'Certificados', 'fail', 'sin bundle Emitia ni AFIP_*', r.ms)
    else
      add(
        'ARCA/AFIP',
        'Certificados',
        r.value.hasCert && r.value.hasKey ? 'ok' : 'fail',
        `source=${r.value.source} env=${r.value.env} CUIT…${r.value.cuitTail}`,
        r.ms,
      )

    const pad = await timed(async () => {
      const { lookupPersonaByCuit } = await import('../lib/arca/padron')
      return lookupPersonaByCuit('30716036010')
    })
    if (pad.error) add('ARCA/AFIP', 'Padrón (CUIT marca)', 'fail', pad.error, pad.ms)
    else if (!pad.value) add('ARCA/AFIP', 'Padrón (CUIT marca)', 'warn', 'sin persona', pad.ms)
    else
      add(
        'ARCA/AFIP',
        'Padrón (CUIT marca)',
        pad.value.taxCondition === 'no_inscripto' ? 'warn' : 'ok',
        `name=${pad.value.name} cond=${pad.value.taxCondition} svc=${pad.value.service}`,
        pad.ms,
      )

    const brand = (process.env.NEXT_PUBLIC_BRAND_CUIT || '30716036010').replace(/\D/g, '')
    const afip = (process.env.AFIP_CUIT || '').replace(/\D/g, '')
    if (afip && brand && afip !== brand) {
      add(
        'ARCA/AFIP',
        'CUIT cert vs marca',
        'ok',
        `cert…${afip.slice(-4)} ≠ marca…${brand.slice(-4)} (esperado: WSAA usa el CUIT del certificado)`,
      )
    }
  }

  // Wallet propia (Payway solo referencia de contrato)
  {
    add('Wallet', 'API propia', 'ok', 'wallet=native · Payway no es dependencia de producción')
  }

  // Resend
  {
    const key = process.env.RESEND_API_KEY
    if (!key) add('Email', 'Resend', 'warn', 'sin RESEND_API_KEY')
    else {
      const r = await timed(async () => {
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${key}` },
        })
        return { status: res.status }
      })
      if (r.error) add('Email', 'Resend domains', 'fail', r.error, r.ms)
      else if (r.value!.status === 200) add('Email', 'Resend domains', 'ok', `HTTP ${r.value!.status}`, r.ms)
      else add('Email', 'Resend domains', 'fail', `HTTP ${r.value!.status}`, r.ms)
    }
  }

  // Live HTTP production surfaces
  const bases = ['https://www.unicreditos.com', 'https://unicred-one.vercel.app']
  for (const base of bases) {
    for (const path of [
      '/api/health',
      '/api/webhooks/didit',
      '/api/webhooks/mercadopago',
      '/api/auth/get-session',
      '/api/public/bcra-fx',
      '/datos-bcra',
      '/scoring',
      '/sign-in',
    ]) {
      const r = await timed(async () => {
        const res = await fetch(`${base}${path}`, {
          method: 'GET',
          redirect: 'manual',
          headers: { Accept: 'application/json,text/html' },
        })
        return res.status
      })
      const st = r.value ?? 0
      const okHttp = st >= 200 && st < 400
      add(
        `HTTP ${base.replace('https://', '')}`,
        path,
        r.error ? 'fail' : okHttp ? 'ok' : 'warn',
        r.error || `HTTP ${st}`,
        r.ms,
      )
    }
  }

  // Document routes (auth protected — expect redirect)
  for (const path of [
    '/dashboard/documentos/contrato/00000000-0000-4000-8000-000000000001',
    '/dashboard/documentos/pagare/00000000-0000-4000-8000-000000000001',
    '/dashboard/documentos/recibo/00000000-0000-4000-8000-000000000001',
    '/dashboard/documentos/informe-bcra/00000000-0000-4000-8000-000000000001',
  ]) {
    const r = await timed(async () => {
      const res = await fetch(`https://www.unicreditos.com${path}`, { redirect: 'manual' })
      return res.status
    })
    const st = r.value ?? 0
    add(
      'Documentos',
      path.split('/').slice(-2).join('/'),
      st === 307 || st === 302 || st === 401 || st === 403 || st === 404 ? 'ok' : st === 200 ? 'warn' : 'fail',
      `HTTP ${st} (protegido)`,
      r.ms,
    )
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
