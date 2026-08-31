// Cliente para las APIs públicas del Banco Central de la República Argentina (BCRA).
// Catálogo: https://www.bcra.gob.ar/apis-banco-central/
//
// Cubiertas:
// - Central de Deudores v1.0 (deudas, históricas, cheques rechazados)
// - Cheques denunciados v1.0 (entidades + denuncia por banco/número)
// - Estadísticas cambiarias v1.0 (divisas, cotizaciones, serie por moneda)
// - Estadísticas monetarias v4.0 (Monetarias, serie, metodología, Informe Monetario Diario)
// - Régimen de Transparencia v1.0 (cajas, paquetes, plazos fijos, préstamos, tarjetas)
//
// El certificado del BCRA a veces no encadena bien en Node. Si falla TLS,
// reintentamos solo contra api.bcra.gob.ar.

import https from 'node:https'
import { URL } from 'node:url'

const BCRA_BASE = 'https://api.bcra.gob.ar'

const COMMON_HEADERS: Record<string, string> = {
  'Accept-Language': 'es-AR',
  Accept: 'application/json',
  'User-Agent': 'UNICREDITOS/1.0 (+https://unicreditos.com)',
}

export function normalizeCuit(value: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidCuit(value: string): boolean {
  const cuit = normalizeCuit(value)
  if (!/^\d{11}$/.test(cuit)) return false
  const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cuit[i], 10) * factors[i]
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return parseInt(cuit[10], 10) === expected
}

type BcraHttpResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; error: string }

function bcraHttpsRequest(url: string, allowInsecure: boolean): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        protocol: 'https:',
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers: COMMON_HEADERS,
        timeout: 18000,
        rejectUnauthorized: !allowInsecure,
        servername: u.hostname,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
    req.on('error', reject)
    req.end()
  })
}

async function bcraRawGet(path: string): Promise<{ status: number; json: any | null; error?: string }> {
  const url = `${BCRA_BASE}${path}`
  try {
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      cache: 'no-store',
    })
    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { status: res.status, json }
  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    const tls = /certificate|UNABLE_TO_VERIFY|unable to verify|cert/i.test(msg)
    try {
      const first = await bcraHttpsRequest(url, false).catch(async (e) => {
        if (tls || /certificate|UNABLE_TO_VERIFY|unable to verify|cert/i.test((e as Error).message ?? '')) {
          return bcraHttpsRequest(url, true)
        }
        throw e
      })
      let json: any = null
      try {
        json = first.body ? JSON.parse(first.body) : null
      } catch {
        json = null
      }
      return { status: first.status, json }
    } catch (e2) {
      return { status: 0, json: null, error: (e2 as Error).message ?? msg }
    }
  }
}

