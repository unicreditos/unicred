/**
 * El panel del cliente pasó de una sola pantalla con pestañas (`/dashboard?tab=…`)
 * a rutas propias. Mails, notificaciones, retornos de Mercado Pago/Didit y favoritos
 * todavía apuntan a las pestañas viejas: este mapa las lleva a su pantalla nueva.
 */
const LEGACY_TAB_ROUTE: Record<string, string> = {
  overview: '/dashboard',
  notificaciones: '/dashboard',
  billetera: '/dashboard',
  servicios: '/dashboard',
  comprobantes: '/dashboard/documentos',
  solicitar: '/dashboard/solicitar',
  scoring: '/dashboard/perfil/bcra',
  mis_solicitudes: '/dashboard/creditos',
  cuotas: '/dashboard/pagos',
  cuotas_vigentes: '/dashboard/pagos',
  cuotas_historial: '/dashboard/pagos/historial',
  pagos: '/dashboard/pagos',
  historial_pagos: '/dashboard/pagos/historial',
  perfil: '/dashboard/perfil',
  kyc_biometrico: '/dashboard/perfil/identidad',
  bancos: '/dashboard/perfil/cuentas',
  banca: '/dashboard/perfil/cuentas',
  cuenta: '/dashboard/perfil/seguridad',
  ayuda: '/dashboard/ayuda',
  reclamos: '/dashboard/ayuda',
  documentos: '/dashboard/documentos',
  documentos_arca: '/dashboard/documentos',
  documentos_bcra: '/dashboard/documentos',
  documentos_contrato: '/dashboard/documentos',
  documentos_pagare: '/dashboard/documentos',
  documentos_talonario: '/dashboard/documentos',
  documentos_certificados: '/dashboard/documentos',
}

export function legacyDashboardRoute(tab: string | null | undefined): string | null {
  if (!tab || !Object.hasOwn(LEGACY_TAB_ROUTE, tab)) return null
  return LEGACY_TAB_ROUTE[tab]
}

/** Rutas reales del panel: no se tocan aunque coincidan con un nombre de pestaña vieja. */
const PANEL_ROUTES = new Set([
  'solicitar',
  'creditos',
  'pagos',
  'documentos',
  'perfil',
  'ayuda',
  'pagar',
])

export function isPanelRoute(leaf: string) {
  return PANEL_ROUTES.has(leaf)
}
