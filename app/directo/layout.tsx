import { DirectoShell } from '@/directo/chrome'
import type { Metadata } from 'next'
import '@/directo/skin.css'

export const metadata: Metadata = {
  title: {
    default: 'Crédito en línea | UNICRÉDITOS',
    template: '%s | UNICRÉDITOS',
  },
  description:
    'Pedí tu crédito en línea con UNICRÉDITOS. Empresa real, contrato de mutuo, TNA y CFT a la vista. Sin hostigamiento.',
  alternates: { canonical: '/directo' },
}

export default function DirectoLayout({ children }: { children: React.ReactNode }) {
  return <DirectoShell>{children}</DirectoShell>
}