async function bcraFetch<T>(path: string): Promise<BcraHttpResult<T>> {
  const raw = await bcraRawGet(path)
  if (raw.error && !raw.json) {
    console.warn(`[bcra] ${path} error:`, raw.error)
    return { ok: false, status: raw.status || null, error: raw.error }
  }
  if (raw.status >= 200 && raw.status < 300) {
    return { ok: true, status: raw.status, data: raw.json as T }
  }
  if (raw.status === 404) {
    return { ok: false, status: 404, error: 'not_found' }
  }
  console.warn(`[bcra] ${path} respondió ${raw.status}`)
  return { ok: false, status: raw.status, error: `http_${raw.status}` }
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    u.set(key, String(value))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

function asArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

/* --------------------------- Central de Deudores --------------------------- */

export type BcraDeudaEntidad = {
  entidad: string
  situacion: number
  monto: number
  diasAtrasoPago?: number
  fechaSit1?: string
  refinanciaciones?: boolean
  recategorizacionOblig?: boolean
  situacionJuridica?: boolean
  irrecDisposicionTecnica?: boolean
  enRevision?: boolean
  procesoJud?: boolean
}

export type BcraPeriodoResumen = {
  periodo: string
  entidades: BcraDeudaEntidad[]
  worstSituation: number | null
  totalDebt: number
}

export type DeudaResumen = {
  found: boolean
  unavailable?: boolean
  denominacion: string | null
  identificacion?: string | number | null
  periodo?: string | null
  periodos?: BcraPeriodoResumen[]
  worstSituation: number | null
  totalDebt: number
  entitiesCount: number
  entidades: BcraDeudaEntidad[]
}

const EMPTY_DEUDA: DeudaResumen = {
  found: false,
  unavailable: false,
  denominacion: null,
  identificacion: null,
  periodo: null,
  periodos: [],
  worstSituation: null,
  totalDebt: 0,
  entitiesCount: 0,
  entidades: [],
}

function flag(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

function mapEntidad(e: any): BcraDeudaEntidad {
  return {
    entidad: String(e?.entidad ?? e?.nombreEntidad ?? 'Entidad'),
    situacion: Number(e?.situacion) || 0,
    monto: (Number(e?.monto) || 0) * 1000,
    diasAtrasoPago: e?.diasAtrasoPago != null ? Number(e.diasAtrasoPago) : undefined,
    fechaSit1: e?.fechaSit1 ? String(e.fechaSit1) : undefined,
    refinanciaciones: flag(e?.refinanciaciones),
    recategorizacionOblig: flag(e?.recategorizacionOblig),
    situacionJuridica: flag(e?.situacionJuridica),
    irrecDisposicionTecnica: flag(e?.irrecDisposicionTecnica),
    enRevision: flag(e?.enRevision),
    procesoJud: flag(e?.procesoJud),
  }
}

function summarizePeriodo(p: any): BcraPeriodoResumen {
  const entidades: BcraDeudaEntidad[] = Array.isArray(p?.entidades) ? p.entidades.map(mapEntidad) : []
  const worstSituation = entidades.length ? Math.max(...entidades.map((e: BcraDeudaEntidad) => e.situacion)) : null
  const totalDebt = entidades.reduce((acc: number, e: BcraDeudaEntidad) => acc + e.monto, 0)
  return {
    periodo: String(p?.periodo ?? ''),
    entidades,
    worstSituation,
    totalDebt,
  }
}

let _deudasOverride: DeudaResumen | null = null
export function _setDeudasOverride(deuda: DeudaResumen | null) {
  _deudasOverride = deuda
}
export function _clearDeudasOverride() {
  _deudasOverride = null
}

function summarizeDeuda(payload: any): DeudaResumen {
  const results = payload?.results ?? payload
  const periodos: BcraPeriodoResumen[] = Array.isArray(results?.periodos)
    ? results.periodos.map(summarizePeriodo).filter((p: BcraPeriodoResumen) => p.periodo || p.entidades.length)
        .sort((a: BcraPeriodoResumen, b: BcraPeriodoResumen) => b.periodo.localeCompare(a.periodo))
    : []
  const latest = periodos[0]
  const latestEntidades = latest?.entidades ?? []
  const allEntidades = periodos.flatMap((p: BcraPeriodoResumen) => p.entidades)
  const worstSituation = allEntidades.length ? Math.max(...allEntidades.map((e: BcraDeudaEntidad) => e.situacion)) : null
  return {
    found: Boolean(results?.denominacion || results?.identificacion || periodos.length),
    unavailable: false,
    denominacion: results?.denominacion ?? null,
    identificacion: results?.identificacion ?? null,
    periodo: latest?.periodo ?? null,
    periodos,
    worstSituation,
    totalDebt: latest?.totalDebt ?? 0,
    entitiesCount: latestEntidades.length,
    entidades: latestEntidades,
  }
}

export async function getDeudas(cuit: string): Promise<DeudaResumen> {
  if (_deudasOverride) return _deudasOverride
  const clean = normalizeCuit(cuit)
  if (!clean) return { ...EMPTY_DEUDA, unavailable: true }

  const paths = [
    `/centraldedeudores/v1.0/Deudas/${clean}`,
    `/CentralDeDeudores/v1.0/Deudas/${clean}`,
  ]
  for (const path of paths) {
    const data = await bcraFetch<any>(path)
    if (data.ok) return summarizeDeuda(data.data)
    if (data.status === 404) return { ...EMPTY_DEUDA }
  }
  return { ...EMPTY_DEUDA, unavailable: true }
}

export async function getDeudasHistoricas(cuit: string): Promise<DeudaResumen> {
  const clean = normalizeCuit(cuit)
  if (!clean) return { ...EMPTY_DEUDA, unavailable: true }
  const paths = [
    `/centraldedeudores/v1.0/Deudas/Historicas/${clean}`,
    `/CentralDeDeudores/v1.0/Deudas/Historicas/${clean}`,
  ]
  for (const path of paths) {
    const data = await bcraFetch<any>(path)
    if (data.ok) return summarizeDeuda(data.data)
    if (data.status === 404) return { ...EMPTY_DEUDA }
  }
  return { ...EMPTY_DEUDA, unavailable: true }
}

/* --------------------------- Cheques denunciados v1.0 --------------------------- */

export type ChequeEntidad = {
  codigoEntidad: number
  denominacion: string
}

export type ChequeDenunciadoDetalle = {
  sucursal?: number | null
  numeroCuenta?: number | string | null
  causal?: string | null
}

export type ChequeDenunciado = {
  found: boolean
  unavailable?: boolean
  denunciado: boolean
  numeroCheque?: number | string | null
  fechaProcesamiento?: string | null
  denominacionEntidad?: string | null
  detalles: ChequeDenunciadoDetalle[]
  raw: unknown
}

export async function getChequesEntidades(): Promise<ChequeEntidad[]> {
  const data = await bcraFetch<any>(`/cheques/v1.0/entidades`)
  if (!data.ok) return []
  return asArray(data.data?.results).map((e: any) => ({
    codigoEntidad: Number(e?.codigoEntidad ?? e?.codigo ?? 0),
    denominacion: String(e?.denominacion ?? e?.nombre ?? ''),
  })).filter((e: ChequeEntidad) => e.codigoEntidad > 0)
}

export async function getChequeDenunciado(
  codigoEntidad: number | string,
  numeroCheque: number | string,
): Promise<ChequeDenunciado> {
  const banco = encodeURIComponent(String(codigoEntidad).replace(/\D/g, ''))
  const nro = encodeURIComponent(String(numeroCheque).replace(/\D/g, ''))
  if (!banco || !nro) {
    return { found: false, denunciado: false, detalles: [], raw: null }
  }
  const data = await bcraFetch<any>(`/cheques/v1.0/denunciados/${banco}/${nro}`)
  if (!data.ok) {
    return {
      found: false,
      unavailable: data.status !== 404,
      denunciado: false,
      detalles: [],
      raw: data,
    }
  }
  const results = data.data?.results ?? data.data
  return {
    found: true,
    denunciado: Boolean(results?.denunciado),
    numeroCheque: results?.numeroCheque ?? nro,
    fechaProcesamiento: results?.fechaProcesamiento ?? null,
    denominacionEntidad: results?.denominacionEntidad ?? null,
    detalles: asArray(results?.detalles).map((d: any) => ({
      sucursal: d?.sucursal ?? null,
      numeroCuenta: d?.numeroCuenta ?? null,
      causal: d?.causal ?? null,
    })),
    raw: data.data,
  }
}

export type ChequeRechazado = {
  entidad?: string
  nroCheque?: string | number
  fechaRechazo?: string
  fechaPago?: string
  monto?: number
  causal?: string
  enRevision?: boolean
  procesoJud?: boolean
}

export type ChequesRechazadosResumen = {
  found: boolean
  unavailable: boolean
  denominacion?: string | null
  count: number
  cheques: ChequeRechazado[]
}

export async function getChequesRechazados(cuit: string): Promise<ChequesRechazadosResumen> {
  const clean = normalizeCuit(cuit)
  const empty: ChequesRechazadosResumen = {
    found: false,
    unavailable: false,
    denominacion: null,
    count: 0,
    cheques: [],
  }
  if (!clean) return { ...empty, unavailable: true }

  const paths = [
    `/centraldedeudores/v1.0/Deudas/ChequesRechazados/${clean}`,
    `/CentralDeDeudores/v1.0/Deudas/ChequesRechazados/${clean}`,
  ]

  const pushCheque = (cheques: ChequeRechazado[], e: any, causalName?: string) => {
    cheques.push({
      entidad: e?.entidad ?? e?.nombreEntidad,
      nroCheque: e?.nroCheque ?? e?.numeroCheque ?? e?.numero,
      fechaRechazo: e?.fechaRechazo ?? e?.fecha,
      fechaPago: e?.fechaPago ?? undefined,
      monto: typeof e?.monto === 'number' ? e.monto * 1000 : e?.monto != null ? Number(e.monto) * 1000 : undefined,
      causal: causalName ?? e?.causal,
      enRevision: flag(e?.enRevision ?? e?.revisionPersonal),
      procesoJud: flag(e?.procesoJud),
    })
  }

  for (const path of paths) {
    const data = await bcraFetch<any>(path)
    if (data.status === 404) return empty
    if (!data.ok) continue
    const results = data.data?.results ?? data.data
    const cheques: ChequeRechazado[] = []
    const causales = results?.causales ?? results?.periodos ?? []
    if (Array.isArray(causales)) {
      for (const c of causales) {
        const causalName = c?.causal ?? c?.descripcion ?? undefined
        const entidades = c?.entidades ?? c?.detalle ?? [c]
        for (const e of Array.isArray(entidades) ? entidades : []) pushCheque(cheques, e, causalName)
      }
    }
    if (Array.isArray(results?.cheques)) {
      for (const e of results.cheques) pushCheque(cheques, e)
    }
    return {
      found: cheques.length > 0 || Boolean(results?.identificacion || results?.denominacion),
      unavailable: false,
      denominacion: results?.denominacion ?? null,
      count: cheques.length,
      cheques,
    }
  }

  return { ...empty, unavailable: true }
}

/* -------------------------- Estadísticas monetarias v4.0 -------------------------- */
// Docs: https://principales-variables.bcra.apidocs.ar/
// Incluye Informe Monetario Diario. Fallback a v3/v2 por deprecación gradual.

export type VariableBCRA = {
  idVariable: number
  descripcion: string
  fecha: string
  valor: number
  categoria?: string | null
  tipoSerie?: string | null
  periodicidad?: string | null
  unidadExpresion?: string | null
  moneda?: string | null
  primerFechaInformada?: string | null
}

export type SerieMonetariaPunto = {
  idVariable: number
  fecha: string
  valor: number
}

export type MetodologiaVariable = {
  id: number
  detalle: string
}

export type MonetariasQuery = {
  idVariable?: number | string
  categoria?: string
  periodicidad?: string
  moneda?: string
  tipoSerie?: string
  unidadExpresion?: string
  limit?: number
  offset?: number
}

function normalizeVariables(payload: any): VariableBCRA[] {
  const list =
    (Array.isArray(payload?.results) && payload.results) ||
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.results?.variables) && payload.results.variables) ||
    []
  return list
    .map((v: any) => {
      const id = Number(v.idVariable ?? v.id_variable ?? v.id ?? 0)
      const valor = Number(v.valor ?? v.value ?? v.ultimoValor ?? v.ultValorInformado ?? 0)
      const fecha = String(v.fecha ?? v.fechaValor ?? v.effectiveDate ?? v.ultFechaInformada ?? '')
      const descripcion = String(v.descripcion ?? v.descripcionVar ?? v.variable ?? v.nombre ?? `Variable #${id}`)
      if (!id && !descripcion) return null
      return {
        idVariable: id,
        descripcion,
        fecha,
        valor,
        categoria: v.categoria != null ? String(v.categoria) : null,
        tipoSerie: v.tipoSerie != null ? String(v.tipoSerie) : null,
        periodicidad: v.periodicidad != null ? String(v.periodicidad) : null,
        unidadExpresion: v.unidadExpresion != null ? String(v.unidadExpresion) : null,
        moneda: v.moneda != null ? String(v.moneda) : null,
        primerFechaInformada: v.primerFechaInformada ? String(v.primerFechaInformada) : null,
      }
    })
    .filter(Boolean) as VariableBCRA[]
}

