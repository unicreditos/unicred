import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateMonthlyLoanPlacements,
  calculateRealtimeDelinquency,
  calculateMerchantPortfolioDistribution,
  calculateExecutiveKpiSummary,
  calculateCriticalDelinquencyAlerts,
  getThermalHeatStyle,
  normalizeMerchantCategory,
  toMonthKey,
} from '../../lib/admin-desk/recharts-metrics'
import type { Credit, Merchant } from '../../lib/admin-desk/types'

test('normalizeMerchantCategory categorizes properly', () => {
  assert.equal(normalizeMerchantCategory('Electro Hogar'), 'Electro y Hogar')
  assert.equal(normalizeMerchantCategory('Ferretería Central'), 'Construcción y Ferretería')
  assert.equal(normalizeMerchantCategory('Motos Mendoza'), 'Motos y Movilidad')
  assert.equal(normalizeMerchantCategory('Tecno Shop'), 'Tecnología y Telefonía')
  assert.equal(normalizeMerchantCategory(''), 'Préstamos Personales Directos')
  assert.equal(normalizeMerchantCategory(null), 'Préstamos Personales Directos')
})

test('toMonthKey parses dates to YYYY-MM correctly', () => {
  assert.equal(toMonthKey('2026-03-15T12:00:00Z'), '2026-03')
  assert.equal(toMonthKey('invalid-date'), null)
  assert.equal(toMonthKey(null), null)
})

test('calculateMonthlyLoanPlacements aggregates volume and calculates metrics', () => {
  const refDate = new Date('2026-04-15T12:00:00Z')
  const credits: Credit[] = [
    {
      id: 'c1',
      applicationId: 'a1',
      clientId: 'u1',
      productId: 'p1',
      merchantId: null,
      amount: 100_000,
      principalOutstanding: 80_000,
      installments: 12,
      installmentAmount: 12_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-04-05T10:00:00Z',
      firstDueDate: '2026-05-05T10:00:00Z',
      schedule: [],
      daysPastDue: 0,
      bucket: 'al_dia',
    },
    {
      id: 'c2',
      applicationId: 'a2',
      clientId: 'u2',
      productId: 'p1',
      merchantId: null,
      amount: 150_000,
      principalOutstanding: 120_000,
      installments: 12,
      installmentAmount: 18_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-04-10T10:00:00Z',
      firstDueDate: '2026-05-10T10:00:00Z',
      schedule: [],
      daysPastDue: 0,
      bucket: 'al_dia',
    },
    {
      id: 'c3',
      applicationId: 'a3',
      clientId: 'u3',
      productId: 'p1',
      merchantId: null,
      amount: 200_000,
      principalOutstanding: 160_000,
      installments: 12,
      installmentAmount: 24_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-03-20T10:00:00Z',
      firstDueDate: '2026-04-20T10:00:00Z',
      schedule: [],
      daysPastDue: 0,
      bucket: 'al_dia',
    },
  ]

  const result = calculateMonthlyLoanPlacements(credits, [], 6, refDate)
  assert.equal(result.length, 6)

  const aprPoint = result.find((p) => p.key === '2026-04')
  assert.ok(aprPoint)
  assert.equal(aprPoint.volumePlaced, 250_000)
  assert.equal(aprPoint.loansCount, 2)
  assert.equal(aprPoint.avgTicket, 125_000)

  const marPoint = result.find((p) => p.key === '2026-03')
  assert.ok(marPoint)
  assert.equal(marPoint.volumePlaced, 200_000)
  assert.equal(marPoint.loansCount, 1)
})

