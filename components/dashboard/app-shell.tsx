'use client'

import { WorkspaceShell, type WorkspaceNavItem } from '@/components/unicred/workspace-shell'
import { useSession } from '@/lib/auth-client'
import {
  Bell,
  CreditCard,
  FileText,
  FolderKanban,
  Handshake,
  Landmark,
  LayoutDashboard,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
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
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard, group: 'Cuenta' },
  { id: 'pagos', label: 'Pagar cuotas', icon: Wallet, group: 'Cuenta' },
  { id: 'cuotas', label: 'Créditos', icon: CreditCard, group: 'Crédito' },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles, group: 'Crédito' },
  { id: 'mis_solicitudes', label: 'Solicitudes', icon: FileText, group: 'Crédito' },
  { id: 'scoring', label: 'Situación BCRA', icon: Scale, group: 'Crédito' },
  { id: 'perfil', label: 'Identidad', icon: User, group: 'Datos' },
  { id: 'kyc_biometrico', label: 'Biometría', icon: ShieldCheck, group: 'Datos' },
  { id: 'bancos', label: 'Cuentas de desembolso', icon: Landmark, group: 'Datos' },
  { id: 'cuenta', label: 'Configuración', icon: Settings2, group: 'Datos' },
  { id: 'documentos', label: 'Documentos', icon: FolderKanban, group: 'Archivo' },
  { id: 'comprobantes', label: 'Comprobantes', icon: FileText, group: 'Archivo' },
  { id: 'notificaciones', label: 'Actividad', icon: Bell, group: 'Soporte' },
  { id: 'reclamos', label: 'Reclamos', icon: Scale, group: 'Soporte' },
  { id: 'ayuda', label: 'Ayuda', icon: Handshake, group: 'Soporte' },
]

const MOBILE_TABS: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'cuotas', label: 'Créditos', icon: CreditCard },
  { id: 'pagos', label: 'Pagos', icon: Wallet },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles },
]

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Tu cuenta', subtitle: 'Vencimientos, score y estado de tus préstamos' },
  pagos: { title: 'Pagar cuotas', subtitle: 'Mercado Pago, tarjetas, Pago Fácil y Rapipago' },
  cuotas: { title: 'Mis créditos', subtitle: 'Saldos, cuotas y amortización' },
  solicitar: { title: 'Nueva solicitud', subtitle: 'Simulá TNA, CFT y enviá el pedido' },
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
}

export function DashboardShell({ children, activeTab, onTabChange }: DashboardShellProps) {
  const { data: session } = useSession()
  const copy = TITLES[activeTab] ?? TITLES.overview

  return (
    <WorkspaceShell
      role="customer"
      nav={NAV}
      activeId={activeTab}
      onNavigate={(id) => onTabChange(id as TabValue)}
      title={copy.title}
      subtitle={copy.subtitle}
      user={{
        name: session?.user?.name,
        email: session?.user?.email,
        image: session?.user?.image,
      }}
      onProfile={() => onTabChange('perfil')}
      mobileTabs={MOBILE_TABS}
    >
      {children}
    </WorkspaceShell>
  )
}
