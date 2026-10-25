import type { Metadata } from 'next'
import { PageWidth, PageTitle } from '@/components/wallet/page-width'
import { previewQr } from '@/app/actions/billetera'
import { QrPayer, type InitialQr } from '@/components/wallet/qr-payer'
import { getKycOverview } from '@/lib/kyc'
import { requireCustomerId } from '@/lib/session'
import { getWalletOverview } from '@/lib/wallet/queries'

export const metadata: Metadata = { title: 'Pagar con QR' }

export default async function PayQrPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const userId = await requireCustomerId()
  const params = await searchParams
  const token = Array.isArray(params.c) ? params.c[0] : params.c
  const [{ wallet }, kyc, initial] = await Promise.all([
    getWalletOverview(userId),
    getKycOverview(userId),
    token ? previewQr(token) : Promise.resolve(null),
  ])
  return (
    <PageWidth width="max-w-2xl">
      <PageTitle title="Pagar con QR" description="Pagá desde tu saldo los QR internos de UNICRÉDITOS: escaneá el QR o pegá su enlace, revisá a quién le pagás y confirmá. Los QR de Mercado Pago se pagan desde tu banco o billetera." />
      <QrPayer initial={initial as InitialQr} balance={wallet.balance} canSend={kyc.status === 'approved' && wallet.status === 'active'} />
    </PageWidth>
  )
}