test('calculateRealtimeDelinquency computes delinquency rates and buckets accurately', () => {
  const credits: Credit[] = [
    {
      id: 'c1',
      applicationId: 'a1',
      clientId: 'u1',
      productId: 'p1',
      merchantId: null,
      amount: 100_000,
      principalOutstanding: 100_000,
      installments: 12,
      installmentAmount: 12_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-01-01T00:00:00Z',
      firstDueDate: '2026-02-01T00:00:00Z',
      schedule: [],
      daysPastDue: 0,
      bucket: 'al_dia',
    },
    {
      id: 'c2',
      applicationId: 'a2',
      clientId: 'u2',
      productId: 'p1',
      merchantId: null,
      amount: 100_000,
      principalOutstanding: 50_000,
      installments: 12,
      installmentAmount: 12_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-01-01T00:00:00Z',
      firstDueDate: '2026-02-01T00:00:00Z',
      schedule: [],
      daysPastDue: 15,
      bucket: '1_30',
    },
    {
      id: 'c3',
      applicationId: 'a3',
      clientId: 'u3',
      productId: 'p1',
      merchantId: null,
      amount: 100_000,
      principalOutstanding: 50_000,
      installments: 12,
      installmentAmount: 12_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-01-01T00:00:00Z',
      firstDueDate: '2026-02-01T00:00:00Z',
      schedule: [],
      daysPastDue: 45,
      bucket: '31_60',
    },
  ]

  const del = calculateRealtimeDelinquency(credits)
  // Total saldo vivo: 100k + 50k + 50k = 200k
  assert.equal(del.totalActivePortfolio, 200_000)
  // Total en mora: 50k + 50k = 100k (50%)
  assert.equal(del.totalDelinquentPortfolio, 100_000)
  assert.equal(del.overallDelinquencyRate, 50)
  // Mora severa (>30d): 50k (25%)
  assert.equal(del.severeDelinquencyRate, 25)

  const alDiaBucket = del.buckets.find((b) => b.key === 'al_dia')
  assert.equal(alDiaBucket?.count, 1)
  assert.equal(alDiaBucket?.amount, 100_000)
  assert.equal(alDiaBucket?.shareOfPortfolioPct, 50)

  const b1_30 = del.buckets.find((b) => b.key === '1_30')
  assert.equal(b1_30?.count, 1)
  assert.equal(b1_30?.amount, 50_000)
})

test('calculateMerchantPortfolioDistribution segments by category and computes shares', () => {
  const merchants: Merchant[] = [
    {
      id: 'm1',
      name: 'Mueblería Norte',
      cuit: '30-11111111-1',
      category: 'Electro y Hogar',
      status: 'active',
      commissionPct: 2,
      city: 'CABA',
      province: 'Buenos Aires',
    },
  ]

  const credits: Credit[] = [
    {
      id: 'c1',
      applicationId: 'a1',
      clientId: 'u1',
      productId: 'p1',
      merchantId: 'm1',
      amount: 100_000,
      principalOutstanding: 100_000,
      installments: 12,
      installmentAmount: 12_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-01-01T00:00:00Z',
      firstDueDate: '2026-02-01T00:00:00Z',
      schedule: [],
      daysPastDue: 0,
      bucket: 'al_dia',
    },
    {
      id: 'c2',
      applicationId: 'a2',
      clientId: 'u2',
      productId: 'p1',
      merchantId: null,
      amount: 300_000,
      principalOutstanding: 300_000,
      installments: 12,
      installmentAmount: 36_000,
      tna: 78,
      tea: 110,
      cft: 140,
      status: 'active',
      disbursedAt: '2026-01-01T00:00:00Z',
      firstDueDate: '2026-02-01T00:00:00Z',
      schedule: [],
      daysPastDue: 0,
      bucket: 'al_dia',
    },
  ]

  const categories = calculateMerchantPortfolioDistribution(credits, merchants)
  assert.ok(categories.length >= 2)

  const directCategory = categories.find((c) => c.category === 'Préstamos Personales Directos')
  assert.ok(directCategory)
  assert.equal(directCategory.activePortfolioVolume, 300_000)
  assert.equal(directCategory.shareOfTotalPortfolioPct, 75)

  const electroCategory = categories.find((c) => c.category === 'Electro y Hogar')
  assert.ok(electroCategory)
  assert.equal(electroCategory.activePortfolioVolume, 100_000)
  assert.equal(electroCategory.shareOfTotalPortfolioPct, 25)
})

