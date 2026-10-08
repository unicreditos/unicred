import { getMyBankAccounts } from '@/app/actions/banking'
import { BankAccountsSection } from '@/components/dashboard/bank-accounts-section'
import { PageHead } from '@/components/uc/blocks'
import { loadCustomerBase } from '@/lib/customer/load'

export const metadata = { title: 'Cuentas para cobrar' }

export default async function CuentasPage() {
  const { user, profile } = await loadCustomerBase()
  const accounts = await getMyBankAccounts().catch(() => [])
  return (
    <>
      <PageHead
        title="Cuentas para cobrar"
        description="La cuenta donde recibís el dinero de tu crédito. Siempre tiene que estar a tu nombre: no se gira a terceros."
      />
      <BankAccountsSection accounts={accounts} profile={profile} defaultHolderName={user.name} />
    </>
  )
}
