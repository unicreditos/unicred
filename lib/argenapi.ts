import { isValidBankAlias, normalizeBankAlias } from '@/lib/finance'

const API_KEY = process.env.ARGENAPI_API_KEY ?? ''
const BASE_URL = (process.env.ARGENAPI_BASE_URL ?? 'https://www.argenapi.com/api/v1').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.ARGENAPI_TIMEOUT_MS ?? 10000)

export type ArgenAPIStatus =
  | 'success'
  | 'not_found'
  | 'invalid_format'
  | 'timeout'
  | 'api_error'
  | 'missing_key'
  | 'bad_request'

export type ArgenAPIResult = {
  ok: boolean
  status: ArgenAPIStatus
  message?: string
  httpStatus?: number
  raw?: any
  data?: {
    cbu?: string
    cvu?: string
    alias?: string
    entidad?: string
    banco?: string
    codigoEntidad?: string
    sucursal?: string
    tipoCuenta?: string
    numeroCuenta?: string
    titular?: string
    titularNombre?: string
    titularApellido?: string
    tipoDocumento?: string
    numeroDocumento?: string
    cuit?: string
    cuil?: string
    fechaNacimiento?: string
    provincia?: string
    localidad?: string
    domicilio?: string
    codigoPostal?: string
    estado?: string
    activa?: boolean
    bloqueada?: boolean
    fechaAlta?: string
    digitoVerificador1?: string
    digitoVerificador2?: string
    moneda?: string
  }
}

const cfgSet = !!API_KEY

if (!cfgSet) {
  console.warn('[argenapi] ARGENAPI_API_KEY no configurada — modo deshabilitado')
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

function normalizeHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'UniCred/1.0',
  }
}

function cleanCBU(input: string): string {
  return (input || '').replace(/\D/g, '').slice(0, 22)
}

function validateCBUFormat(cbu: string): boolean {
  return /^\d{22}$/.test(cbu)
}

export { normalizeBankAlias }

export function mapLookupResponse(r: any): ArgenAPIResult {
  const httpStatus = Number(r?.httpStatus ?? r?.statusCode ?? r?.status ?? 0) || 0
  const msg = r?.message ?? r?.error ?? r?.code ?? null

  if (httpStatus === 401 || httpStatus === 403) {
    return { ok: false, status: 'missing_key', message: msg || 'API key inválida', httpStatus, raw: r }
  }
  if (httpStatus === 404) {
    return { ok: false, status: 'not_found', message: msg || 'CBU/alias no encontrado', httpStatus, raw: r }
  }
  if (httpStatus === 400) {
    return { ok: false, status: 'invalid_format', message: msg || 'Identificador inválido', httpStatus, raw: r }
  }
  if (httpStatus === 405) {
    return { ok: false, status: 'api_error', message: msg || 'Método no permitido en ArgenAPI', httpStatus, raw: r }
  }
  if (httpStatus && httpStatus >= 500) {
    return { ok: false, status: 'api_error', message: msg || `HTTP ${httpStatus}`, httpStatus, raw: r }
  }

  const success = r?.success === true || r?.code === 200
  const payload = r?.data ?? null
  if (!success || !payload) {
    return {
      ok: false,
      status: httpStatus === 200 ? 'api_error' : 'bad_request',
      message: msg || 'Respuesta ArgenAPI sin datos',
      httpStatus: httpStatus || 200,
      raw: r,
    }
  }

  const holder = Array.isArray(payload.holders) ? payload.holders[0] : null
  const bank = payload.bank ?? {}
  const account = payload.account ?? {}
  const titular =
    holder?.full_name ||
    payload.titular ||
    (payload.titular_nombre && payload.titular_apellido
      ? `${payload.titular_nombre} ${payload.titular_apellido}`
      : '') ||
    payload.holder_name ||
    ''
  const cuit = holder?.tax_id || payload.cuit || payload.cuil || payload.holder_cuit || ''
  const entidad = bank.name || payload.entidad || payload.banco || payload.nombre_entidad || ''
  const number = account.number || payload.cbu || payload.cvu || payload.numero_cuenta || ''
  const scheme = String(account.scheme || payload.account_scheme || '').toUpperCase()
  const activa =
    typeof payload.active === 'boolean'
      ? payload.active
      : typeof payload.activa === 'boolean'
        ? payload.activa
        : payload.estado === 'ACTIVA' || payload.status === 'active'
  const alias = normalizeBankAlias(payload.alias || '')

  return {
    ok: true,
    status: 'success',
    message: msg ?? undefined,
    httpStatus: httpStatus || 200,
    raw: r,
    data: {
      cbu: scheme === 'CVU' ? undefined : cleanCBU(String(number || payload.cbu || '')),
      cvu: scheme === 'CVU' ? cleanCBU(String(number || payload.cvu || '')) : payload.cvu || undefined,
      alias: alias || undefined,
      entidad,
      banco: entidad,
      codigoEntidad: bank.code || payload.codigo_entidad || payload.entity_code || '',
      sucursal: payload.sucursal || payload.branch || '',
      tipoCuenta: payload.account_type || payload.tipo_cuenta || '',
      numeroCuenta: String(number || ''),
      titular,
      titularNombre: holder?.full_name || payload.titular_nombre || '',
      titularApellido: payload.titular_apellido || '',
      tipoDocumento: holder?.tax_id_type || payload.tipo_documento || 'CUIT',
      numeroDocumento: payload.numero_documento || payload.documento || '',
      cuit: String(cuit),
      cuil: String(cuit),
      fechaNacimiento: payload.fecha_nacimiento || '',
      provincia: payload.provincia || '',
      localidad: payload.localidad || '',
      domicilio: payload.domicilio || '',
      codigoPostal: payload.codigo_postal || '',
      estado: activa ? 'ACTIVA' : payload.estado || 'INACTIVA',
      activa,
      bloqueada: typeof payload.bloqueada === 'boolean' ? payload.bloqueada : false,
      fechaAlta: payload.fecha_alta || '',
      moneda: payload.currency || payload.moneda || 'ARS',
    },
  }
}