test('getThermalHeatStyle assigns correct levels and colors by threshold', () => {
  const opt = getThermalHeatStyle(2.5, 15)
  assert.equal(opt.level, 'optimal')
  assert.equal(opt.hex, '#059669')

  const mod = getThermalHeatStyle(7.5, 15)
  assert.equal(mod.level, 'moderate')

  const ele = getThermalHeatStyle(12.0, 15)
  assert.equal(ele.level, 'elevated')

  const crit = getThermalHeatStyle(18.5, 15)
  assert.equal(crit.level, 'critical')
  assert.equal(crit.hex, '#dc2626')

  const severe = getThermalHeatStyle(35.0, 15)
  assert.equal(severe.level, 'critical')
  assert.equal(severe.hex, '#b91c1c')
})

test('calculateCriticalDelinquencyAlerts flags categories exceeding 15% threshold', () => {
  const dummyCategories = [
    {
      category: 'Construcción y Ferretería',
      categorySlug: 'construccion-y-ferreteria',
      merchantsCount: 3,
      activeLoansCount: 8,
      totalPlacedVolume: 5_000_000,
      activePortfolioVolume: 3_800_000,
      shareOfTotalPortfolioPct: 35,
      delinquentVolume: 950_000,
      delinquencyRatePct: 25.0, // > 15% -> CRITICAL!
      avgTicket: 625_000,
      color: '#2563eb',
    },
    {
      category: 'Tecnología y Celulares',
      categorySlug: 'tecnologia-y-celulares',
      merchantsCount: 2,
      activeLoansCount: 5,
      totalPlacedVolume: 2_000_000,
      activePortfolioVolume: 1_500_000,
      shareOfTotalPortfolioPct: 20,
      delinquentVolume: 300_000,
      delinquencyRatePct: 20.0, // > 15% -> CRITICAL!
      avgTicket: 400_000,
      color: '#7c3aed',
    },
    {
      category: 'Electro y Hogar',
      categorySlug: 'electro-y-hogar',
      merchantsCount: 4,
      activeLoansCount: 12,
      totalPlacedVolume: 6_000_000,
      activePortfolioVolume: 4_500_000,
      shareOfTotalPortfolioPct: 40,
      delinquentVolume: 180_000,
      delinquencyRatePct: 4.0, // < 15% -> OPTIMAL
      avgTicket: 500_000,
      color: '#059669',
    },
    {
      category: 'Indumentaria',
      categorySlug: 'indumentaria',
      merchantsCount: 2,
      activeLoansCount: 4,
      totalPlacedVolume: 800_000,
      activePortfolioVolume: 600_000,
      shareOfTotalPortfolioPct: 5,
      delinquentVolume: 72_000,
      delinquencyRatePct: 12.0, // 10-15% -> ELEVATED (not critical)
      avgTicket: 200_000,
      color: '#d97706',
    },
  ]

  const alerts = calculateCriticalDelinquencyAlerts(dummyCategories, 15)

  assert.equal(alerts.thresholdPct, 15)
  assert.equal(alerts.totalCategoriesEvaluated, 4)
  assert.equal(alerts.criticalCategoriesCount, 2)
  assert.equal(alerts.hasCriticalAlerts, true)
  assert.equal(alerts.totalPortfolioAtCriticalRisk, 3_800_000 + 1_500_000)
  assert.equal(alerts.totalDelinquentInCriticalSectors, 950_000 + 300_000)

  // Critical categories list
  assert.equal(alerts.criticalCategories.length, 2)
  assert.equal(alerts.criticalCategories[0].category, 'Construcción y Ferretería')
  assert.equal(alerts.criticalCategories[0].isCritical, true)
  assert.equal(alerts.criticalCategories[0].heatLevel, 'critical')
  assert.equal(alerts.criticalCategories[1].category, 'Tecnología y Celulares')
  assert.equal(alerts.criticalCategories[1].isCritical, true)

  // Max and avg
  assert.equal(alerts.maxMoraPct, 25.0)
})
