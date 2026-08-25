import { unstable_cache } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bcraVariable } from '@/lib/db/schema'
import { newId } from '@/lib/session'
import {
  getCotizaciones,
  getPrincipalesVariables,
  type CotizacionBCRA,
  type VariableBCRA,
} from '@/lib/bcra'

export type MarketFxRow = {
  moneda: string
  descripcion: string
  valor: number
  fecha: string | null
}

export type MarketIndicator = {
  id: string
  nombre: string
  valor: number
  fecha: string | null
  unidad?: string | null
}

export type PublicMarketBoard = {
  updatedAt: string
  source: 'bcra_api' | 'db_cache' | 'empty'
  fx: MarketFxRow[]
  indicators: MarketIndicator[]
  ticker: string
}

const PRIORITY_FX = ['USD', 'REF', 'EUR', 'BRL', 'GBP', 'CNY', 'UYU', 'CLP', 'JPY']

function fxKey(code: string) {
  return `FX:${code.toUpperCase()}`
}

function normalizeFx(rows: CotizacionBCRA[]): MarketFxRow[] {
  const mapped = rows
    .map((r) => {
      const moneda = String(r.moneda ?? '').toUpperCase().trim()
      const valor = r.tipoCotizacion
      if (!moneda || moneda === 'ARS' || valor == null || Number.isNaN(Number(valor)) || Number(valor) <= 0) return null
      return {
        moneda,
        descripcion: r.descripcion || moneda,
        valor: Number(valor),
        fecha: r.fecha,
      }
    })
    .filter((r): r is MarketFxRow => Boolean(r))

  mapped.sort((a, b) => {
    const ai = PRIORITY_FX.indexOf(a.moneda)
    const bi = PRIORITY_FX.indexOf(b.moneda)
    if (ai === -1 && bi === -1) return a.moneda.localeCompare(b.moneda)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return mapped
}

function pickIndicators(vars: VariableBCRA[]): MarketIndicator[] {
  const interesting = vars.filter((v) => {
    const t = `${v.descripcion} ${v.categoria ?? ''}`.toLowerCase()
    return (
      t.includes('tipo de cambio') ||
      t.includes('tipo de cambio minorista') ||
      t.includes('mayorista') ||
      t.includes('inflaci') ||
      t.includes('polít') ||
      t.includes('politica monetaria') ||
      t.includes('tasa de política') ||
      t.includes('badlar') ||
      t.includes('reservas')
    )
  })
  const chosen = (interesting.length ? interesting : vars).slice(0, 8)
  return chosen.map((v) => ({
    id: String(v.idVariable),
    nombre: v.descripcion,
    valor: Number(v.valor),
    fecha: v.fecha || null,
    unidad: v.unidadExpresion || v.moneda || null,
  }))
}

function buildTicker(fx: MarketFxRow[]): string {
  const top = fx.filter((r) => PRIORITY_FX.includes(r.moneda)).slice(0, 3)
  if (!top.length) return 'Cotizaciones BCRA'
  return top
    .map((r) => `${r.moneda} ${r.valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(' · ')
}

async function persistFx(rows: MarketFxRow[]) {
  const now = new Date()
  for (const row of rows) {
    const idVariable = fxKey(row.moneda)
    const effectiveDate = row.fecha ? new Date(row.fecha) : now
    const [existing] = await db
      .select({ id: bcraVariable.id, manualOverride: bcraVariable.manualOverride })
      .from(bcraVariable)
      .where(eq(bcraVariable.idVariable, idVariable))
      .limit(1)
    if (existing?.manualOverride) continue
    const payload = {
      variableName: `Tipo de cambio ${row.descripcion}`,
      value: String(row.valor),
      effectiveDate: Number.isNaN(effectiveDate.getTime()) ? now : effectiveDate,
      source: 'bcra_api',
      rawPayload: row as unknown as Record<string, unknown>,
      updatedAt: now,
    }
    if (existing) {
      await db.update(bcraVariable).set(payload).where(eq(bcraVariable.idVariable, idVariable))
    } else {
      await db.insert(bcraVariable).values({
        id: newId('bfx'),
        idVariable,
        ...payload,
        manualOverride: false,
        createdAt: now,
      })
    }
  }
}

async function readFxFromDb(): Promise<MarketFxRow[]> {
  try {
    const rows = await db.select().from(bcraVariable)
    return rows
      .filter((r) => r.idVariable.startsWith('FX:'))
      .map((r) => ({
        moneda: r.idVariable.replace(/^FX:/, ''),
        descripcion: r.variableName.replace(/^Tipo de cambio\s+/i, ''),
        valor: Number(r.value),
        fecha: r.effectiveDate ? r.effectiveDate.toISOString().slice(0, 10) : null,
      }))
      .filter((r) => Number.isFinite(r.valor))
  } catch (err) {
    console.warn('[bcra-market] db FX:', (err as Error).message)
    return []
  }
}

async function readIndicatorsFromDb(): Promise<MarketIndicator[]> {
  try {
    const rows = await db.select().from(bcraVariable)
    return rows
      .filter((r) => !r.idVariable.startsWith('FX:'))
      .slice(0, 8)
      .map((r) => ({
        id: r.idVariable,
        nombre: r.variableName,
        valor: Number(r.value),
        fecha: r.effectiveDate ? r.effectiveDate.toISOString().slice(0, 10) : null,
      }))
  } catch (err) {
    console.warn('[bcra-market] db indicadores:', (err as Error).message)
    return []
  }
}

async function loadMarketBoardUncached(): Promise<PublicMarketBoard> {
  const [fxLive, varsLive] = await Promise.all([
    getCotizaciones().catch(() => [] as CotizacionBCRA[]),
    getPrincipalesVariables().catch(() => [] as VariableBCRA[]),
  ])

  let fx = normalizeFx(fxLive)
  let indicators = pickIndicators(varsLive)
  let source: PublicMarketBoard['source'] = fx.length || indicators.length ? 'bcra_api' : 'empty'

  if (fx.length) {
    persistFx(fx).catch((err) => console.warn('[bcra-market] persist FX:', (err as Error).message))
  }

  if (!fx.length) {
    fx = normalizeFx(
      (await readFxFromDb()).map((r) => ({
        moneda: r.moneda,
        descripcion: r.descripcion,
        tipo: null,
        tipoPase: null,
        tipoCotizacion: r.valor,
        fecha: r.fecha,
      })),
    )
    if (fx.length) source = 'db_cache'
  }
  if (!indicators.length) {
    indicators = await readIndicatorsFromDb()
    if (indicators.length && source === 'empty') source = 'db_cache'
  }

  return {
    updatedAt: new Date().toISOString(),
    source,
    fx,
    indicators,
    ticker: buildTicker(fx),
  }
}

export const getPublicMarketBoardCached = unstable_cache(
  loadMarketBoardUncached,
  ['unicred-public-market-board-v2'],
  { revalidate: 60 * 15, tags: ['bcra-market'] },
)

export async function persistLiveFxNow() {
  const fx = normalizeFx(await getCotizaciones())
  if (fx.length) await persistFx(fx)
  return fx.length
}
