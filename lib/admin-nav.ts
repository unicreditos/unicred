export const ADMIN_TAB_IDS = [
  'overview',
  'creditos',
  'solicitudes',
  'kyc',
  'usuarios',
  'comercios',
  'scoring',
  'bcra',
  'aprobaciones',
  'cobranzas',
  'desembolsos',
  'cobros',
  'pagos',
  'comprobantes',
  'movimientos',
  'cuentas-bancarias',
  'cartera_activa',
  'analytics',
  'legales',
  'reclamos',
  'parametros',
  'tarifas',
  'staff',
  'logs_auditoria',
] as const

/** Alias histórico de "usuarios": hay enlaces que todavía apuntan acá. */
export type AdminTabId = (typeof ADMIN_TAB_IDS)[number] | 'base_clientes'

/** Rutas /admin/:section → pestaña existente (sin módulos vacíos). */
export const ADMIN_PATH_TO_TAB: Record<string, AdminTabId> = {
  dashboard: 'overview',
  overview: 'overview',
  solicitudes: 'solicitudes',
  clientes: 'usuarios',
  personas: 'usuarios',
  creditos: 'creditos',
  comercios: 'comercios',
  pagos: 'pagos',
  aprobaciones: 'aprobaciones',
  acreditar: 'aprobaciones',
  cobranzas: 'cobranzas',
  identidad: 'kyc',
  kyc: 'kyc',
  desembolsos: 'desembolsos',
  riesgo: 'scoring',
  scoring: 'scoring',
  bcra: 'bcra',
  finanzas: 'movimientos',
  movimientos: 'movimientos',
  reportes: 'analytics',
  analytics: 'analytics',
  estadisticas: 'analytics',
  comprobantes: 'comprobantes',
  productos: 'tarifas',
  tarifas: 'tarifas',
  auditoria: 'logs_auditoria',
  soporte: 'reclamos',
  reclamos: 'reclamos',
  configuracion: 'parametros',
  contratos: 'legales',
  legales: 'legales',
  cartera: 'cartera_activa',
  equipo: 'staff',
  staff: 'staff',
  operadores: 'staff',
}

export function parseAdminSection(raw?: string | null): AdminTabId {
  if (!raw) return 'overview'
  const key = raw.trim().toLowerCase()
  if (key in ADMIN_PATH_TO_TAB) return ADMIN_PATH_TO_TAB[key]
  return parseAdminTab(raw)
}

export function parseAdminTab(raw?: string | null): AdminTabId {
  if (raw === 'base_clientes') return 'usuarios'
  if (raw === 'cobros') return 'cobranzas'
  if (raw && (ADMIN_TAB_IDS as readonly string[]).includes(raw)) return raw as AdminTabId
  return 'overview'
}

export function adminUrl(tab: AdminTabId = 'overview', persona?: string | null) {
  const sp = new URLSearchParams()
  const resolved = tab === 'base_clientes' ? 'usuarios' : tab
  if (persona) {
    sp.set('tab', 'usuarios')
    sp.set('persona', persona)
  } else if (resolved !== 'overview') {
    sp.set('tab', resolved)
  }
  const query = sp.toString()
  return query ? `/admin?${query}` : '/admin'
}

export function adminLoanHref(loanId: string, status?: string | null) {
  if (status === 'pending') return `/admin/solicitudes/${loanId}`
  return `/admin/creditos/${loanId}`
}

export function adminClientHref(userId: string) {
  return `/admin/clientes/${userId}`
}

export function adminMerchantHref(merchantId: string) {
  return `/admin/comercios/${merchantId}`
}

export function adminPaymentHref(paymentId: string) {
  return `/admin/pagos/${paymentId}`
}
