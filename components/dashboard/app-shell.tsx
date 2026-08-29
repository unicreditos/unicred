'use client'

import { WorkspaceShell, type WorkspaceNavItem } from '@/components/unicred/workspace-shell'
import { useSession } from '@/lib/auth-client'
import {
  CreditCard,
  LayoutDashboard,
  Sparkles,
  Wallet,
  WalletCards,
  Zap,
} from 'lucide-react'

export type TabValue =
  | 'overview'
  | 'perfil'
  | 'kyc_biometrico'
  | 'notificaciones'
  | 'solicitar'
  | 'mis_solicitudes'
  | 'scoring'
  | 'cuotas'
  | 'pagos'
  | 'billetera'
  | 'servicios'
  | 'comprobantes'
  | 'bancos'
  | 'documentos'
  | 'ayuda'
  | 'cuenta'
  | 'reclamos'

const TAB_VALUES: readonly TabValue[] = [
  'overview',
  'perfil',
  'kyc_biometrico',
  'notificaciones',
  'solicitar',
  'mis_solicitudes',
  'scoring',
  'cuotas',
  'pagos',
  'billetera',
  'servicios',
  'comprobantes',
  'bancos',
  'documentos',
  'ayuda',
  'cuenta',
  'reclamos',
]

export function isDashboardTab(value: string | null): value is TabValue {
  return !!value && (TAB_VALUES as readonly string[]).includes(value)
}

const NAV: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'pagos', label: 'Pagar', icon: Wallet },
  { id: 'billetera', label: 'Billetera', icon: WalletCards },
  { id: 'servicios', label: 'Servicios', icon: Zap },
  { id: 'cuotas', label: 'Créditos', icon: CreditCard },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles },
]

const MOBILE_TABS: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'pagos', label: 'Pagar', icon: Wallet },
  { id: 'billetera', label: 'Billetera', icon: WalletCards },
  { id: 'servicios', label: 'Servicios', icon: Zap },
  { id: 'cuotas', label: 'Créditos', icon: CreditCard },
]

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Tu cuenta', subtitle: 'Vencimientos, score y estado de tus préstamos' },
  pagos: { title: 'Pagar cuotas', subtitle: 'Caja de cobro: tarjetas, Mercado Pago, Payway y redes de efectivo' },
  billetera: { title: 'Billetera UNICRÉDITOS', subtitle: 'Saldo, P2P interno y egresos desde tesorería RM' },
  servicios: { title: 'Pagos y recargas', subtitle: 'Servicios, impuestos y recargas con saldo de billetera' },
  cuotas: { title: 'Mis créditos', subtitle: 'Saldos, cuotas, contrato y pagaré' },
  solicitar: { title: 'Nueva solicitud', subtitle: 'Identidad, BCRA, padrón, TNA y CFT' },
  mis_solicitudes: { title: 'Solicitudes', subtitle: 'Estado de cada trámite' },
  scoring: { title: 'Situación BCRA', subtitle: 'Consulta a Central de Deudores y score UNICRÉDITOS' },
  perfil: { title: 'Identidad', subtitle: 'CUIL, domicilio e ingresos declarados' },
  kyc_biometrico: { title: 'Biometría', subtitle: 'Verificación de identidad con Didit' },
  bancos: { title: 'Cuentas de desembolso', subtitle: 'CBU, CVU o alias para acreditar el crédito' },
  documentos: { title: 'Documentos', subtitle: 'Contrato, pagaré, cuponera, solvencia y libre deuda' },
  comprobantes: { title: 'Comprobantes', subtitle: 'Pagos y acreditaciones' },
  ayuda: { title: 'Ayuda', subtitle: 'Preguntas frecuentes y contacto' },
  notificaciones: { title: 'Actividad', subtitle: 'Vencimientos, pagos y reclamos de tu cuenta' },
  cuenta: { title: 'Configuración', subtitle: 'Clave de acceso y seguridad de la cuenta' },
  reclamos: { title: 'Reclamos', subtitle: 'Mesa de Defensa del Consumidor · Ley 24.240' },
}

interface DashboardShellProps {
  children: React.ReactNode
  activeTab: TabValue
  onTabChange: (value: TabValue) => void
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

export function DashboardShell({ children, activeTab, onTabChange, user }: DashboardShellProps) {
  const { data: session } = useSession()
  const copy = TITLES[activeTab] ?? TITLES.overview
  const resolved = {
    name: session?.user?.name ?? user?.name,
    email: session?.user?.email ?? user?.email,
    image: session?.user?.image ?? user?.image,
  }

  return (
    <WorkspaceShell
      role="customer"
      nav={NAV}
      activeId={activeTab}
      onNavigate={(id) => onTabChange(id as TabValue)}
      title={copy.title}
      subtitle={copy.subtitle}
      user={resolved}
      onProfile={() => onTabChange('perfil')}
      accountItems={[
        { label: 'Didit y biometría', onSelect: () => onTabChange('kyc_biometrico') },
        { label: 'Billetera virtual', onSelect: () => onTabChange('billetera') },
        { label: 'Pagos y recargas', onSelect: () => onTabChange('servicios') },
        { label: 'CBU / CVU de desembolso', onSelect: () => onTabChange('bancos') },
        { label: 'Contratos y pagarés', onSelect: () => onTabChange('documentos') },
        { label: 'Clave de acceso', onSelect: () => onTabChange('cuenta') },
        { label: 'Reclamos', onSelect: () => onTabChange('reclamos') },
        { label: 'Ayuda', onSelect: () => onTabChange('ayuda') },
      ]}
      mobileTabs={MOBILE_TABS}
    >
      {children}
    </WorkspaceShell>
  )
}
