/**
 * Cliente de referencia Payway (Prisma) — solo homologación / diseño de contrato.
 * El cobro usable en UNICRÉDITOS es API propia (billetera + Mercado Pago).
 * No es dependencia de producción: puede faltar sin afectar health ni desembolsos.
 */

export type PaywayEnv = 'sandbox' | 'production'

export type PaywayConfig = {
  env: PaywayEnv
  configured: boolean
  simulateAllowed: boolean
  baseUrl: string
  publicKey: string
  secretKey: string
  authB64: string
  accessToken: string
  webhookSecret: string
  projectId: string
}

export type PaywayBinInfo = {
  bin: string
  brand: string
  kind: 'credit' | 'debit' | 'prepaid' | 'unknown'
  bank: string
  source: 'live' | 'sandbox_table'
}

export type PaywayHttpResult = {
  ok: boolean
  status: number
  path: string
  body: unknown
}

const SANDBOX_BINS: Record<string, Omit<PaywayBinInfo, 'bin' | 'source'>> = {
  '450799': { brand: 'Visa', kind: 'credit', bank: 'Payway sandbox' },
  '454643': { brand: 'Visa', kind: 'credit', bank: 'Payway sandbox' },
  '529991': { brand: 'Mastercard', kind: 'credit', bank: 'Payway sandbox' },
  '532362': { brand: 'Mastercard', kind: 'debit', bank: 'Payway sandbox' },
  '377777': { brand: 'American Express', kind: 'credit', bank: 'Payway sandbox' },
  '589562': { brand: 'Naranja', kind: 'credit', bank: 'Payway sandbox' },
  '603522': { brand: 'Cabal', kind: 'credit', bank: 'Payway sandbox' },
}

function trimEnv(name: string) {
  return (process.env[name] ?? '').trim()
}

export function getPaywayConfig(): PaywayConfig {
  const env: PaywayEnv = trimEnv('PAYWAY_ENV') === 'production' ? 'production' : 'sandbox'
  const publicKey = env === 'production' ? trimEnv('PAYWAY_PUBLIC_KEY') : trimEnv('PAYWAY_SANDBOX_PUBLIC_KEY')
  const secretKey = env === 'production' ? trimEnv('PAYWAY_SECRET_KEY') : trimEnv('PAYWAY_SANDBOX_SECRET_KEY')
  const authB64 =
    trimEnv('PAYWAY_SANDBOX_AUTH_B64') ||
    (publicKey && secretKey ? Buffer.from(`${publicKey}:${secretKey}`).toString('base64') : '')
  const baseUrl = (
    trimEnv('PAYWAY_BASE_URL') ||
    (env === 'production' ? 'https://api.payway.com.ar' : 'https://api-sandbox.payway.com.ar')
  ).replace(/\/$/, '')

  return {
    env,
    configured: Boolean(publicKey && secretKey),
    // Nunca simular cobros/cargas salvo flag explícito local (ALLOW_PAYWAY_SIMULATE=1).
    simulateAllowed: env !== 'production' && trimEnv('ALLOW_PAYWAY_SIMULATE') === '1',
    baseUrl,
    publicKey,
    secretKey,
    authB64,
    accessToken: trimEnv('PAYWAY_ACCESS_TOKEN'),
    webhookSecret: trimEnv('PAYWAY_WEBHOOK_SECRET'),
    projectId: trimEnv('PAYWAY_PROJECT_ID'),
  }
}

export function isPaywayConfigured() {
  return getPaywayConfig().configured
}

export function paywayAllowsSimulate() {
  return getPaywayConfig().simulateAllowed
}

export function isPaywayMethod(method: string | null | undefined) {
  return method === 'payway_qr' || method === 'payway_wallet' || method === 'payway_card'
}

export function mapPaywayStatus(status: string | null | undefined): string | null {
  switch (String(status ?? '').toLowerCase()) {
    case 'approved':
    case 'accredited':
    case 'paid':
    case 'success':
      return 'paid'
    case 'rejected':
    case 'cancelled':
    case 'canceled':
    case 'annulled':
      return 'failed'
    case 'refunded':
    case 'returned':
      return 'refunded'
    case 'pending':
    case 'in_process':
    case 'processing':
    case 'authorized':
      return 'processing'
    default:
      return null
  }
}

function authHeader(cfg: PaywayConfig) {
  if (cfg.accessToken) {
    return cfg.accessToken.toLowerCase().startsWith('bearer ')
      ? cfg.accessToken
      : `Bearer ${cfg.accessToken}`
  }
  return cfg.authB64 ? `Basic ${cfg.authB64}` : ''
}

