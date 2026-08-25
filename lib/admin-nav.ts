export const ADMIN_TAB_IDS = [
  'overview',
  'creditos',
  'solicitudes',
  'kyc',
  'usuarios',
  'comercios',
  'scoring',
  'bcra',
  'cobranzas',
  'desembolsos',
  'cobros',
  'comprobantes',
  'movimientos',
  'cuentas-bancarias',
  'cartera_activa',
  'legales',
  'reclamos',
  'parametros',
  'tarifas',
  'logs_auditoria',
] as const

/** Alias histórico de "usuarios": hay enlaces que todavía apuntan acá. */
export type AdminTabId = (typeof ADMIN_TAB_IDS)[number] | 'base_clientes'

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
