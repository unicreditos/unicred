import { DirectoLanding } from '@/directo/landing'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Crédito en línea sin hostigamiento | UNICRÉDITOS',
  },
  description:
    'Solicitá un crédito personal en línea. RM International Group S.A.S., CUIT publicado, KYC Didit, BCRA, contrato de mutuo y desembolso en tu CBU o CVU.',
}

export default function DirectoPage() {
  return <DirectoLanding />
}