export async function paywayRequest(
  path: string,
  init?: { method?: string; body?: unknown; timeoutMs?: number },
): Promise<PaywayHttpResult> {
  const cfg = getPaywayConfig()
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 12_000)
  try {
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: authHeader(cfg),
        apikey: cfg.secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text.slice(0, 400)
    }
    return { ok: res.ok, status: res.status, path, body }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      path,
      body: { error: err instanceof Error ? err.message : 'payway_unreachable' },
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function probePayway() {
  const bin = await paywayRequest('/v1/ds-bin-integration/public/liveness')
  const qr = await paywayRequest('/v1/decidir_qr_services/health/liveness')
  return {
    configured: isPaywayConfigured(),
    simulateAllowed: paywayAllowsSimulate(),
    binLiveness: bin.status,
    qrLiveness: qr.status,
    live: bin.ok || qr.ok,
  }
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

export function lookupSandboxBin(raw: string): PaywayBinInfo | null {
  const bin = digits(raw).slice(0, 6)
  if (bin.length < 6) return null
  const hit = SANDBOX_BINS[bin]
  if (!hit) return null
  return { bin, ...hit, source: 'sandbox_table' }
}

export async function lookupPaywayBin(raw: string): Promise<PaywayBinInfo | null> {
  const bin = digits(raw).slice(0, 8)
  if (bin.length < 6) return null
  const live = await paywayRequest('/v1/ds-bin-integration/public/reduced-bin-list', {
    method: 'POST',
    body: { bin: bin.slice(0, 6) },
  })
  if (live.ok && live.body && typeof live.body === 'object') {
    const row = Array.isArray(live.body)
      ? (live.body[0] as Record<string, unknown> | undefined)
      : (live.body as Record<string, unknown>)
    const brand = String(row?.brand ?? row?.card_brand ?? row?.marca ?? '').trim()
    if (brand) {
      const kindRaw = String(row?.type ?? row?.product ?? row?.kind ?? '').toLowerCase()
      const kind: PaywayBinInfo['kind'] = kindRaw.includes('deb')
        ? 'debit'
        : kindRaw.includes('prep')
          ? 'prepaid'
          : kindRaw.includes('cred')
            ? 'credit'
            : 'unknown'
      return {
        bin: bin.slice(0, 6),
        brand,
        kind,
        bank: String(row?.bank ?? row?.issuer ?? row?.banco ?? 'Payway'),
        source: 'live',
      }
    }
  }
  return lookupSandboxBin(bin)
}

export async function createPaywayQrAttempt(input: {
  amount: number
  reference: string
  description: string
}) {
  return paywayRequest('/v1/decidir_qr_services/direct_connection_system/payments', {
    method: 'POST',
    body: {
      amount: input.amount,
      currency: 'ARS',
      site_transaction_id: input.reference,
      description: input.description,
    },
  })
}

const WALLET_ACCOUNT_PATHS = [
  '/v1/prisma_wallet_account_services/accounts',
  '/v1/cuenta_virtual/accounts',
  '/v1/virtual_account/accounts',
]

export async function probePaywayWallet() {
  const account = await paywayRequest('/v1/prisma_wallet_account_services/health/liveness')
  const virtual = await paywayRequest('/v1/cuenta_virtual/health/liveness')
  const methods = await paywayRequest('/v1/prisma_wallet_payment_methods_services/health/liveness')
  return {
    accountLiveness: account.status,
    virtualAccountLiveness: virtual.status,
    paymentMethodsLiveness: methods.status,
    live: account.ok || virtual.ok || methods.ok,
  }
}

export async function createPaywayWalletAccountLive(input: {
  reference: string
  holderName: string
  taxId: string
  cvu: string
  alias: string
  email?: string | null
}) {
  const body = {
    site_id: input.reference,
    account_id: input.reference,
    holder_name: input.holderName,
    tax_id: input.taxId,
    identification: { type: 'CUIT', number: input.taxId },
    cvu: input.cvu,
    alias: input.alias,
    email: input.email ?? undefined,
    currency: 'ARS',
    country: 'AR',
  }
  const attempts: PaywayHttpResult[] = []
  for (const path of WALLET_ACCOUNT_PATHS) {
    const result = await paywayRequest(path, { method: 'POST', body, timeoutMs: 8_000 })
    attempts.push(result)
    if (result.ok) return { ok: true as const, path, body: result.body, attempts }
  }
  return { ok: false as const, path: attempts[0]?.path ?? WALLET_ACCOUNT_PATHS[0], body: attempts.at(-1)?.body ?? null, attempts }
}

const WALLET_TRANSFER_PATHS = [
  '/v1/cuenta_virtual/transfers',
  '/v1/virtual_account/transfers',
  '/v1/prisma_wallet_account_services/transfers',
]

export async function createPaywayTransferLive(input: {
  reference: string
  amount: number
  originCvu: string
  originAlias: string
  destination: { kind: 'cbu' | 'cvu' | 'alias'; value: string }
  concept?: string
}) {
  const body = {
    site_transaction_id: input.reference,
    amount: input.amount,
    currency: 'ARS',
    origin: { cvu: input.originCvu, alias: input.originAlias },
    destination: {
      type: input.destination.kind,
      cbu: input.destination.kind !== 'alias' ? input.destination.value : undefined,
      alias: input.destination.kind === 'alias' ? input.destination.value : undefined,
    },
    description: input.concept ?? 'Transferencia UNICRÉDITOS',
  }
  const attempts: PaywayHttpResult[] = []
  for (const path of WALLET_TRANSFER_PATHS) {
    const result = await paywayRequest(path, { method: 'POST', body, timeoutMs: 6_000 })
    attempts.push(result)
    if (result.ok) return { ok: true as const, path, body: result.body, attempts }
  }
  return { ok: false as const, path: attempts[0]?.path ?? WALLET_TRANSFER_PATHS[0], body: attempts.at(-1)?.body ?? null, attempts }
}

export function validatePaywayWebhook(input: {
  secretHeader?: string | null
  querySecret?: string | null
  authorization?: string | null
}) {
  const cfg = getPaywayConfig()
  // Solo secretos de webhook / firma dedicada. Nunca reutilizar accessToken de API.
  const expected = [cfg.webhookSecret].filter(Boolean)
  if (!expected.length) return false
  const bearer = (input.authorization ?? '').replace(/^Bearer\s+/i, '').trim()
  const provided = [input.secretHeader, input.querySecret, bearer]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
  return provided.some((value) => expected.includes(value))
}
