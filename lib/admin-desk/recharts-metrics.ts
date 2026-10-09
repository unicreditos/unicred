import type { Credit, LoanApplication, Disbursement, Merchant, CollectionCase, Payment } from './types'

export interface MonthlyPlacementPoint {
  key: string // '2025-11'
  label: string // 'Nov 2025'
  shortLabel: string // 'Nov'
  volumePlaced: number // Monto total en ARS
  volumePlacedMillions: number // Monto en millones de ARS
  loansCount: number // Cantidad de préstamos colocados
  avgTicket: number // Monto promedio por préstamo
  disbursedAmount: number // Monto efectivamente liquidado
  repaidAmount: number // Capital ya amortizado/cobrado
  outstandingAmount: number // Saldo vivo restante
  growthRatePct: number // Variación porcentual MoM vs mes anterior
}

export interface DelinquencyBucketMetric {
  key: string
  label: string
  shortLabel: string
  count: number
  amount: number
  amountMillions: number
  shareOfPortfolioPct: number
  color: string
}

export interface RealtimeDelinquencyData {
  totalActiveCredits: number
  totalActivePortfolio: number // Saldo vivo total
  totalDelinquentPortfolio: number // Saldo vivo en mora (>0 días)
  overallDelinquencyRate: number // Tasa de morosidad global (%)
  severeDelinquencyRate: number // Tasa mora >30 días (%)
  criticalDelinquencyRate: number // Tasa mora >60 días (%)
  statusTone: 'healthy' | 'caution' | 'warning' | 'critical'
  statusLabel: string
  buckets: DelinquencyBucketMetric[]
  historicalTrend: Array<{
    monthKey: string
    monthLabel: string
    totalPortfolio: number
    latePortfolio: number
    moraRatePct: number
    mora30RatePct: number
  }>
}

export interface MerchantCategoryMetric {
  category: string
  categorySlug: string
  merchantsCount: number
  activeLoansCount: number
  totalPlacedVolume: number
  activePortfolioVolume: number
  shareOfTotalPortfolioPct: number
  delinquentVolume: number
  delinquencyRatePct: number
  avgTicket: number
  color: string
}

export interface ExecutiveKpiSummary {
  totalPlacedAllTime: number
  currentActivePortfolio: number
  totalActiveLoans: number
  currentMoraRatePct: number
  topCategoryName: string
  topCategorySharePct: number
  bestMonthLabel: string
  bestMonthVolume: number
  avgMonthlyGrowthPct: number
}

const MONTH_NAMES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CATEGORY_PALETTE = [
  '#0284c7', // Sky / Cyan
  '#2563eb', // Blue
  '#7c3aed', // Violet
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#ca8a04', // Yellow
  '#64748b', // Slate
]

