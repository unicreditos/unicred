'use client'

import { type AdminTabId } from '@/lib/admin-nav'
import { WorkspaceShell, type WorkspaceNavItem } from '@/components/unicred/workspace-shell'
import {
  Activity,
  Banknote,
  Building2,
  CreditCard,
  FileClock,
  Landmark,
  LayoutDashboard,
  Percent,
  ReceiptText,
  Scale,
  Settings2,
  ShieldCheck,
  Store,
  Target,
  Users,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type { AdminTabId }

export const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, group: 'cmd' },
  { id: 'solicitudes', label: 'Solicitudes', icon: FileClock, group: 'orig' },
  { id: 'usuarios', label: 'Clientes', icon: Users, group: 'orig' },
  { id: 'creditos', label: 'Créditos', icon: CreditCard, group: 'orig' },
  { id: 'comercios', label: 'Comercios', icon: Store, group: 'orig' },
  { id: 'kyc', label: 'KYC', icon: ShieldCheck, group: 'orig' },
  { id: 'cobranzas', label: 'Mesa de cobro', icon: ReceiptText, group: 'cob' },
  { id: 'desembolsos', label: 'Desembolsos', icon: Banknote, group: 'fin' },
  { id: 'comprobantes', label: 'Comprobantes', icon: ReceiptText, group: 'fin' },
  { id: 'movimientos', label: 'Movimientos', icon: Wallet, group: 'fin' },
  { id: 'cuentas-bancarias', label: 'Cuentas', icon: Building2, group: 'fin' },
  { id: 'cartera_activa', label: 'Cartera', icon: CreditCard, group: 'fin' },
  { id: 'legales', label: 'Contratos', icon: Scale, group: 'leg' },
  { id: 'logs_auditoria', label: 'Auditoría', icon: Activity, group: 'leg' },
  { id: 'scoring', label: 'Scoring BCRA', icon: Target, group: 'riesgo' },
  { id: 'bcra', label: 'Variables BCRA', icon: Landmark, group: 'riesgo' },
  { id: 'parametros', label: 'Configuración', icon: Settings2, group: 'sys' },
  { id: 'tarifas', label: 'Tasas', icon: Percent, group: 'sys' },
] as const

const GROUP_LABEL: Record<string, string> = {
  cmd: 'Control',
  orig: 'Originación',
  cob: 'Cobranzas',
  fin: 'Contable / Finanzas',
  leg: 'Legales',
  riesgo: 'Riesgo',
  sys: 'Sistema',
}

const NAV: WorkspaceNavItem[] = NAV_ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  icon: item.icon,
  group: GROUP_LABEL[item.group],
}))

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Dashboard Ejecutivo', subtitle: 'Estado general de UNICRÉDITOS' },
  creditos: { title: 'Aprobación de créditos', subtitle: 'Pipeline de originación' },
  solicitudes: { title: 'Todas las solicitudes', subtitle: 'Historial de originación' },
  kyc: { title: 'Validación KYC', subtitle: 'Identidad y biometría pendientes' },
  usuarios: { title: 'Personas', subtitle: 'Alta, ficha, bloqueo y baja de usuarios' },
  comercios: { title: 'Red de comercios', subtitle: 'Altas y estado de adhesión' },
  base_clientes: { title: 'Personas', subtitle: 'Alta, ficha, bloqueo y baja de usuarios' },
  scoring: { title: 'Scoring BCRA', subtitle: 'Consulta a Central de Deudores' },
  bcra: { title: 'Variables BCRA', subtitle: 'Tasas y series oficiales' },
  cobranzas: { title: 'Mesa de cobranzas', subtitle: 'Mora, vencimientos, recibos y registro de cobro' },
  desembolsos: { title: 'Desembolsos', subtitle: 'Acreditación en cuenta del tomador' },
  cobros: { title: 'Transferencias a tesorería', subtitle: 'Verificar acreditación en Brubank RM' },
  comprobantes: { title: 'Comprobantes', subtitle: 'Recibos de cobro y desembolso' },
  movimientos: { title: 'Movimientos', subtitle: 'Cuenta corriente de la cartera' },
  'cuentas-bancarias': { title: 'Cuentas de desembolso', subtitle: 'CBU / CVU / alias verificados del tomador' },
  cartera_activa: { title: 'Cartera activa', subtitle: 'Capital vivo y créditos en curso' },
  legales: { title: 'Legales', subtitle: 'Contratos, pagarés y expediente' },
  parametros: { title: 'Parámetros', subtitle: 'Umbrales de aprobación y reglas' },
  tarifas: { title: 'Tasas', subtitle: 'TNA de referencia por producto' },
  logs_auditoria: { title: 'Auditoría', subtitle: 'Intervenciones manuales registradas' },
}

export function AdminAppShell({
  user,
  activeTab,
  onTabChange,
  children,
  title,
  subtitle,
}: {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
  activeTab: AdminTabId
  onTabChange: (tab: AdminTabId) => void
  children: ReactNode
  title?: string
  subtitle?: string
}) {
  const copy = TITLES[activeTab] ?? { title: 'Operaciones', subtitle: 'Back office UNICRÉDITOS' }
  const headerTitle = title ?? copy.title
  const headerSubtitle = subtitle ?? copy.subtitle

  return (
    <WorkspaceShell
      role="admin"
      nav={NAV}
      activeId={activeTab}
      onNavigate={(id) => onTabChange(id as AdminTabId)}
      title={headerTitle}
      subtitle={headerSubtitle}
      user={{
        name: user?.name,
        email: user?.email,
        image: user?.image,
      }}
      mobileTabs={[
        { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
        { id: 'cobranzas', label: 'Cobros', icon: ReceiptText },
        { id: 'creditos', label: 'Créditos', icon: CreditCard },
        { id: 'usuarios', label: 'Personas', icon: Users },
      ]}
    >
      {children}
    </WorkspaceShell>
  )
}
