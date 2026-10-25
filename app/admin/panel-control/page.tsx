import { NoAccess, PageHead, ButtonLink } from '@/components/uc/blocks'
import { loadDesk } from '@/lib/admin-desk/load'
import {
  calculateMonthlyLoanPlacements,
  calculateRealtimeDelinquency,
  calculateMerchantPortfolioDistribution,
  calculateExecutiveKpiSummary,
} from '@/lib/admin-desk/recharts-metrics'
import { RechartsClientShell } from '@/components/admin/charts/recharts-client-shell'
import { fdatetime } from '@/lib/uc/format'

export const metadata = {
  title: 'Panel de Control Ejecutivo · Alertas críticas y métricas',
  description: 'Panel de control ejecutivo: volumen por mes, morosidad en tiempo real, distribución de cartera y alertas críticas por rubro comercial mediante mapa de calor.',
}

export const dynamic = 'force-dynamic'

export default async function AdminPanelControlPage() {
  const { state, perms } = await loadDesk()

  const head = (
    <PageHead
      title="Panel de Control Ejecutivo"
      description={`Métricas clave de la cartera · Actualizado al ${fdatetime(new Date())} h`}
      actions={
        <div className="uc-cta-row" style={{ gap: 10 }}>
          <ButtonLink href="/admin">Centro de Control</ButtonLink>
          <ButtonLink href="/admin/creditos/otorgados">Cartera de Créditos</ButtonLink>
          <ButtonLink primary href="/admin/comercios">Comercios Adheridos</ButtonLink>
        </div>
      }
    />
  )

  if (!perms.has('finance.read') && !perms.has('credits.read')) {
    return (
      <>
        {head}
        <NoAccess what="el panel de control ejecutivo" />
      </>
    )
  }

  const monthly = calculateMonthlyLoanPlacements(state.credits, state.disbursements, 12)
  const delinquency = calculateRealtimeDelinquency(state.credits)
  const merchantCategories = calculateMerchantPortfolioDistribution(state.credits, state.merchants)
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
