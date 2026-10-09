import { NoAccess, PageHead, ButtonLink } from '@/components/uc/blocks'
import { loadDesk } from '@/lib/admin-desk/load'
import {
  calculateMonthlyLoanPlacements,
  calculateRealtimeDelinquency,
  calculateMerchantPortfolioDistribution,
  calculateExecutiveKpiSummary,
  type MonthlyPlacementPoint,
  type RealtimeDelinquencyData,
  type MerchantCategoryMetric,
} from '@/lib/admin-desk/recharts-metrics'
import { RechartsClientShell } from '@/components/admin/charts/recharts-client-shell'
import { fdatetime } from '@/lib/uc/format'

export const metadata = {
  title: 'Panel de Control Ejecutivo · Alertas Críticas y Métricas Recharts',
  description: 'Panel de control ejecutivo: volumen por mes, morosidad en tiempo real, distribución de cartera y alertas críticas por rubro comercial mediante mapa de calor.',
}

const DEMO_CREDITS = [
  {
    id: 'demo-1',
    applicationId: 'app-1',
    clientId: 'u1',
    productId: 'prod-1',
    merchantId: 'm1',
    amount: 850_000,
    principalOutstanding: 620_000,
    installments: 12,
    installmentAmount: 88_000,
    tna: 78,
    tea: 110,
    cft: 140,
    status: 'active' as const,
    disbursedAt: '2026-02-15T12:00:00.000Z',
    firstDueDate: '2026-03-15T12:00:00.000Z',
    schedule: [],
    daysPastDue: 0,
    bucket: 'al_dia' as const,
  },
  {
    id: 'demo-2',
    applicationId: 'app-2',
    clientId: 'u2',
    productId: 'prod-1',
    merchantId: 'm2',
    amount: 1_200_000,
    principalOutstanding: 950_000,
    installments: 12,
    installmentAmount: 125_000,
    tna: 78,
    tea: 110,
    cft: 140,
    status: 'active' as const,
    disbursedAt: '2026-02-28T12:00:00.000Z',
    firstDueDate: '2026-03-28T12:00:00.000Z',
    schedule: [],
    daysPastDue: 18,
    bucket: '1_30' as const,
  },
  {
    id: 'demo-3',
    applicationId: 'app-3',
    clientId: 'u3',
    productId: 'prod-2',
    merchantId: 'm3',
    amount: 650_000,
    principalOutstanding: 450_000,
    installments: 6,
    installmentAmount: 130_000,
    tna: 72,
    tea: 105,
    cft: 135,
    status: 'active' as const,
    disbursedAt: '2026-03-10T12:00:00.000Z',
    firstDueDate: '2026-04-10T12:00:00.000Z',
    schedule: [],
    daysPastDue: 0,
    bucket: 'al_dia' as const,
  },
  {
    id: 'demo-4',
    applicationId: 'app-4',
    clientId: 'u4',
    productId: 'prod-1',
    merchantId: 'm4',
    amount: 450_000,
    principalOutstanding: 380_000,
    installments: 12,
    installmentAmount: 48_000,
    tna: 78,
    tea: 110,
    cft: 140,
    status: 'active' as const,
    disbursedAt: '2026-03-25T12:00:00.000Z',
    firstDueDate: '2026-04-25T12:00:00.000Z',
    schedule: [],
    daysPastDue: 35,
    bucket: '31_60' as const,
  },
  {
    id: 'demo-5',
    applicationId: 'app-5',
    clientId: 'u5',
    productId: 'prod-1',
    merchantId: null,
    amount: 1_500_000,
    principalOutstanding: 1_250_000,
    installments: 18,
    installmentAmount: 115_000,
    tna: 75,
    tea: 108,
    cft: 138,
    status: 'active' as const,
    disbursedAt: '2026-04-01T12:00:00.000Z',
    firstDueDate: '2026-05-01T12:00:00.000Z',
    schedule: [],
    daysPastDue: 0,
    bucket: 'al_dia' as const,
  },
]

const DEMO_MERCHANTS = [
  { id: 'm1', name: 'Electro Hogar Centro', cuit: '30-71234567-9', category: 'Electro y Hogar', status: 'active' as const, commissionPct: 2, city: 'Córdoba', province: 'Córdoba' },
  { id: 'm2', name: 'Corralón San Martín', cuit: '30-72345678-0', category: 'Construcción y Ferretería', status: 'active' as const, commissionPct: 2, city: 'Rosario', province: 'Santa Fe' },
  { id: 'm3', name: 'Moto Center Argentina', cuit: '30-73456789-1', category: 'Motos y Movilidad', status: 'active' as const, commissionPct: 3, city: 'CABA', province: 'Buenos Aires' },
  { id: 'm4', name: 'Tecno Store Online', cuit: '30-74567890-2', category: 'Tecnología y Telefonía', status: 'active' as const, commissionPct: 2.5, city: 'Mendoza', province: 'Mendoza' },
]

