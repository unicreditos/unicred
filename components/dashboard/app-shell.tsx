'use client'

import { WorkspaceShell, type WorkspaceNavItem } from '@/components/unicred/workspace-shell'
import { useSession } from '@/lib/auth-client'
import {
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  Sparkles,
  UserRound,
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
  | 'historial_pagos'
  | 'billetera'
  | 'servicios'
  | 'comprobantes'
  | 'bancos'
  | 'documentos'
  | 'documentos_arca'
  | 'documentos_bcra'
  | 'documentos_contrato'
  | 'documentos_pagare'
  | 'documentos_talonario'
  | 'documentos_certificados'
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
  'historial_pagos',
  'billetera',
  'servicios',
  'comprobantes',
  'bancos',
  'documentos',
  'documentos_arca',
  'documentos_bcra',
  'documentos_contrato',
  'documentos_pagare',
  'documentos_talonario',
  'documentos_certificados',
  'ayuda',
  'cuenta',
  'reclamos',
]

export function isDashboardTab(value: string | null): value is TabValue {
  return !!value && (TAB_VALUES as readonly string[]).includes(value)
}

/**
 * Alias legacy → tab canónico.
 * Prioridad de producto: pagar → créditos → documentos del crédito.
 */
export function normalizeDashboardTab(tab: TabValue): TabValue {
  if (tab === 'cuotas') return 'cuotas_vigentes'
  if (tab === 'servicios') return 'pagos'
  return tab
}

const PAGOS_CHILDREN = [
  { id: 'pagos', label: 'Cuotas pendientes' },
  { id: 'historial_pagos', label: 'Historial de pagos' },
  { id: 'comprobantes', label: 'Comprobantes' },
  { id: 'billetera', label: 'Billetera' },
] as const

const CREDITOS_CHILDREN = [
  { id: 'cuotas_vigentes', label: 'Vigentes' },
  { id: 'mis_solicitudes', label: 'Solicitudes' },
  { id: 'cuotas_historial', label: 'Cerrados' },
] as const

const DOCS_CHILDREN = [
  { id: 'documentos', label: 'Todos los documentos' },
  { id: 'documentos_contrato', label: 'Contrato' },
  { id: 'documentos_pagare', label: 'Pagaré' },
  { id: 'documentos_talonario', label: 'Talonario' },
  { id: 'documentos_certificados', label: 'Certificados' },
  { id: 'documentos_arca', label: 'Constancia ARCA' },
  { id: 'documentos_bcra', label: 'Informes BCRA' },
  { id: 'scoring', label: 'Score en vivo' },
] as const

const SOPORTE_CHILDREN = [
  { id: 'reclamos', label: 'Chat y reclamos' },
  { id: 'ayuda', label: 'Preguntas frecuentes' },
] as const

const CUENTA_CHILDREN = [
  { id: 'perfil', label: 'Identidad' },
  { id: 'kyc_biometrico', label: 'Didit y biometría' },
  { id: 'bancos', label: 'CBU / CVU desembolso' },
  { id: 'cuenta', label: 'Clave de acceso' },
  { id: 'notificaciones', label: 'Actividad' },
] as const

/** Orden mental del cliente: ¿qué debo hacer ahora? → pagar → mis créditos → pedir → papeles → ayuda → cuenta */
const NAV: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'pagos', label: 'Pagar', icon: Wallet, children: PAGOS_CHILDREN },
  { id: 'cuotas_vigentes', label: 'Mis créditos', icon: CreditCard, children: CREDITOS_CHILDREN },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles },
  { id: 'documentos', label: 'Documentos', icon: FileText, children: DOCS_CHILDREN },
  { id: 'reclamos', label: 'Soporte', icon: Headphones, children: SOPORTE_CHILDREN },
  { id: 'perfil', label: 'Mi cuenta', icon: UserRound, children: CUENTA_CHILDREN },
]

