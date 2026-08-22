export type ProviderStatus = { provider: string; configured: boolean; live: boolean; reason: string }

const configured = (keys: string[]) => keys.every((key) => Boolean(process.env[key]))

export function getProviderStatus(): ProviderStatus[] {
  return [
    { provider: 'Didit', configured: Boolean(process.env.DIDIT_API_KEY && process.env.DIDIT_WEBHOOK_SECRET), live: true, reason: 'KYC con sesión y webhook firmado habilitados.' },
    { provider: 'BCRA', configured: true, live: true, reason: 'APIs públicas consultadas desde servidor.' },
    { provider: 'ArgenAPI', configured: configured(['ARGENAPI_API_KEY', 'ARGENAPI_BASE_URL']), live: configured(['ARGENAPI_API_KEY', 'ARGENAPI_BASE_URL']), reason: 'Requiere contrato, endpoint base y credencial del comercio.' },
    { provider: 'Nosis', configured: configured(['NOSIS_API_KEY', 'NOSIS_BASE_URL']), live: configured(['NOSIS_API_KEY', 'NOSIS_BASE_URL']), reason: 'Requiere contrato y credenciales privadas.' },
    { provider: 'ARCA', configured: configured(['ARCA_API_KEY', 'ARCA_BASE_URL']), live: configured(['ARCA_API_KEY', 'ARCA_BASE_URL']), reason: 'La consulta depende de autorización y servicio habilitado.' },
    { provider: 'Pagos', configured: false, live: false, reason: 'No hay PSP conectado; no se crean pagos, QR ni comprobantes.' },
  ]
}

async function providerGet(baseUrlKey: string, apiKey: string, path: string, params: Record<string, string>) {
  const baseUrl = process.env[baseUrlKey]
  const token = process.env[apiKey]
  if (!baseUrl || !token) throw new Error('Proveedor no configurado: faltan credenciales o endpoint contratado.')
  const url = new URL(path, baseUrl)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error(`El proveedor respondió ${response.status}`)
  return response.json()
}

export function lookupBankAccount(identifier: string) {
  return providerGet('ARGENAPI_BASE_URL', 'ARGENAPI_API_KEY', '/lookup', { identifier })
}

export function lookupTaxIdentity(identifier: string) {
  const baseKey = process.env.NOSIS_BASE_URL ? 'NOSIS_BASE_URL' : 'ARCA_BASE_URL'
  const tokenKey = process.env.NOSIS_BASE_URL ? 'NOSIS_API_KEY' : 'ARCA_API_KEY'
  return providerGet(baseKey, tokenKey, '/lookup', { identifier })
}