function flattenSerieMonetaria(payload: any, fallbackId = 0): SerieMonetariaPunto[] {
  const results = asArray(payload?.results)
  const points: SerieMonetariaPunto[] = []
  for (const row of results) {
    const id = Number(row?.idVariable ?? fallbackId)
    const detalle = asArray(row?.detalle)
    if (detalle.length) {
      for (const d of detalle) {
        points.push({
          idVariable: id,
          fecha: String(d?.fecha ?? ''),
          valor: Number(d?.valor ?? 0),
        })
      }
      continue
    }
    if (row?.fecha != null || row?.valor != null) {
      points.push({
        idVariable: id,
        fecha: String(row?.fecha ?? ''),
        valor: Number(row?.valor ?? 0),
      })
    }
  }
  if (!points.length) {
    return normalizeVariables(payload).map((v) => ({
      idVariable: v.idVariable,
      fecha: v.fecha,
      valor: v.valor,
    }))
  }
  return points.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
}

export async function getMonetarias(query: MonetariasQuery = {}): Promise<VariableBCRA[]> {
  const path = `/estadisticas/v4.0/Monetarias${qs({
    IdVariable: query.idVariable,
    Categoria: query.categoria,
    Periodicidad: query.periodicidad,
    Moneda: query.moneda,
    TipoSerie: query.tipoSerie,
    UnidadExpresion: query.unidadExpresion,
    Limit: query.limit ?? 200,
    Offset: query.offset,
  })}`
  const data = await bcraFetch<any>(path)
  if (data.ok) {
    const vars = normalizeVariables(data.data)
    if (vars.length) return vars
  }
  return []
}

