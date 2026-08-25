import { persistBcraConsultation } from '@/lib/bcra-persist'
import { receiptBranding } from '@/lib/brand'
import { db } from '@/lib/db'
import { bcraCheck, bcraReport, profile } from '@/lib/db/schema'
import { revalidateCustomer } from '@/lib/revalidate'
import { and, desc, eq } from 'drizzle-orm'

type RuntimeBCRACheck = {
  id: string
  userId: string
  cuil: string | null
  worstSituation: number | null
  totalDebt: string | null
  entitiesCount: number | null
  hasRejectedChecks: boolean
  computedScore: number | null
  consultedAt: Date | null
  source: string | null
  [k: string]: unknown
}

async function lastCheckForUser(userId: string): Promise<RuntimeBCRACheck | null> {
  try {
    const rows = await db
      .select()
      .from(bcraCheck)
      .where(eq(bcraCheck.userId, userId))
      .orderBy(desc(bcraCheck.createdAt))
      .limit(1)
    return (rows[0] as RuntimeBCRACheck | undefined) ?? null
  } catch (e) {
    console.warn('[bcra-report] last check:', (e as Error).message)
    return null
  }
}

/** Persistencia interna. No exportar desde un archivo `use server`. */
export async function persistBcraReportForUser(userId: string, checkId?: string | null) {
  let check: RuntimeBCRACheck | null = null

  if (checkId && String(checkId).trim().length > 0) {
    try {
      const [existing] = await db
        .select()
        .from(bcraCheck)
        .where(and(eq(bcraCheck.id, checkId), eq(bcraCheck.userId, userId)))
        .limit(1)
      check = (existing as RuntimeBCRACheck) || null
    } catch {
      check = null
    }
  }
  if (!check) check = await lastCheckForUser(userId)
  if (!check) {
    const [p] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1)
    if (p?.cuil) {
      const live = await persistBcraConsultation({
        userId,
        cuil: p.cuil,
        monthlyIncome: Number(p.monthlyIncome ?? 0),
      })
      if (live.ok) check = await lastCheckForUser(userId)
    }
  }
  if (!check) {
    throw new Error('No hay un informe BCRA real. Consultá tu situación desde Scoring e intentá de nuevo.')
  }

  const id = crypto.randomUUID()
  const reportNumber = `INF-BCRA-${Date.now().toString().slice(-8)}`
  const raw = (check as { rawResult?: unknown; rawResponse?: unknown }).rawResult
    ?? (check as { rawResponse?: unknown }).rawResponse
    ?? {}
  const payload = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const fullReportData = JSON.parse(
    JSON.stringify({
      ...check,
      cuil: check.cuil,
      consultedAt: check.consultedAt,
      deudas: payload.deudas,
      historicas: payload.historicas,
      chequesRechazados: payload.chequesRechazados,
      score: payload.score,
      denominacion: payload.denominacion,
      unavailable: false,
    }),
  )

  try {
    const inserted = await db
      .insert(bcraReport)
      .values({
        id,
        userId,
        bcraCheckId: check.id,
        reportNumber,
        scoreAtGeneration: check.computedScore ?? null,
        worstSituation: check.worstSituation ?? null,
        totalDebt: check.totalDebt ?? null,
        entitiesCount: check.entitiesCount ?? null,
        hasRejectedChecks: check.hasRejectedChecks ?? false,
        currency: 'ARS',
        fullReportData,
        branding: JSON.parse(
          JSON.stringify({
            ...receiptBranding(),
            reportType: 'Informe de Situación Crediticia BCRA',
          }),
        ),
        createdAt: new Date(),
      })
      .returning()
    const report = inserted[0] ?? { id, reportNumber }
    revalidateCustomer()
    return {
      ok: true as const,
      reportId: report.id as string,
      reportNumber: report.reportNumber as string,
      fromCheckId: check.id,
    }
  } catch (e) {
    console.error('[bcra-report] insert failed:', (e as Error).message)
    throw new Error('No se pudo guardar el informe BCRA. Reintentá en unos minutos.')
  }
}
