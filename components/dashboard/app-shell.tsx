'use client'

import { WorkspaceShell, type WorkspaceNavItem } from '@/components/unicred/workspace-shell'
import { useSession } from '@/lib/auth-client'
import {
  CreditCard,
  Headphones,
  LayoutDashboard,
  Sparkles,
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
  | 'cuotas_vigentes'
  | 'cuotas_historial'
  | 'pagos'
  | 'billetera'
  | 'servicios'
  | 'comprobantes'
  | 'bancos'
  | 'documentos'
  | 'documentos_contrato'
  | 'documentos_pagare'
  | 'documentos_talonario'
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
  'cuotas_vigentes',
  'cuotas_historial',
  'pagos',
  'billetera',
  'servicios',
  'comprobantes',
  'bancos',
  'documentos',
  'documentos_contrato',
  'documentos_pagare',
  'documentos_talonario',
  'ayuda',
  'cuenta',
  'reclamos',
]

export function isDashboardTab(value: string | null): value is TabValue {
  return !!value && (TAB_VALUES as readonly string[]).includes(value)
}

const CREDITOS_CHILDREN = [
  { id: 'cuotas_vigentes', label: 'Créditos vigentes' },
  { id: 'cuotas_historial', label: 'Historial' },
  { id: 'documentos', label: 'Documentaciones' },
  { id: 'documentos_contrato', label: 'Contrato' },
  { id: 'documentos_pagare', label: 'Pagaré' },
  { id: 'documentos_talonario', label: 'Talonario de pago' },
  { id: 'pagos', label: 'Pagar cuotas' },
] as const

const NAV: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles },
  { id: 'cuotas', label: 'Créditos', icon: CreditCard, children: CREDITOS_CHILDREN },
  { id: 'reclamos', label: 'Soporte', icon: Headphones },
]

const MOBILE_TABS: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'pagos', label: 'Pagar', icon: Wallet },
  { id: 'cuotas_vigentes', label: 'Créditos', icon: CreditCard },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles },
  { id: 'reclamos', label: 'Soporte', icon: Headphones },
]

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Tu cuenta', subtitle: 'Vencimientos, score y estado de tus préstamos' },
  pagos: { title: 'Pagar cuotas', subtitle: 'Pagá desde tu cuenta UNICRÉDITOS: tarjeta, Pago Fácil, Rapipago, billetera o transferencia' },
  billetera: { title: 'Billetera UNICRÉDITOS', subtitle: 'Saldo, P2P interno y egresos desde tesorería RM' },
  servicios: { title: 'Pagos de servicios', subtitle: 'Esta sección no está habilitada' },
  cuotas: { title: 'Créditos vigentes', subtitle: 'Saldos, cuotas y estado de cada préstamo' },
  cuotas_vigentes: { title: 'Créditos vigentes', subtitle: 'Préstamos activos y solicitudes en curso' },
  cuotas_historial: { title: 'Historial de créditos', subtitle: 'Créditos cancelados, rechazados o anulados' },
  solicitar: { title: 'Nueva solicitud', subtitle: 'Identidad Didit, BCRA, padrón ARCA, TNA y CFT' },
  mis_solicitudes: { title: 'Solicitudes', subtitle: 'Estado de cada trámite' },
  scoring: { title: 'Situación BCRA', subtitle: 'Consulta a Central de Deudores y score UNICRÉDITOS' },
  perfil: { title: 'Identidad', subtitle: 'CUIL, domicilio e ingresos declarados' },
  kyc_biometrico: { title: 'Biometría', subtitle: 'Verificación de identidad con Didit' },
  bancos: { title: 'Cuentas de desembolso', subtitle: 'CBU, CVU o alias validados con ArgenAPI' },
  documentos: { title: 'Documentaciones', subtitle: 'Constancia ARCA, informes BCRA y expediente del crédito' },
  documentos_contrato: { title: 'Contrato', subtitle: 'Mutuo, firma electrónica Ley 25.506 y arrepentimiento' },
  documentos_pagare: { title: 'Pagaré', subtitle: 'Pagaré a la vista vinculado al contrato aceptado' },
  documentos_talonario: { title: 'Talonario de pago', subtitle: 'Cronograma de cuotas. El cupón de red se emite al elegir el medio' },
  comprobantes: { title: 'Comprobantes', subtitle: 'Pagos y acreditaciones' },
  ayuda: { title: 'Ayuda', subtitle: 'Preguntas frecuentes y contacto' },
  notificaciones: { title: 'Actividad', subtitle: 'Vencimientos, pagos y reclamos de tu cuenta' },
  cuenta: { title: 'Configuración', subtitle: 'Clave de acceso y seguridad de la cuenta' },
  reclamos: { title: 'Soporte', subtitle: 'Chat en línea y reclamos Ley 24.240' },
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
        { label: 'Billetera UNICRÉDITOS', onSelect: () => onTabChange('billetera') },
        { label: 'CBU / CVU de desembolso', onSelect: () => onTabChange('bancos') },
        { label: 'Clave de acceso', onSelect: () => onTabChange('cuenta') },
        { label: 'Soporte y reclamos', onSelect: () => onTabChange('reclamos') },
        { label: 'Ayuda', onSelect: () => onTabChange('ayuda') },
      ]}
      mobileTabs={MOBILE_TABS}
    >
      {children}
    </WorkspaceShell>
  )
}