export async function getPrincipalesVariables(): Promise<VariableBCRA[]> {
  const v4 = await getMonetarias({ limit: 200 })
  if (v4.length) return v4
  const fallbacks = [
    `/estadisticas/v3.0/monetarias`,
    `/estadisticas/v2.0/principalesvariables`,
  ]
  for (const path of fallbacks) {
    const data = await bcraFetch<any>(path)
    if (data.ok) {
      const vars = normalizeVariables(data.data)
      if (vars.length) return vars
    }
  }
  return []
}

export async function getInformeMonetarioDiario(): Promise<VariableBCRA[]> {
  const filtered = await getMonetarias({ categoria: 'Informe Monetario Diario', limit: 300 })
  if (filtered.length) return filtered
  const all = await getPrincipalesVariables()
  return all.filter((v) => {
    const cat = `${v.categoria ?? ''} ${v.descripcion}`.toLowerCase()
    return cat.includes('informe monetario') || cat.includes('diario')
  })
}

export async function getVariableMonetaria(
  idVariable: number | string,
  opts?: { desde?: string; hasta?: string; limit?: number; offset?: number },
): Promise<SerieMonetariaPunto[]> {
  const id = encodeURIComponent(String(idVariable))
  const v4 = await bcraFetch<any>(
    `/estadisticas/v4.0/Monetarias/${id}${qs({
      Desde: opts?.desde,
      Hasta: opts?.hasta,
      Limit: opts?.limit ?? 1000,
      Offset: opts?.offset,
    })}`,
  )
  if (v4.ok) {
    const series = flattenSerieMonetaria(v4.data, Number(idVariable) || 0)
    if (series.length) return series
  }
  const v3 = await bcraFetch<any>(`/estadisticas/v3.0/monetarias/${id}`)
  if (!v3.ok) return []
  return flattenSerieMonetaria(v3.data, Number(idVariable) || 0)
}