/** Bottom bar: 4 acciones + “Más”. Prioridad: pagar y créditos. */
const MOBILE_TABS: WorkspaceNavItem[] = [
  { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
  { id: 'pagos', label: 'Pagar', icon: Wallet },
  { id: 'cuotas_vigentes', label: 'Créditos', icon: CreditCard },
  { id: 'solicitar', label: 'Solicitar', icon: Sparkles },
]

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Inicio', subtitle: 'Tu próxima acción y el estado de la cuenta' },
  pagos: { title: 'Pagar cuotas', subtitle: 'Solo lo pendiente · elegí y confirmá el medio' },
  historial_pagos: { title: 'Historial de pagos', subtitle: 'Movimientos registrados en tu cuenta' },
  comprobantes: { title: 'Comprobantes', subtitle: 'Recibos de pago y liquidaciones de desembolso' },
  billetera: { title: 'Billetera', subtitle: 'Saldo, CVU y transferencias UNICRÉDITOS' },
  servicios: { title: 'Pagar cuotas', subtitle: 'Redirigido a cuotas pendientes' },
  cuotas: { title: 'Mis créditos', subtitle: 'Préstamos activos' },
  cuotas_vigentes: { title: 'Créditos vigentes', subtitle: 'Saldos, cuotas y cancelación' },
  cuotas_historial: { title: 'Créditos cerrados', subtitle: 'Cancelados, rechazados o anulados' },
  mis_solicitudes: { title: 'Solicitudes', subtitle: 'Estado de cada trámite' },
  solicitar: { title: 'Solicitar crédito', subtitle: 'Simulá, evaluá y pedí tu préstamo' },
  scoring: { title: 'Score BCRA', subtitle: 'Central de Deudores y score UNICRÉDITOS' },
  documentos: { title: 'Documentos', subtitle: 'Contrato, pagaré, certificados e informes' },
  documentos_arca: { title: 'Constancia ARCA', subtitle: 'Identidad fiscal del padrón' },
  documentos_bcra: { title: 'Informes BCRA', subtitle: 'Central de Deudores' },
  documentos_contrato: { title: 'Contrato', subtitle: 'Mutuo y firma electrónica' },
  documentos_pagare: { title: 'Pagaré', subtitle: 'Vinculado al contrato aceptado' },
  documentos_talonario: { title: 'Talonario', subtitle: 'Cronograma de cuotas' },
  documentos_certificados: {
    title: 'Certificados',
    subtitle: 'Solvencia, libre deuda, cancelación y estado de deuda',
  },
  perfil: { title: 'Identidad', subtitle: 'CUIL, domicilio e ingresos' },
  kyc_biometrico: { title: 'Didit', subtitle: 'Verificación biométrica de identidad' },
  bancos: { title: 'Cuenta de desembolso', subtitle: 'CBU, CVU o alias' },
  cuenta: { title: 'Clave de acceso', subtitle: 'Seguridad de tu cuenta' },
  notificaciones: { title: 'Actividad', subtitle: 'Vencimientos, pagos y reclamos' },
  ayuda: { title: 'Ayuda', subtitle: 'Preguntas frecuentes' },
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
  const canonical = normalizeDashboardTab(activeTab)
  const copy = TITLES[canonical] ?? TITLES.overview
  const resolved = {
    name: session?.user?.name ?? user?.name,
    email: session?.user?.email ?? user?.email,
    image: session?.user?.image ?? user?.image,
  }

  return (
    <WorkspaceShell
      role="customer"
      nav={NAV}
      activeId={canonical}
      onNavigate={(id) => onTabChange(normalizeDashboardTab(id as TabValue))}
      title={copy.title}
      subtitle={copy.subtitle}
      user={resolved}
      onProfile={() => onTabChange('perfil')}
      accountItems={[
        { label: 'Didit y biometría', onSelect: () => onTabChange('kyc_biometrico') },
        { label: 'CBU / CVU de desembolso', onSelect: () => onTabChange('bancos') },
        { label: 'Clave de acceso', onSelect: () => onTabChange('cuenta') },
        { label: 'Actividad', onSelect: () => onTabChange('notificaciones') },
        { label: 'Soporte', onSelect: () => onTabChange('reclamos') },
        { label: 'Ayuda', onSelect: () => onTabChange('ayuda') },
      ]}
      mobileTabs={MOBILE_TABS}
    >
      {children}
    </WorkspaceShell>
  )
}
