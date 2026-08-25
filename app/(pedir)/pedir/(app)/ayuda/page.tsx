import { PedirAyudaClient } from '@/components/pedir/ayuda'
import { BRAND } from '@/lib/brand'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: `Ayuda · ${BRAND.company}`,
  description: 'Soporte dentro de la app de préstamos personales.',
  alternates: { canonical: '/pedir/ayuda' },
}

export default function PedirAyudaPage() {
  return <PedirAyudaClient />
}