export async function getMetodologiaMonetaria(): Promise<MetodologiaVariable[]> {
  const data = await bcraFetch<any>(`/estadisticas/v4.0/Metodologia${qs({ Limit: 500 })}`)
  if (!data.ok) return []
  const results = asArray(data.data?.results).flat()
  return results
    .map((m: any) => ({
      id: Number(m?.id ?? m?.idVariable ?? 0),
      detalle: String(m?.detalle ?? m?.descripcion ?? ''),
    }))
    .filter((m: MetodologiaVariable) => m.id || m.detalle)
}

export async function getMetodologiaVariable(idVariable: number | string): Promise<MetodologiaVariable[]> {
  const id = encodeURIComponent(String(idVariable))
  const data = await bcraFetch<any>(`/estadisticas/v4.0/Metodologia/${id}`)
  if (!data.ok) return []
  return asArray(data.data?.results).map((m: any) => ({
    id: Number(m?.id ?? idVariable),
    detalle: String(m?.detalle ?? m?.descripcion ?? ''),
  }))
}

/* -------------------------- Estadísticas cambiarias v1.0 -------------------------- */
// Docs: https://estadisticas-cambiarias.bcra.apidocs.ar/

export type DivisaBCRA = {
  codigo: string
  denominacion: string
}

export type CotizacionBCRA = {
  moneda: string
  descripcion?: string | null
  tipo: string | null
  tipoPase: number | null
  tipoCotizacion: number | null
  fecha: string | null
}