/** Normaliza la categoría del comercio o asigna un valor amigable */
export function normalizeMerchantCategory(rawCategory: string | null | undefined): string {
  const clean = (rawCategory || '').trim()
  if (!clean) return 'Préstamos Personales Directos'
  const lower = clean.toLowerCase()
  if (lower.includes('electro') || lower.includes('hogar') || lower.includes('mueble')) return 'Electro y Hogar'
  if (lower.includes('construc') || lower.includes('ferret') || lower.includes('pintur')) return 'Construcción y Ferretería'
  if (lower.includes('moto') || lower.includes('auto') || lower.includes('rodado') || lower.includes('vehic')) return 'Motos y Movilidad'
  if (lower.includes('tecno') || lower.includes('celul') || lower.includes('comput') || lower.includes('electr')) return 'Tecnología y Telefonía'
  if (lower.includes('indument') || lower.includes('calzad') || lower.includes('ropa') || lower.includes('textil')) return 'Indumentaria y Calzado'
  if (lower.includes('salud') || lower.includes('optica') || lower.includes('farma')) return 'Salud y Bienestar'
  if (lower.includes('super') || lower.includes('alimen') || lower.includes('comest')) return 'Alimentos y Consumo'
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** Obtiene la clave YYYY-MM para una fecha ISO */
export function toMonthKey(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  // Ajuste aproximado a huso horario de Buenos Aires (UTC-3)
  const arDate = new Date(d.getTime() - 3 * 3_600_000)
  const y = arDate.getUTCFullYear()
  const m = String(arDate.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Genera la serie de meses retrospectivos */
export function generateRecentMonths(count = 12, referenceDate = new Date()): Array<{ key: string; label: string; shortLabel: string; year: number; month: number }> {
  const arRef = new Date(referenceDate.getTime() - 3 * 3_600_000)
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(arRef.getUTCFullYear(), arRef.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const label = `${MONTH_NAMES_ES[m]} ${y}`
    const shortLabel = MONTH_NAMES_ES[m]
    out.push({ key, label, shortLabel, year: y, month: m })
  }
  return out
}

/**
 * 1. Calcula el volumen de préstamos colocados por mes
 */
export function calculateMonthlyLoanPlacements(
  credits: Credit[],
  disbursements: Disbursement[] = [],
  monthsCount = 12,
  referenceDate = new Date(),
): MonthlyPlacementPoint[] {
  const months = generateRecentMonths(monthsCount, referenceDate)
  const monthMap = new Map<string, {
    volumePlaced: number
    loansCount: number
    repaidAmount: number
    outstandingAmount: number
    disbursedAmount: number
  }>()

  for (const m of months) {
    monthMap.set(m.key, {
      volumePlaced: 0,
      loansCount: 0,
      repaidAmount: 0,
      outstandingAmount: 0,
      disbursedAmount: 0,
    })
  }

  // Agrupar créditos por mes de otorgamiento / desembolso
  for (const credit of credits) {
    const key = toMonthKey(credit.disbursedAt)
    if (!key || !monthMap.has(key)) continue
    const cur = monthMap.get(key)!
    cur.volumePlaced += credit.amount
    cur.loansCount += 1
    cur.outstandingAmount += credit.principalOutstanding
    cur.repaidAmount += Math.max(0, credit.amount - credit.principalOutstanding)
  }

  // Complementar con desembolsos registrados si los hay
  for (const disb of disbursements) {
    if (disb.status !== 'completed') continue
    const key = toMonthKey(disb.completedAt || disb.requestedAt)
    if (!key || !monthMap.has(key)) continue
    const cur = monthMap.get(key)!
    cur.disbursedAmount += disb.amount
  }

  // Mapear resultado con métricas calculadas y tasa de crecimiento
  let previousVolume = 0
  const result: MonthlyPlacementPoint[] = months.map((m, idx) => {
    const data = monthMap.get(m.key)!
    const avgTicket = data.loansCount > 0 ? Math.round(data.volumePlaced / data.loansCount) : 0
    let growthRatePct = 0
    if (idx > 0 && previousVolume > 0) {
      growthRatePct = Math.round(((data.volumePlaced - previousVolume) / previousVolume) * 100 * 10) / 10
    }
    previousVolume = data.volumePlaced

    return {
      key: m.key,
      label: m.label,
      shortLabel: m.shortLabel,
      volumePlaced: Math.round(data.volumePlaced),
      volumePlacedMillions: Math.round((data.volumePlaced / 1_000_000) * 100) / 100,
      loansCount: data.loansCount,
      avgTicket,
      disbursedAmount: Math.round(data.disbursedAmount || data.volumePlaced),
      repaidAmount: Math.round(data.repaidAmount),
      outstandingAmount: Math.round(data.outstandingAmount),
      growthRatePct,
    }
  })

  return result
}

/**
 * 2. Calcula la tasa de morosidad en tiempo real y su distribución por tramos
 */
export function calculateRealtimeDelinquency(
  credits: Credit[],
  referenceDate = new Date(),
): RealtimeDelinquencyData {
  const activeCredits = credits.filter((c) => c.status === 'active')
  const totalActiveCredits = activeCredits.length

  let totalActivePortfolio = 0
  let totalDelinquentPortfolio = 0
  let late30Portfolio = 0
  let late60Portfolio = 0

  // Tramos de mora
  let alDiaCount = 0
  let alDiaAmount = 0

  let mora1_30Count = 0
  let mora1_30Amount = 0

  let mora31_60Count = 0
  let mora31_60Amount = 0

  let mora61_90Count = 0
  let mora61_90Amount = 0

  let mora90PlusCount = 0
  let mora90PlusAmount = 0

  for (const c of activeCredits) {
    const principal = c.principalOutstanding
    totalActivePortfolio += principal

    if (c.daysPastDue === 0 && c.bucket === 'al_dia') {
      alDiaCount += 1
      alDiaAmount += principal
    } else {
      totalDelinquentPortfolio += principal
      if (c.daysPastDue > 30) late30Portfolio += principal
      if (c.daysPastDue > 60) late60Portfolio += principal

      if (c.daysPastDue <= 30 || c.bucket === '1_30') {
        mora1_30Count += 1
        mora1_30Amount += principal
      } else if (c.daysPastDue <= 60 || c.bucket === '31_60') {
        mora31_60Count += 1
        mora31_60Amount += principal
      } else if (c.daysPastDue <= 90 || c.bucket === '61_90') {
        mora61_90Count += 1
        mora61_90Amount += principal
      } else {
        mora90PlusCount += 1
        mora90PlusAmount += principal
      }
    }
  }

  const overallDelinquencyRate = totalActivePortfolio > 0
    ? Math.round((totalDelinquentPortfolio / totalActivePortfolio) * 1000) / 10
    : 0

  const severeDelinquencyRate = totalActivePortfolio > 0
    ? Math.round((late30Portfolio / totalActivePortfolio) * 1000) / 10
    : 0

  const criticalDelinquencyRate = totalActivePortfolio > 0
    ? Math.round((late60Portfolio / totalActivePortfolio) * 1000) / 10
    : 0

  let statusTone: RealtimeDelinquencyData['statusTone'] = 'healthy'
  let statusLabel = 'Cartera saludable (mora < 3%)'

  if (overallDelinquencyRate > 10 || severeDelinquencyRate > 6) {
    statusTone = 'critical'
    statusLabel = 'Riesgo crítico de cobranza (mora > 10%)'
  } else if (overallDelinquencyRate > 5 || severeDelinquencyRate > 3) {
    statusTone = 'warning'
    statusLabel = 'Atención requerida (mora entre 5% y 10%)'
  } else if (overallDelinquencyRate > 3) {
    statusTone = 'caution'
    statusLabel = 'En monitoreo preventivo (mora entre 3% y 5%)'
  }

  const calcShare = (amount: number) =>
    totalActivePortfolio > 0 ? Math.round((amount / totalActivePortfolio) * 1000) / 10 : 0

  const buckets: DelinquencyBucketMetric[] = [
    {
      key: 'al_dia',
      label: 'Al día (0 días de atraso)',
      shortLabel: 'Al día',
      count: alDiaCount,
      amount: Math.round(alDiaAmount),
      amountMillions: Math.round((alDiaAmount / 1_000_000) * 100) / 100,
      shareOfPortfolioPct: calcShare(alDiaAmount),
      color: '#10b981', // Emerald 500
    },
    {
      key: '1_30',
      label: 'Mora temprana (1 a 30 días)',
      shortLabel: '1-30 d',
      count: mora1_30Count,
      amount: Math.round(mora1_30Amount),
      amountMillions: Math.round((mora1_30Amount / 1_000_000) * 100) / 100,
      shareOfPortfolioPct: calcShare(mora1_30Amount),
      color: '#f59e0b', // Amber 500
    },
    {
      key: '31_60',
      label: 'Mora media (31 a 60 días)',
      shortLabel: '31-60 d',
      count: mora31_60Count,
      amount: Math.round(mora31_60Amount),
      amountMillions: Math.round((mora31_60Amount / 1_000_000) * 100) / 100,
      shareOfPortfolioPct: calcShare(mora31_60Amount),
      color: '#f97316', // Orange 500
    },
    {
      key: '61_90',
      label: 'Mora tardía (61 a 90 días)',
      shortLabel: '61-90 d',
      count: mora61_90Count,
      amount: Math.round(mora61_90Amount),
      amountMillions: Math.round((mora61_90Amount / 1_000_000) * 100) / 100,
      shareOfPortfolioPct: calcShare(mora61_90Amount),
      color: '#ef4444', // Red 500
    },
    {
      key: '90_plus',
      label: 'Mora severa (+90 días / Incobrable)',
      shortLabel: '+90 d',
      count: mora90PlusCount,
      amount: Math.round(mora90PlusAmount),
      amountMillions: Math.round((mora90PlusAmount / 1_000_000) * 100) / 100,
      shareOfPortfolioPct: calcShare(mora90PlusAmount),
      color: '#b91c1c', // Crimson 700
    },
  ]

  // Serie histórica estimada o derivada por mes de cosechas
  const recentMonths = generateRecentMonths(6, referenceDate)
  const historicalTrend = recentMonths.map((m) => {
    // Estimación coherente a partir de créditos otorgados en esos períodos
    const cohortCredits = credits.filter((c) => toMonthKey(c.disbursedAt) === m.key)
    const cohortTotal = cohortCredits.reduce((s, c) => s + c.amount, 0)
    const cohortLate = cohortCredits
      .filter((c) => c.status === 'active' && c.daysPastDue > 0)
      .reduce((s, c) => s + c.principalOutstanding, 0)
    const cohortLate30 = cohortCredits
      .filter((c) => c.status === 'active' && c.daysPastDue > 30)
      .reduce((s, c) => s + c.principalOutstanding, 0)

    const rate = cohortTotal > 0 ? Math.round((cohortLate / cohortTotal) * 1000) / 10 : overallDelinquencyRate
    const rate30 = cohortTotal > 0 ? Math.round((cohortLate30 / cohortTotal) * 1000) / 10 : severeDelinquencyRate

    return {
      monthKey: m.key,
      monthLabel: m.label,
      totalPortfolio: Math.round(cohortTotal || totalActivePortfolio / 6),
      latePortfolio: Math.round(cohortLate),
      moraRatePct: rate,
      mora30RatePct: rate30,
    }
  })

  return {
    totalActiveCredits,
    totalActivePortfolio: Math.round(totalActivePortfolio),
    totalDelinquentPortfolio: Math.round(totalDelinquentPortfolio),
    overallDelinquencyRate,
    severeDelinquencyRate,
    criticalDelinquencyRate,
    statusTone,
    statusLabel,
    buckets,
    historicalTrend,
  }
}

/**
 * 3. Calcula la distribución de cartera por tipo / rubro de comercio
 */
export function calculateMerchantPortfolioDistribution(
  credits: Credit[],
  merchants: Merchant[],
): MerchantCategoryMetric[] {
  const merchantById = new Map(merchants.map((m) => [m.id, m]))

  // Agrupador por categoría normalizada
  const categoryStats = new Map<string, {
    merchantsSet: Set<string>
    activeLoansCount: number
    totalPlacedVolume: number
    activePortfolioVolume: number
    delinquentVolume: number
  }>()

  // Conteo de comercios registrados por categoría
  for (const m of merchants) {
    const cat = normalizeMerchantCategory(m.category)
    if (!categoryStats.has(cat)) {
      categoryStats.set(cat, {
        merchantsSet: new Set(),
        activeLoansCount: 0,
        totalPlacedVolume: 0,
        activePortfolioVolume: 0,
        delinquentVolume: 0,
      })
    }
    categoryStats.get(cat)!.merchantsSet.add(m.id)
  }

  // Acumulación de créditos
  for (const credit of credits) {
    const merchant = credit.merchantId ? merchantById.get(credit.merchantId) : null
    const category = normalizeMerchantCategory(merchant?.category)

    if (!categoryStats.has(category)) {
      categoryStats.set(category, {
        merchantsSet: new Set(),
        activeLoansCount: 0,
        totalPlacedVolume: 0,
        activePortfolioVolume: 0,
        delinquentVolume: 0,
      })
    }
    const stat = categoryStats.get(category)!
    stat.totalPlacedVolume += credit.amount

    if (credit.status === 'active') {
      stat.activeLoansCount += 1
      stat.activePortfolioVolume += credit.principalOutstanding
      if (credit.daysPastDue > 0) {
        stat.delinquentVolume += credit.principalOutstanding
      }
    }
  }

  // Total de cartera activa para cálculo de porcentajes
  let grandTotalActive = 0
  for (const stat of categoryStats.values()) {
    grandTotalActive += stat.activePortfolioVolume
  }
  // Si no hay saldo activo, usar volumen colocado
  if (grandTotalActive === 0) {
    for (const stat of categoryStats.values()) {
      grandTotalActive += stat.totalPlacedVolume
    }
  }

  // Convertir a lista y ordenar por mayor saldo activo / volumen
  const categoriesList = Array.from(categoryStats.entries()).map(([cat, stat], index) => {
    const shareOfTotalPortfolioPct = grandTotalActive > 0
      ? Math.round(((stat.activePortfolioVolume || stat.totalPlacedVolume) / grandTotalActive) * 1000) / 10
      : 0

    const delinquencyRatePct = stat.activePortfolioVolume > 0
      ? Math.round((stat.delinquentVolume / stat.activePortfolioVolume) * 1000) / 10
      : 0

    const avgTicket = stat.activeLoansCount > 0
      ? Math.round(stat.totalPlacedVolume / stat.activeLoansCount)
      : Math.round(stat.totalPlacedVolume)

    const color = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]

    return {
      category: cat,
      categorySlug: cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      merchantsCount: stat.merchantsSet.size,
      activeLoansCount: stat.activeLoansCount,
      totalPlacedVolume: Math.round(stat.totalPlacedVolume),
      activePortfolioVolume: Math.round(stat.activePortfolioVolume),
      shareOfTotalPortfolioPct,
      delinquentVolume: Math.round(stat.delinquentVolume),
      delinquencyRatePct,
      avgTicket,
      color,
    }
  })

  // Ordenar de mayor a menor participación
  categoriesList.sort((a, b) => b.activePortfolioVolume - a.activePortfolioVolume || b.totalPlacedVolume - a.totalPlacedVolume)

  return categoriesList
}

/**
 * 4. Resumen ejecutivo general con métricas clave cruzadas
 */
export function calculateExecutiveKpiSummary(
  monthlyPlacements: MonthlyPlacementPoint[],
  realtimeDelinquency: RealtimeDelinquencyData,
  categories: MerchantCategoryMetric[],
): ExecutiveKpiSummary {
  const totalPlacedAllTime = monthlyPlacements.reduce((s, p) => s + p.volumePlaced, 0)
  const currentActivePortfolio = realtimeDelinquency.totalActivePortfolio
  const totalActiveLoans = realtimeDelinquency.totalActiveCredits
  const currentMoraRatePct = realtimeDelinquency.overallDelinquencyRate

  // Top categoría
  const topCategory = categories[0]
  const topCategoryName = topCategory?.category || 'Sin datos'
  const topCategorySharePct = topCategory?.shareOfTotalPortfolioPct || 0

  // Mejor mes histórico
  const bestMonth = [...monthlyPlacements].sort((a, b) => b.volumePlaced - a.volumePlaced)[0]
  const bestMonthLabel = bestMonth?.label || '—'
  const bestMonthVolume = bestMonth?.volumePlaced || 0

  // Crecimiento promedio mensual (excluyendo meses en cero)
  const nonZeroMonths = monthlyPlacements.filter((m) => m.volumePlaced > 0)
  const avgMonthlyGrowthPct = nonZeroMonths.length > 1
    ? Math.round(
        (nonZeroMonths.slice(1).reduce((s, m) => s + m.growthRatePct, 0) / (nonZeroMonths.length - 1)) * 10,
      ) / 10
    : 0

  return {
    totalPlacedAllTime,
    currentActivePortfolio,
    totalActiveLoans,
    currentMoraRatePct,
    topCategoryName,
    topCategorySharePct,
    bestMonthLabel,
    bestMonthVolume,
    avgMonthlyGrowthPct,
  }
}
