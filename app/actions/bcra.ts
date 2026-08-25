'use server'

import {
  computeScore,
  consultFullBcra,
  getChequeDenunciado,
  getChequesEntidades,
  getCotizaciones,
  getCotizacionesMoneda,
  getDivisas,
  getInformeMonetarioDiario,
  getMetodologiaMonetaria,
  getMetodologiaVariable,
  getMonetarias,
  getPrincipalesVariables,
  getTransparencia,
  getVariableMonetaria,
  isValidCuit,
  normalizeCuit,
  TRANSPARENCIA_PRODUCTOS,
  type FullBcraSnapshot,
  type ScoreResult,
  type TransparenciaProductoId,
} from '@/lib/bcra'
import { persistBcraConsultation } from '@/lib/bcra-persist'
import { getPublicMarketBoardCached, persistLiveFxNow } from '@/lib/bcra-market'
import { db } from '@/lib/db'
import { bcraVariable, profile } from '@/lib/db/schema'
import { assertRole, newId, requireAdmin } from '@/lib/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function consultMyBcra() {
  const userId = await assertRole('customer')
  const [prof] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
  if (!prof?.cuil) {
    return { ok: false as const, error: 'Completá tu CUIL en Mis datos antes de consultar el BCRA.' }
  }
  const result = await persistBcraConsultation({
    userId,
    cuil: prof.cuil,
    monthlyIncome: Number(prof.monthlyIncome ?? 0),
  })
  if (result.ok) {
    revalidatePath('/dashboard')
    revalidatePath('/dashboard?tab=scoring')
  }
  return result
}

export async function consultBcraByCuil(cuilInput: string) {
  await requireAdmin()
  const cuil = normalizeCuit(cuilInput)
  if (!isValidCuit(cuil)) {
    return { ok: false as const, error: 'CUIT/CUIL inválido.' }
  }

  const [owner] = await db.select().from(profile).where(eq(profile.cuil, cuil)).limit(1)

  let snapshot: FullBcraSnapshot
  let score: ScoreResult
  let persisted: { checkId: string; userId: string } | null = null

  if (owner) {
    const saved = await persistBcraConsultation({
      userId: owner.userId,
      cuil,
      monthlyIncome: Number(owner.monthlyIncome ?? 0),
    })
    if (!saved.ok) return saved
    snapshot = saved.snapshot
    score = saved.score
    persisted = { checkId: saved.checkId, userId: owner.userId }
    revalidatePath('/admin')
    revalidatePath('/dashboard')
  } else {
    snapshot = await consultFullBcra(cuil)
    if (snapshot.unavailable) {
      return { ok: false as const, error: 'La API del BCRA no respondió. Reintentá en unos minutos.' }
    }
    const hasRejectedChecks = snapshot.chequesRechazados.count > 0
    score = computeScore({
      deuda: snapshot.deudas,
      monthlyIncome: 0,
      hasRejectedChecks,
      historica: snapshot.historicas,
    })
  }

  return {
    ok: true as const,
    cuil,
    persisted,
    score,
    snapshot: {
      denominacion: snapshot.deudas.denominacion ?? snapshot.historicas.denominacion,
      periodo: snapshot.deudas.periodo,
      found: snapshot.deudas.found,
      worstSituation: snapshot.deudas.worstSituation,
      totalDebt: snapshot.deudas.totalDebt,
      entitiesCount: snapshot.deudas.entitiesCount,
      entidades: snapshot.deudas.entidades,
      periodos: snapshot.deudas.periodos,
      historicaWorst: snapshot.historicas.worstSituation,
      historicaDebt: snapshot.historicas.totalDebt,
      historicaPeriodos: snapshot.historicas.periodos,
      chequesRechazados: snapshot.chequesRechazados.count,
      cheques: snapshot.chequesRechazados.cheques,
      consultedAt: snapshot.consultedAt,
      full: snapshot,
    },
  }
}

export async function syncBcraVariablesFromApi() {
  await requireAdmin()
  const live = await getPrincipalesVariables()
  if (!live.length) {
    return { ok: false as const, error: 'El BCRA no devolvió variables monetarias.', synced: 0 }
  }
  const now = new Date()
  let synced = 0
  for (const v of live) {
    const idVariable = String(v.idVariable)
    const [existing] = await db
      .select()
      .from(bcraVariable)
      .where(eq(bcraVariable.idVariable, idVariable))
      .limit(1)
    if (existing?.manualOverride) continue
    const effectiveDate = v.fecha ? new Date(v.fecha) : now
    if (existing) {
      await db
        .update(bcraVariable)
        .set({
          variableName: v.descripcion,
          value: String(v.valor),
          effectiveDate: Number.isNaN(effectiveDate.getTime()) ? now : effectiveDate,
          source: 'bcra_api',
          rawPayload: v as unknown as Record<string, unknown>,
          updatedAt: now,
        })
        .where(eq(bcraVariable.idVariable, idVariable))
    } else {
      await db.insert(bcraVariable).values({
        id: newId('bvar'),
        idVariable,
        variableName: v.descripcion,
        value: String(v.valor),
        effectiveDate: Number.isNaN(effectiveDate.getTime()) ? now : effectiveDate,
        manualOverride: false,
        source: 'bcra_api',
        rawPayload: v as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })
    }
    synced += 1
  }
  const fxCount = await persistLiveFxNow().catch(() => 0)
  revalidatePath('/admin')
  return { ok: true as const, synced, total: live.length, fx: fxCount }
}