export async function getDivisas(): Promise<DivisaBCRA[]> {
  const data = await bcraFetch<any>(`/estadisticascambiarias/v1.0/Maestros/Divisas`)
  if (!data.ok) return []
  return asArray(data.data?.results).map((d: any) => ({
    codigo: String(d?.codigo ?? d?.codigoMoneda ?? '').toUpperCase(),
    denominacion: String(d?.denominacion ?? d?.descripcion ?? ''),
  })).filter((d: DivisaBCRA) => d.codigo)
}

function mapCotizacionDetalle(d: any, fecha: string | null): CotizacionBCRA {
  return {
    moneda: String(d.codigoMoneda ?? d.moneda ?? d.descripcion ?? 'N/A'),
    descripcion: d.descripcion != null ? String(d.descripcion) : null,
    tipo: d.tipoPase != null ? String(d.tipoPase) : d.tipo ?? null,
    tipoPase: d.tipoPase != null ? Number(d.tipoPase) : null,
    tipoCotizacion: d.tipoCotizacion != null ? Number(d.tipoCotizacion) : d.valor != null ? Number(d.valor) : null,
    fecha,
  }
}

export async function getCotizaciones(fecha?: string): Promise<CotizacionBCRA[]> {
  const data = await bcraFetch<any>(
    `/estadisticascambiarias/v1.0/Cotizaciones${qs({ fecha })}`,
  )
  if (!data.ok) return []
  const results = data.data?.results ?? data.data
  const fechaRes = results?.fecha ?? fecha ?? null
  const detalle = results?.detalle ?? data.data?.detalle ?? (Array.isArray(results) ? results : [])
  if (!Array.isArray(detalle)) return []
  return detalle.map((d: any) => mapCotizacionDetalle(d, fechaRes))
}

export async function getCotizacionesMoneda(
  codMoneda: string,
  opts?: { fechaDesde?: string; fechaHasta?: string; limit?: number; offset?: number },
): Promise<CotizacionBCRA[]> {
  const moneda = encodeURIComponent(codMoneda.trim().toUpperCase())
  const data = await bcraFetch<any>(
    `/estadisticascambiarias/v1.0/Cotizaciones/${moneda}${qs({
      fechaDesde: opts?.fechaDesde,
      fechaHasta: opts?.fechaHasta,
      limit: opts?.limit ?? 30,
      offset: opts?.offset,
    })}`,
  )
  if (!data.ok) return []
  const rows = asArray(data.data?.results)
  const out: CotizacionBCRA[] = []
  for (const row of rows) {
    const fecha = row?.fecha ?? null
    for (const d of asArray(row?.detalle)) {
      out.push(mapCotizacionDetalle(d, fecha))
    }
    if (!asArray(row?.detalle).length && (row?.codigoMoneda || row?.tipoCotizacion != null)) {
      out.push(mapCotizacionDetalle(row, fecha))
    }
  }
  return out
}

