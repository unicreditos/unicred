import type { Metadata } from 'next'
import { Suspense } from 'react'
import '../../uc.css'
import { UcShell, type BottomItem, type MenuItem } from '@/components/uc/shell'
import { loadCustomerShell } from '@/lib/customer/load'
import { longDate } from '@/lib/uc/format'

export const metadata: Metadata = {
  title: { default: 'Mi cuenta', template: '%s · Mi cuenta Unicréditos' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const MENU: MenuItem[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home', route: '/dashboard' },
  { id: 'creditos', label: 'Mis créditos', icon: 'credit', route: '/dashboard/creditos' },
  {
    id: 'pagos',
    label: 'Pagos',
    icon: 'wallet',
    children: [
      { label: 'Pagar una cuota', route: '/dashboard/pagos' },
      { label: 'Calculadora pago parcial', route: '/dashboard/pagos/pago-parcial' },
      { label: 'Historial de pagos', route: '/dashboard/pagos/historial' },
    ],
  },
  {
    id: 'billetera',
    label: 'Billetera',
    icon: 'wallet',
    children: [
      { label: 'Mi billetera', route: '/dashboard/billetera' },
      { label: 'Transferir', route: '/dashboard/billetera/transferir' },
      { label: 'Cobrar con QR', route: '/dashboard/billetera/qr' },
      { label: 'Pagar con QR', route: '/dashboard/billetera/pagar' },
      { label: 'Retirar', route: '/dashboard/billetera/retirar' },
      { label: 'Movimientos', route: '/dashboard/billetera/movimientos' },
      { label: 'Cuentas bancarias', route: '/dashboard/billetera/cuentas' },
      { label: 'Comercios adheridos', route: '/dashboard/billetera/comercios' },
    ],
  },
  { id: 'solicitar', label: 'Solicitar crédito', icon: 'plus', route: '/dashboard/solicitar' },
  { id: 'documentos', label: 'Documentos', icon: 'file', route: '/dashboard/documentos' },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: 'user',
    children: [
      { label: 'Datos personales', route: '/dashboard/perfil' },
      { label: 'Identidad', route: '/dashboard/perfil/identidad' },
      { label: 'Cuentas para cobrar', route: '/dashboard/perfil/cuentas' },
      { label: 'Informe BCRA', route: '/dashboard/perfil/bcra' },
      { label: 'Seguridad', route: '/dashboard/perfil/seguridad' },
      { label: 'Verificación en dos pasos', route: '/cuenta/seguridad' },
    ],
  },
  {
    id: 'ayuda',
    label: 'Ayuda',
    icon: 'help',
    children: [
      { label: 'Reclamos y consultas', route: '/dashboard/ayuda' },
      { label: 'Preguntas frecuentes', route: '/dashboard/ayuda/preguntas' },
      { label: 'Contacto', route: '/dashboard/ayuda/contacto' },
    ],
  },
]

const BOTTOM: BottomItem[] = [
  { route: '/dashboard', label: 'Inicio', icon: 'home', match: '^/dashboard$' },
  { route: '/dashboard/creditos', label: 'Créditos', icon: 'credit' },
  { route: '/dashboard/pagos', label: 'Pagos', icon: 'wallet' },
  { route: '/dashboard/documentos', label: 'Documentos', icon: 'file' },
  { label: 'Más', icon: 'more' },
]

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await loadCustomerShell()
  return (
    <UcShell
      menu={MENU}
      bottomNav={BOTTOM}
      area="Mi cuenta"
      today={longDate()}
      user={{ name: user.name, detail: 'Cliente', email: user.email }}
      homeHref="/dashboard"
    >
      <Suspense fallback={<p className="uc-muted">Cargando…</p>}>{children}</Suspense>
    </UcShell>
  )
}