async function lookup(identifier: string, type: 'cbu' | 'alias'): Promise<ArgenAPIResult> {
  if (!cfgSet) {
    return {
      ok: false,
      status: 'missing_key',
      message: 'ARGENAPI_API_KEY no configurada en el servidor',
    }
  }
  const url = `${BASE_URL}/lookup`
  try {
    const resp = await timeout(
      fetch(url, {
        method: 'POST',
        headers: normalizeHeaders(),
        cache: 'no-store',
        body: JSON.stringify({ identifier, identifier_type: type }),
      }),
      TIMEOUT_MS,
    )
    const json = await resp.json().catch(() => null)
    return mapLookupResponse({ ...(json || {}), httpStatus: resp.status, statusCode: resp.status })
  } catch (e: any) {
    const err = e?.message ?? String(e)
    return {
      ok: false,
      status: err === 'timeout' ? 'timeout' : 'api_error',
      message: err,
    }
  }
}

export async function validateCBU(cbuRaw: string): Promise<ArgenAPIResult> {
  const cbu = cleanCBU(cbuRaw)
  if (!validateCBUFormat(cbu)) {
    return {
      ok: false,
      status: 'invalid_format',
      message: 'CBU/CVU debe tener 22 dígitos numéricos',
    }
  }
  return lookup(cbu, 'cbu')
}

export async function resolveAlias(aliasRaw: string): Promise<ArgenAPIResult> {
  const alias = normalizeBankAlias(aliasRaw)
  if (!isValidBankAlias(alias)) {
    return {
      ok: false,
      status: 'invalid_format',
      message: 'Alias inválido: 6 a 20 caracteres, letras, números y punto. Sin @.',
    }
  }
  return lookup(alias, 'alias')
}

export async function validateCVU(cvuRaw: string): Promise<ArgenAPIResult> {
  return validateCBU(cvuRaw)
}

export async function validateBankAccountAuto(opts: {
  cbu?: string | null
  cvu?: string | null
  alias?: string | null
}): Promise<{
  best: ArgenAPIResult | null
  cbu?: ArgenAPIResult
  cvu?: ArgenAPIResult
  alias?: ArgenAPIResult
}> {
  const tasks: Promise<any>[] = []
  let didCbu: ArgenAPIResult | undefined
  let didCvu: ArgenAPIResult | undefined
  let didAlias: ArgenAPIResult | undefined

  if (opts.cbu) {
    tasks.push(validateCBU(opts.cbu).then((r) => (didCbu = r)))
  }
  if (opts.cvu && opts.cvu !== opts.cbu) {
    tasks.push(validateCVU(opts.cvu).then((r) => (didCvu = r)))
  }
  if (opts.alias) {
    tasks.push(resolveAlias(opts.alias).then((r) => (didAlias = r)))
  }

  await Promise.all(tasks)

  const all: (ArgenAPIResult | undefined)[] = [didCbu, didCvu, didAlias]
  const oks = all.filter((x) => x && x.ok && x.data && x.data.bloqueada !== true) as ArgenAPIResult[]
  const best = oks[0] ?? (didCbu || didCvu || didAlias || null)
  return {
    best,
    cbu: didCbu,
    cvu: didCvu,
    alias: didAlias,
  }
}

export const ARGENAPI_CONFIG = {
  apiKeySet: cfgSet,
  baseUrl: BASE_URL,
  timeoutMs: TIMEOUT_MS,
}
