// Cliente para las APIs públicas del Banco Central de la República Argentina (BCRA).
// Documentación: https://www.bcra.gob.ar/apis-banco-central/
//
// Estas APIs son públicas y no requieren credenciales. El BCRA usa un certificado
// que a veces no es reconocido por Node; por eso las llamadas toleran fallos y
// devuelven `null` en lugar de romper el flujo de negocio.

const BCRA_BASE = 'https://api.bcra.gob.ar'

const COMMON_HEADERS = {
  // El BCRA valida el Accept-Language en algunas rutas.
  'Accept-Language': 'es-AR',
  Accept: 'application/json',
  'User-Agent': 'UniCred/1.0 (+https://unipagos.com.ar)',
}

async function bcraFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BCRA_BASE}${path}`, {
      headers: COMMON_HEADERS,
      // Cache corto: los datos del BCRA se actualizan a diario.
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      console.log(`[v0] BCRA ${path} respondió ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.log(`[v0] BCRA fetch error en ${path}:`, (err as Error).message)
    return null
  }
}

/* --------------------------- Central de Deudores --------------------------- */

export type BcraDeuda = {
  identificacion: number
  denominacion: string
  periodos: {
    periodo: string
    entidades: {
      entidad: string
      situacion: number
      monto: number
      diasAtrasoPago?: number
    }[]
  }[]
}

export type DeudaResumen = {
  found: boolean
  denominacion: string | null
  worstSituation: number | null // 1 (normal) a 5 (irrecuperable)
  totalDebt: number
  entitiesCount: number
  entidades: { entidad: string; situacion: number; monto: number }[]
}

/** Consulta la situación crediticia de un CUIT/CUIL en la Central de Deudores. */
export async function getDeudas(cuit: string): Promise<DeudaResumen> {
  const clean = cuit.replace(/\D/g, '')
  const data = await bcraFetch<{ results: BcraDeuda }>(
    `/CentralDeDeudores/v1.0/Deudas/${clean}`,
  )

  const empty: DeudaResumen = {
    found: false,
    denominacion: null,
    worstSituation: null,
    totalDebt: 0,
    entitiesCount: 0,
    entidades: [],
  }

  if (!data?.results?.periodos?.length) return empty

  // Tomamos el período más reciente (el primero que devuelve la API).
  const periodo = data.results.periodos[0]
  const entidades = periodo.entidades ?? []
  if (!entidades.length) return { ...empty, found: true, denominacion: data.results.denominacion }

  const worstSituation = Math.max(...entidades.map((e) => e.situacion))
  const totalDebt = entidades.reduce((acc, e) => acc + (e.monto ?? 0), 0)

  return {
    found: true,
    denominacion: data.results.denominacion ?? null,
    worstSituation,
    totalDebt: totalDebt * 1000, // el BCRA reporta montos en miles de pesos
    entitiesCount: entidades.length,
    entidades: entidades.map((e) => ({
      entidad: e.entidad,
      situacion: e.situacion,
      monto: (e.monto ?? 0) * 1000,
    })),
  }
}

/* --------------------------- Cheques Denunciados --------------------------- */

export type ChequeDenunciado = {
  found: boolean
  denunciado: boolean
}

export async function getChequeDenunciado(
  codigoEntidad: number,
  numeroCheque: number,
): Promise<ChequeDenunciado> {
  const data = await bcraFetch<{ results: { denunciado: boolean } }>(
    `/cheques/v1.0/denunciados/${codigoEntidad}/${numeroCheque}`,
  )
  if (!data?.results) return { found: false, denunciado: false }
  return { found: true, denunciado: Boolean(data.results.denunciado) }
}

/* -------------------------- Principales Variables -------------------------- */

export type VariableBCRA = {
  idVariable: number
  descripcion: string
  fecha: string
  valor: number
}

/** Trae las principales variables monetarias (tasa, inflación, dólar, etc.). */
export async function getPrincipalesVariables(): Promise<VariableBCRA[]> {
  const data = await bcraFetch<{ results: VariableBCRA[] }>(
    `/estadisticas/v3.0/monetarias`,
  )
  return data?.results ?? []
}

/* ------------------------------- Scoring ---------------------------------- */

export type ScoreResult = {
  score: number // 300 - 850
  situacion: number | null
  totalDebt: number
  entitiesCount: number
  band: 'excelente' | 'bueno' | 'regular' | 'bajo'
  reasons: string[]
}

/**
 * Calcula un score crediticio (300-850) a partir de la situación en el BCRA
 * y los ingresos declarados. Modelo simple y explicable.
 */
export function computeScore(params: {
  deuda: DeudaResumen
  monthlyIncome: number
}): ScoreResult {
  const { deuda, monthlyIncome } = params
  let score = 700
  const reasons: string[] = []

  if (!deuda.found) {
    score = 640
    reasons.push('Sin historial en la Central de Deudores del BCRA.')
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

  // Relación deuda / ingreso anual estimado.
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
    band,
    reasons,
  }
}