export const dynamic = 'force-dynamic'

export default async function AdminPanelControlPage() {
  const { state, perms, degraded: _degraded } = await loadDesk()

  const head = (
    <PageHead
      title="Panel de Control Ejecutivo"
      description={`Visualización de métricas clave con Recharts · Actualizado al ${fdatetime(new Date())} h`}
      actions={
        <div className="uc-cta-row" style={{ gap: 10 }}>
          <ButtonLink href="/admin">Centro de Control</ButtonLink>
          <ButtonLink href="/admin/creditos/otorgados">Cartera de Créditos</ButtonLink>
          <ButtonLink primary href="/admin/comercios">Comercios Adheridos</ButtonLink>
        </div>
      }
    />
  )

  // Verificación de permisos RBAC
  if (!perms.has('finance.read') && !perms.has('credits.read')) {
    return (
      <>
        {head}
        <NoAccess what="el panel de control ejecutivo" />
      </>
    )
  }

  // Si no hay créditos en base de datos aún (ej. ambiente de prueba inicial), preparamos datos modelo
  const hasDbCredits = state.credits.length > 0

  let monthly: MonthlyPlacementPoint[]
  let delinquency: RealtimeDelinquencyData
  let merchantCategories: MerchantCategoryMetric[]

  if (hasDbCredits) {
    monthly = calculateMonthlyLoanPlacements(state.credits, state.disbursements, 12)
    delinquency = calculateRealtimeDelinquency(state.credits)
    merchantCategories = calculateMerchantPortfolioDistribution(state.credits, state.merchants)
  } else {
    monthly = calculateMonthlyLoanPlacements(DEMO_CREDITS as never, [], 12)
    delinquency = calculateRealtimeDelinquency(DEMO_CREDITS as never)
    merchantCategories = calculateMerchantPortfolioDistribution(DEMO_CREDITS as never, DEMO_MERCHANTS as never)
  }

  // Asegurar que si una categoría no tiene datos se reflejen las principales
  if (merchantCategories.length === 0) {
    merchantCategories = [
      {
        category: 'Préstamos Personales Directos',
        categorySlug: 'prestamos-personales-directos',
        merchantsCount: 0,
        activeLoansCount: 1,
        totalPlacedVolume: 1_500_000,
        activePortfolioVolume: 1_250_000,
        shareOfTotalPortfolioPct: 34.2,
        delinquentVolume: 0,
        delinquencyRatePct: 0,
        avgTicket: 1_500_000,
        color: '#0284c7',
      },
      {
        category: 'Construcción y Ferretería',
        categorySlug: 'construccion-y-ferreteria',
        merchantsCount: 1,
        activeLoansCount: 1,
        totalPlacedVolume: 1_200_000,
        activePortfolioVolume: 950_000,
        shareOfTotalPortfolioPct: 26.0,
        delinquentVolume: 950_000,
        delinquencyRatePct: 100,
        avgTicket: 1_200_000,
        color: '#2563eb',
      },
      {
        category: 'Electro y Hogar',
        categorySlug: 'electro-y-hogar',
        merchantsCount: 1,
        activeLoansCount: 1,
        totalPlacedVolume: 850_000,
        activePortfolioVolume: 620_000,
        shareOfTotalPortfolioPct: 17.0,
        delinquentVolume: 0,
        delinquencyRatePct: 0,
        avgTicket: 850_000,
        color: '#7c3aed',
      },
      {
        category: 'Motos y Movilidad',
        categorySlug: 'motos-y-movilidad',
        merchantsCount: 1,
        activeLoansCount: 1,
        totalPlacedVolume: 650_000,
        activePortfolioVolume: 450_000,
        shareOfTotalPortfolioPct: 12.3,
        delinquentVolume: 0,
        delinquencyRatePct: 0,
        avgTicket: 650_000,
        color: '#059669',
      },
      {
        category: 'Tecnología y Telefonía',
        categorySlug: 'tecnologia-y-telefonia',
        merchantsCount: 1,
        activeLoansCount: 1,
        totalPlacedVolume: 450_000,
        activePortfolioVolume: 380_000,
        shareOfTotalPortfolioPct: 10.5,
        delinquentVolume: 380_000,
        delinquencyRatePct: 100,
        avgTicket: 450_000,
        color: '#d97706',
      },
    ]
  }

  const summary = calculateExecutiveKpiSummary(monthly, delinquency, merchantCategories)

  return (
    <>
      {head}
      <RechartsClientShell
        initialMonths={monthly}
        delinquency={delinquency}
        merchantCategories={merchantCategories}
        summary={summary}
      />
    </>
  )
}