/* -------------------------- Régimen de Transparencia v1.0 -------------------------- */
// Docs: https://regimen-transparencia.bcra.apidocs.ar/

export const TRANSPARENCIA_PRODUCTOS = [
  { id: 'cajas-ahorro', label: 'Cajas de ahorro', path: '/transparencia/v1.0/CajasAhorros' },
  { id: 'paquetes', label: 'Paquetes de productos', path: '/transparencia/v1.0/PaquetesProductos' },
  { id: 'plazos-fijos', label: 'Plazos fijos', path: '/transparencia/v1.0/PlazosFijos' },
  { id: 'prendarios', label: 'Préstamos prendarios', path: '/transparencia/v1.0/Prestamos/Prendarios' },
  { id: 'hipotecarios', label: 'Préstamos hipotecarios', path: '/transparencia/v1.0/Prestamos/Hipotecarios' },
  { id: 'personales', label: 'Préstamos personales', path: '/transparencia/v1.0/Prestamos/Personales' },
  { id: 'tarjetas', label: 'Tarjetas de crédito', path: '/transparencia/v1.0/TarjetasCredito' },
] as const

export type TransparenciaProductoId = (typeof TRANSPARENCIA_PRODUCTOS)[number]['id']

export type TransparenciaResultado = {
  producto: TransparenciaProductoId
  label: string
  found: boolean
  unavailable: boolean
  count: number
  results: Record<string, unknown>[]
}

export async function getTransparencia(
  producto: TransparenciaProductoId,
  codigoEntidad?: number | string,
): Promise<TransparenciaResultado> {
  const spec = TRANSPARENCIA_PRODUCTOS.find((p) => p.id === producto)
  if (!spec) {
    return { producto, label: producto, found: false, unavailable: true, count: 0, results: [] }
  }
  const data = await bcraFetch<any>(
    `${spec.path}${qs({ codigoEntidad: codigoEntidad ? String(codigoEntidad).replace(/\D/g, '') : undefined })}`,
  )
  if (!data.ok) {
    return {
      producto,
      label: spec.label,
      found: false,
      unavailable: data.status !== 404,
      count: 0,
      results: [],
    }
  }
  const results = asArray<Record<string, unknown>>(data.data?.results ?? data.data)
  return {
    producto,
    label: spec.label,
    found: results.length > 0,
    unavailable: false,
    count: results.length,
    results,
  }
}

export { formatPeriodoBcra, SITUACION_BCRA } from '@/lib/bcra-labels'

export type FullBcraSnapshot = {
  cuil: string
  consultedAt: string
  deudas: DeudaResumen
  historicas: DeudaResumen
  chequesRechazados: ChequesRechazadosResumen
  unavailable: boolean
}

export function snapshotFromStored(full: unknown, fallbackCuil?: string): FullBcraSnapshot | null {
  if (!full || typeof full !== 'object') return null
  const root = full as Record<string, any>
  const inner =
    root.deudas || root.historicas || root.chequesRechazados
      ? root
      : root.rawResult ?? root.rawResponse ?? root.full ?? null
  if (!inner || typeof inner !== 'object') return null
  if (!inner.deudas && !inner.historicas && !inner.chequesRechazados) return null
  return {
    cuil: String(inner.cuil ?? root.cuil ?? fallbackCuil ?? ''),
    consultedAt: String(inner.consultedAt ?? root.consultedAt ?? ''),
    deudas: inner.deudas ?? EMPTY_DEUDA,
    historicas: inner.historicas ?? EMPTY_DEUDA,
    chequesRechazados: inner.chequesRechazados ?? {
      found: false,
      unavailable: false,
      count: 0,
      cheques: [],
      denominacion: null,
    },
    unavailable: Boolean(inner.unavailable),
  }
}

