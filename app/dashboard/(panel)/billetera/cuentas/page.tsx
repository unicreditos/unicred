import type { Metadata } from 'next'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { BankAccountsManager } from '@/components/wallet/bank-accounts-manager'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { getKycOverview } from '@/lib/kyc'
import { requireCustomerId } from '@/lib/session'
import { listOwnBankAccounts } from '@/lib/wallet/bank-accounts'

export const metadata: Metadata = { title: 'Mis cuentas bancarias' }

export default async function BankAccountsPage() {
  const userId = await requireCustomerId()
  const [accounts, kyc] = await Promise.all([listOwnBankAccounts(userId), getKycOverview(userId)])
  const [holder] = await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  return (
    <PageWidth width="max-w-3xl">
      <PageTitle title="Mis cuentas bancarias" description="Las cuentas a tu nombre a las que podés retirar tu saldo." />
      <BankAccountsManager
        canAdd={kyc.status === 'approved'}
        ownerName={holder?.name ?? ''}
        accounts={accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          holderName: a.holderName,
          cbu: a.cbu,
          cvu: a.cvu,
          alias: a.alias,
          isPrimary: a.isPrimary,
          verified: a.isVerified,
        }))}
      />
    </PageWidth>
  )
}
