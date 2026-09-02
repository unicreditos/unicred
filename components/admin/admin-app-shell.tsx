'use client'

import { type AdminTabId } from '@/lib/admin-nav'
import { WorkspaceShell, type WorkspaceNavItem } from '@/components/unicred/workspace-shell'
import {
  BadgeCheck,
  Banknote,
  BarChart3,
  ClipboardList,
  CreditCard,
  Headphones,
  Landmark,
  LayoutDashboard,
  Percent,
  ReceiptText,
  Scale,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type { AdminTabId }

export type AdminNavCounts = {
  pendingLoans?: number
  pendingKyc?: number
  overdue?: number
  pendingDisb?: number
  pendingMerchants?: number
  pendingApprovals?: number
}

/**
 * Navegación del backoffice, agrupada por área de negocio.
 * Cada grupo es un módulo con una responsabilidad clara; los grupos
 * son colapsables (estado por usuario) para no saturar el sidebar.
 */
export function buildAdminNav(counts: AdminNavCounts = {}): WorkspaceNavItem[] {
  return [
    // Control — visión general y métricas
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, group: 'Control' },
    { id: 'analytics', label: 'Analítica', icon: BarChart3, group: 'Control' },

    // Originación — desde la solicitud hasta el alta del cliente/comercio
    { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList, group: 'Originación' },
    { id: 'creditos', label: 'Créditos', icon: CreditCard, group: 'Originación', count: counts.pendingLoans },
    { id: 'usuarios', label: 'Clientes', icon: Users, group: 'Originación' },
    { id: 'kyc', label: 'Identidad', icon: ShieldCheck, group: 'Originación', count: counts.pendingKyc },
    { id: 'comercios', label: 'Comercios', icon: Store, group: 'Originación', count: counts.pendingMerchants },

    // Cobranzas y tesorería — dinero que entra y sale de la cartera
    { id: 'aprobaciones', label: 'Aprobaciones', icon: BadgeCheck, group: 'Cobranzas y tesorería', count: counts.pendingApprovals },
    { id: 'cobranzas', label: 'Cobranzas', icon: ReceiptText, group: 'Cobranzas y tesorería', count: counts.overdue },
    { id: 'pagos', label: 'Pagos', icon: Wallet, group: 'Cobranzas y tesorería' },
    { id: 'desembolsos', label: 'Desembolsos', icon: Banknote, group: 'Cobranzas y tesorería', count: counts.pendingDisb },
    { id: 'cartera_activa', label: 'Cartera activa', icon: CreditCard, group: 'Cobranzas y tesorería' },
    { id: 'comprobantes', label: 'Comprobantes', icon: ReceiptText, group: 'Cobranzas y tesorería' },
    { id: 'movimientos', label: 'Finanzas', icon: Landmark, group: 'Cobranzas y tesorería' },
    { id: 'cuentas-bancarias', label: 'Cuentas CBU', icon: Landmark, group: 'Cobranzas y tesorería' },

    // Riesgo — evaluación crediticia y datos BCRA
    { id: 'scoring', label: 'Riesgo / CENDEU', icon: ShieldAlert, group: 'Riesgo' },
    { id: 'bcra', label: 'Variables BCRA', icon: ShieldAlert, group: 'Riesgo' },

    // Sistema — legal, soporte, auditoría y configuración
    { id: 'legales', label: 'Contratos', icon: Scale, group: 'Sistema' },
    { id: 'reclamos', label: 'Soporte', icon: Headphones, group: 'Sistema' },
    { id: 'logs_auditoria', label: 'Auditoría', icon: ShieldCheck, group: 'Sistema' },
    { id: 'tarifas', label: 'Productos', icon: Percent, group: 'Sistema' },
    { id: 'staff', label: 'Operadores', icon: UserCog, group: 'Sistema' },
    { id: 'parametros', label: 'Configuración', icon: Settings2, group: 'Sistema' },
  ]
}

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Torre de control', subtitle: 'Cartera, originación, mora y cola operativa' },
  creditos: { title: 'Aprobación de créditos', subtitle: 'Pipeline de originación' },
  solicitudes: { title: 'Todas las solicitudes', subtitle: 'Historial de originación' },
  kyc: { title: 'Identidad', subtitle: 'Didit y biometría pendientes' },
  usuarios: { title: 'Clientes', subtitle: 'Alta, ficha, bloqueo y baja' },
  comercios: { title: 'Red de comercios', subtitle: 'Altas y estado de adhesión' },
  base_clientes: { title: 'Clientes', subtitle: 'Alta, ficha, bloqueo y baja' },
  scoring: { title: 'Riesgo / CENDEU', subtitle: 'Consulta a Central de Deudores' },
  bcra: { title: 'Variables BCRA', subtitle: 'Tasas y series oficiales' },
  aprobaciones: { title: 'Aprobaciones', subtitle: 'Acreditar transferencias a cuenta y desembolsos pendientes' },
  cobranzas: { title: 'Cobranzas', subtitle: 'Mora, vencimientos y registro de cobro' },
  desembolsos: { title: 'Desembolsos', subtitle: 'Acreditación en cuenta del tomador' },
  cobros: { title: 'Transferencias a tesorería', subtitle: 'Verificar acreditación' },
  pagos: { title: 'Pagos', subtitle: 'Centro transaccional · cuotas, links y pasarela' },
  comprobantes: { title: 'Comprobantes', subtitle: 'Recibos de cobro, desembolso y FE ARCA' },
  movimientos: { title: 'Finanzas', subtitle: 'Cuenta corriente de la cartera' },
  'cuentas-bancarias': { title: 'Cuentas de desembolso', subtitle: 'CBU / CVU / alias del tomador' },
  cartera_activa: { title: 'Cartera activa', subtitle: 'Capital vivo y créditos en curso' },
  analytics: { title: 'Analítica', subtitle: 'Conversión, ticket y mora sobre la cartera real' },
  legales: { title: 'Contratos', subtitle: 'Contratos, pagarés y expediente' },
  reclamos: { title: 'Soporte', subtitle: 'Chat en línea · reclamos Ley 24.240' },
  parametros: { title: 'Configuración', subtitle: 'Productos, tasas y umbrales del motor' },
  tarifas: { title: 'Productos y tasas', subtitle: 'TNA publicada y CFT de referencia' },
  staff: { title: 'Operadores', subtitle: 'Cuentas admin de esta instancia' },
  logs_auditoria: { title: 'Auditoría', subtitle: 'Intervenciones registradas · no se borran desde acá' },
}

export function AdminAppShell({
  user,
  activeTab,
  onTabChange,
  children,
  title,
  subtitle,
  counts,
  onSearchRequest,
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
  counts?: AdminNavCounts
  onSearchRequest?: () => void
}) {
  const copy = TITLES[activeTab] ?? { title: 'Operaciones', subtitle: 'Backoffice UNICRÉDITOS' }
  const nav = buildAdminNav(counts)

  return (
    <WorkspaceShell
      role="admin"
      nav={nav}
      activeId={activeTab}
      onNavigate={(id) => onTabChange(id as AdminTabId)}
      title={title ?? copy.title}
      subtitle={subtitle ?? copy.subtitle}
      onSearchRequest={onSearchRequest}
      user={{
        name: user?.name,
        email: user?.email,
        image: user?.image,
      }}
      mobileTabs={[
        { id: 'overview', label: 'Inicio', icon: LayoutDashboard },
        { id: 'cobranzas', label: 'Cobros', icon: ReceiptText },
        { id: 'creditos', label: 'Créditos', icon: CreditCard },
        { id: 'usuarios', label: 'Clientes', icon: Users },
      ]}
    >
      {children}
    </WorkspaceShell>
  )
}
