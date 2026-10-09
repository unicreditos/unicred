import { Suspense } from 'react'
import { loadCustomer } from '@/lib/customer/load'
import { BackLink, ButtonLink, PageHead } from '@/components/uc/blocks'
import { PartialPaymentCalculator } from '@/components/dashboard/partial-payment-calculator'
import { Icon } from '@/components/uc/icons'

export const metadata = {
  title: 'Calculadora de Pago Parcial e Impacto en Saldo',
  description:
    'Calculá automáticamente si tu pago parcial cubre intereses y capital vencido, mostrando el impacto exacto en tu saldo pendiente.',
}

export default async function PagoParcialPage({
  searchParams,
}: {
  searchParams?: Promise<{ loan?: string; cuota?: string }>
}) {
  const params = await searchParams
  const loanId = params?.loan
  const { loans, installments } = await loadCustomer()

  return (
    <>
      <BackLink href="/dashboard/pagos">Volver a Pagos</BackLink>
      <PageHead
        title="Simulador de Pago Parcial"
        description="Calculá automáticamente si un pago a cuenta cubre los intereses y el capital vencido, y conocé el impacto exacto en tu saldo deudor."
        actions={
          <div className="uc-cta-row" style={{ gap: 8 }}>
            <ButtonLink href="/dashboard/creditos">
              <Icon name="credit" size="sm" />
              Mis créditos
            </ButtonLink>
            <ButtonLink primary href="/dashboard/pagos">
              <Icon name="wallet" size="sm" />
              Pagar cuota
            </ButtonLink>
          </div>
        }
      />

      <Suspense fallback={<div className="uc-card uc-pad">Cargando simulador...</div>}>
        <PartialPaymentCalculator
          loans={loans}
          installments={installments}
          preselectedLoanId={loanId}
        />
      </Suspense>
    </>
  )
}
