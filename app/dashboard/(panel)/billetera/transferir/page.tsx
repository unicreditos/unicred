import type { Metadata } from 'next'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { TransferForm } from '@/components/wallet/transfer-form'
import { getKycOverview } from '@/lib/kyc'
import { listContacts } from '@/lib/wallet/contacts'
import { requireCustomerId } from '@/lib/session'
import { getWalletOverview } from '@/lib/wallet/queries'

export const metadata: Metadata = { title: 'Transferir' }

export default async function TransferPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const raw = Array.isArray(sp.destino) ? sp.destino[0] : sp.destino
  const destino = (raw ?? '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30)
  const userId = await requireCustomerId()
  const [{ wallet }, kyc, contacts] = await Promise.all([getWalletOverview(userId), getKycOverview(userId), listContacts(userId)])
  return (
    <PageWidth width="max-w-2xl">
      <PageTitle title="Transferir" description="Enviá dinero a otra billetera UNICRÉDITOS: llega al instante y sin costo." />
      <TransferForm initialDestination={destino} contacts={contacts} balance={wallet.balance} canSend={kyc.status === 'approved' && wallet.status === 'active'} />
    </PageWidth>
  )
}
