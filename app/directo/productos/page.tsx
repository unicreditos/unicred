import { DirectoProductos } from '@/directo/productos-view'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Productos',
  description:
    'Préstamo personal, crédito comercial y consumo. Catálogo UNICRÉDITOS con TNA y CFT. Solicitud en línea.',
  alternates: { canonical: '/directo/productos' },
}

export default function DirectoProductosPage() {
  return <DirectoProductos />
}
