export type ProviderStatus = { provider: string; configured: boolean; live: boolean; reason: string }

const configured = (keys: string[]) => keys.every((key) => Boolean(process.env[key]))
const enabled = (key: string) => process.env[key] === 'true'

export function getProviderStatus(): ProviderStatus[] {
  const diditConfigured = configured(['DIDIT_API_KEY', 'DIDIT_WEBHOOK_SECRET'])
  const argenConfigured = enabled('PROVIDER_ARGENAPI_ENABLED') && configured(['ARGENAPI_API_KEY', 'ARGENAPI_BASE_URL'])
  const nosisConfigured = enabled('PROVIDER_NOSIS_ENABLED') && configured(['NOSIS_API_KEY', 'NOSIS_BASE_URL'])
  const arcaConfigured = enabled('PROVIDER_ARCA_ENABLED') && configured(['ARCA_API_KEY', 'ARCA_BASE_URL'])
  const paymentsConfigured = enabled('PAYMENTS_ENABLED') && enabled('PROVIDER_MERCADOPAGO_ENABLED') && configured(['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'])
  return [
    { provider: 'Didit', configured: diditConfigured, live: diditConfigured, reason: diditConfigured ? 'KYC con sesión y webhook firmado habilitados.' : 'Faltan credenciales privadas del proveedor.' },
    { provider: 'BCRA', configured: true, live: true, reason: 'APIs públicas consultadas desde servidor; el resultado no constituye aprobación crediticia.' },
    { provider: 'ArgenAPI', configured: argenConfigured, live: argenConfigured, reason: argenConfigured ? 'Lookup de cuenta habilitado con proveedor contratado.' : 'Requiere habilitar la bandera, contrato, endpoint y credencial.' },
    { provider: 'Nosis', configured: nosisConfigured, live: nosisConfigured, reason: nosisConfigured ? 'Consulta de identidad habilitada con proveedor contratado.' : 'Requiere habilitar la bandera, contrato, endpoint y credencial.' },
    { provider: 'ARCA', configured: arcaConfigured, live: arcaConfigured, reason: arcaConfigured ? 'Consulta habilitada con autorización correspondiente.' : 'Requiere habilitar la bandera, autorización, endpoint y credencial.' },
    { provider: 'Mercado Pago', configured: paymentsConfigured, live: paymentsConfigured, reason: paymentsConfigured ? 'Cobros habilitados; requiere webhook verificado y conciliación.' : 'No se crean cobros hasta configurar proveedor y webhook.' },
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