export async function consultFullBcra(cuit: string): Promise<FullBcraSnapshot> {
  const cuil = normalizeCuit(cuit)
  if (_deudasOverride) {
    return {
      cuil,
      consultedAt: new Date().toISOString(),
      deudas: _deudasOverride,
      historicas: _deudasOverride,
      chequesRechazados: { found: false, unavailable: false, count: 0, cheques: [], denominacion: null },
      unavailable: Boolean(_deudasOverride.unavailable),
    }
  }
  const [deudas, historicas, chequesRechazados] = await Promise.all([
    getDeudas(cuil),
    getDeudasHistoricas(cuil),
    getChequesRechazados(cuil),
  ])
  const unavailable = Boolean(deudas.unavailable && historicas.unavailable && chequesRechazados.unavailable)
  return {
    cuil,
    consultedAt: new Date().toISOString(),
    deudas,
    historicas,
    chequesRechazados,
    unavailable,
  }
}

/* ------------------------------- Scoring ---------------------------------- */

export type ScoreResult = {
  score: number
  situacion: number | null
  totalDebt: number
  entitiesCount: number
  hasRejectedChecks: boolean
  band: 'excelente' | 'bueno' | 'regular' | 'bajo'
  reasons: string[]
}

export function computeScore(params: {
  deuda: DeudaResumen
  monthlyIncome: number
  hasRejectedChecks?: boolean
  historica?: DeudaResumen | null
}): ScoreResult {
  const { deuda, monthlyIncome } = params
  const hasRejectedChecks = Boolean(params.hasRejectedChecks)
  let score = 700
  const reasons: string[] = []

  if (deuda.unavailable) {
    score = 600
    reasons.push('No se pudo consultar la Central de Deudores del BCRA en este momento.')
  } else if (!deuda.found) {
    score = 640
    reasons.push('Sin historial vigente en la Central de Deudores del BCRA.')
  } else {
    switch (deuda.worstSituation) {
      case 1:
        score += 120
        reasons.push('Situación 1 (normal) en el BCRA.')
        break
      case 2:
        score += 20
        reasons.push('Situación 2 (riesgo bajo) en el BCRA.')
        break
      case 3:
        score -= 120
        reasons.push('Situación 3 (riesgo medio) en el BCRA.')
        break
      case 4:
        score -= 220
        reasons.push('Situación 4 (riesgo alto) en el BCRA.')
        break
      case 5:
        score -= 320
        reasons.push('Situación 5 (irrecuperable) en el BCRA.')
        break
      default:
        break
    }
    if (deuda.entitiesCount > 5) {
      score -= 40
      reasons.push(`Alta exposición: ${deuda.entitiesCount} entidades.`)
    }
  }

  if (hasRejectedChecks) {
    score -= 90
    reasons.push('Cheques rechazados informados en Central de Deudores.')
  }

  if (params.historica?.found && params.historica.worstSituation && params.historica.worstSituation >= 3) {
    score -= 30
    reasons.push(`Historial BCRA con situación ${params.historica.worstSituation} en períodos anteriores.`)
  }

  if (monthlyIncome > 0 && deuda.totalDebt > 0) {
    const ratio = deuda.totalDebt / (monthlyIncome * 12)
    if (ratio > 1) {
      score -= 80
      reasons.push('Endeudamiento superior a los ingresos anuales.')
    } else if (ratio < 0.2) {
      score += 30
      reasons.push('Bajo nivel de endeudamiento respecto de sus ingresos.')
    }
  }

  if (monthlyIncome >= 800000) {
    score += 40
    reasons.push('Ingresos declarados altos.')
  }

  score = Math.max(300, Math.min(850, Math.round(score)))

  const band: ScoreResult['band'] =
    score >= 720 ? 'excelente' : score >= 640 ? 'bueno' : score >= 560 ? 'regular' : 'bajo'

  return {
    score,
    situacion: deuda.worstSituation,
    totalDebt: deuda.totalDebt,
    entitiesCount: deuda.entitiesCount,
    hasRejectedChecks,
    band,
    reasons,
  }
}