export async function getPublicMarketBoard() {
  await requireAdmin()
  return getPublicMarketBoardCached()
}

export async function getBcraMarketSnapshot() {
  await requireAdmin()
  const [variables, fx, informeDiario] = await Promise.all([
    getPrincipalesVariables(),
    getCotizaciones(),
    getInformeMonetarioDiario(),
  ])
  return {
    variables: variables.slice(0, 80),
    fx: fx.slice(0, 24),
    informeDiario: informeDiario.slice(0, 40),
  }
}

export async function consultChequeDenunciado(codigoEntidad: string, numeroCheque: string) {
  await requireAdmin()
  const banco = String(codigoEntidad ?? '').replace(/\D/g, '')
  const nro = String(numeroCheque ?? '').replace(/\D/g, '')
  if (!banco || !nro) {
    return { ok: false as const, error: 'Ingresá código de entidad y número de cheque.' }
  }
  const result = await getChequeDenunciado(banco, nro)
  if (!result.found && result.unavailable) {
    return { ok: false as const, error: 'La API de cheques del BCRA no respondió.' }
  }
  return { ok: true as const, result }
}

export async function listChequesEntidades() {
  await requireAdmin()
  const entidades = await getChequesEntidades()
  if (!entidades.length) {
    return { ok: false as const, error: 'No se pudo listar entidades de cheques.', entidades: [] }
  }
  return { ok: true as const, entidades }
}

export async function listBcraDivisas() {
  await requireAdmin()
  const divisas = await getDivisas()
  return { ok: true as const, divisas }
}

export async function listBcraCotizaciones(fecha?: string) {
  await requireAdmin()
  const fx = await getCotizaciones(fecha || undefined)
  if (!fx.length) {
    return { ok: false as const, error: 'El BCRA no devolvió cotizaciones.', fx: [] }
  }
  return { ok: true as const, fx }
}

export async function listBcraCotizacionesMoneda(codMoneda: string, fechaDesde?: string, fechaHasta?: string) {
  await requireAdmin()
  const moneda = String(codMoneda ?? '').trim().toUpperCase()
  if (!moneda) return { ok: false as const, error: 'Indicá el código de moneda (ej. USD).', serie: [] }
  const serie = await getCotizacionesMoneda(moneda, { fechaDesde, fechaHasta, limit: 60 })
  return { ok: true as const, serie }
}

export async function listInformeMonetarioDiario() {
  await requireAdmin()
  const variables = await getInformeMonetarioDiario()
  if (!variables.length) {
    return { ok: false as const, error: 'El BCRA no devolvió el Informe Monetario Diario.', variables: [] }
  }
  return { ok: true as const, variables }
}

export async function listMonetariasCategoria(categoria?: string) {
  await requireAdmin()
  const variables = await getMonetarias({ categoria: categoria || undefined, limit: 200 })
  return { ok: true as const, variables }
}

export async function listVariableMonetariaSerie(idVariable: string) {
  await requireAdmin()
  const id = String(idVariable ?? '').trim()
  if (!id) return { ok: false as const, error: 'Indicá el ID de variable.', serie: [] }
  const serie = await getVariableMonetaria(id, { limit: 90 })
  return { ok: true as const, serie }
}

export async function listMetodologiaMonetaria(idVariable?: string) {
  await requireAdmin()
  const items = idVariable?.trim()
    ? await getMetodologiaVariable(idVariable.trim())
    : await getMetodologiaMonetaria()
  return { ok: true as const, items }
}

export async function listTransparencia(producto: TransparenciaProductoId, codigoEntidad?: string) {
  await requireAdmin()
  const valid = TRANSPARENCIA_PRODUCTOS.some((p) => p.id === producto)
  if (!valid) {
    return { ok: false as const, error: 'Producto de transparencia inválido.' }
  }
  const result = await getTransparencia(producto, codigoEntidad)
  if (result.unavailable) {
    return { ok: false as const, error: `La API de Transparencia (${result.label}) no respondió.`, result }
  }
  return { ok: true as const, result }
}
