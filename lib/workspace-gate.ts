/** Rutas donde una sesión no debe rebotar al panel. El marketing institucional sí rebota; /directo no. */

const WORKSPACE_PREFIXES = ['/dashboard', '/admin', '/merchant', '/api/', '/verification/']

const WORKSPACE_EXACT = new Set([
  '/recuperar-clave',
  '/restablecer-clave',
])

export function installmentPosPath(installmentId: string, method?: string | null) {
  const q = new URLSearchParams({ tab: 'pagos', pay: installmentId })
  if (method) q.set('method', method)
  return `/dashboard?${q.toString()}`
}

export function publicPayInstallmentId(pathname: string) {
  const match = pathname.match(/^\/pagar\/([^/]+)\/?$/)
  return match?.[1] ?? null
}

/** El canal /pedir se retiró: las URLs viejas apuntan al sitio único. */
export function legacyPedirRedirect(pathname: string): string | null {
  if (pathname !== '/pedir' && !pathname.startsWith('/pedir/')) return null
  if (pathname === '/pedir' || pathname === '/pedir/') return '/'
  if (pathname === '/pedir/solicitud' || pathname.startsWith('/pedir/solicitud/')) return '/sign-up'
  if (pathname === '/pedir/ingresar' || pathname.startsWith('/pedir/ingresar/')) return '/sign-in'
  if (pathname === '/pedir/faq' || pathname.startsWith('/pedir/faq/')) return '/contacto'
  if (pathname === '/pedir/contacto' || pathname.startsWith('/pedir/contacto/')) return '/contacto'
  if (pathname === '/pedir/ayuda' || pathname.startsWith('/pedir/ayuda/')) return '/contacto'
  if (pathname === '/pedir/cuenta' || pathname.startsWith('/pedir/cuenta/')) return '/dashboard'
  if (pathname.startsWith('/pedir/legal/terminos')) return '/legal/terminos'
  if (pathname.startsWith('/pedir/legal/privacidad')) return '/legal/privacidad'
  const pagar = pathname.match(/^\/pedir\/pagar\/([^/]+)\/?$/)
  if (pagar) return `/pagar/${pagar[1]}`
  const contrato = pathname.match(/^\/pedir\/docs\/contrato\/([^/]+)\/?$/)
  if (contrato) return `/dashboard/documentos/contrato/${contrato[1]}`
  const pagare = pathname.match(/^\/pedir\/docs\/pagare\/([^/]+)\/?$/)
  if (pagare) return `/dashboard/documentos/pagare/${pagare[1]}`
  const cuponera = pathname.match(/^\/pedir\/docs\/cuponera\/([^/]+)\/?$/)
  if (cuponera) return `/dashboard/documentos/cuponera/${cuponera[1]}`
  return '/'
}

export function isWorkspaceStayPath(pathname: string) {
  if (WORKSPACE_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))) {
    return true
  }
  if (WORKSPACE_EXACT.has(pathname) || pathname.startsWith('/restablecer-clave/')) return true
  if (pathname.startsWith('/legal/')) return true
  if (pathname === '/directo' || pathname.startsWith('/directo/')) return true
  // Productos y ayuda públicos: se pueden ver con sesión abierta (el header muestra "Mi cuenta").
  if (
    pathname === '/prestamos' ||
    pathname === '/comprar-en-cuotas' ||
    pathname === '/pagos-servicios' ||
    pathname === '/red-comercios' ||
    pathname === '/preguntas-frecuentes' ||
    pathname === '/simulador' ||
    pathname === '/scoring' ||
    pathname === '/comercios' ||
    pathname === '/datos-bcra' ||
    pathname === '/contacto' ||
    pathname === '/productos'
  ) {
    return true
  }
  return false
}

/** Sitio público / login: con sesión hay que volver al panel. */
export function shouldBounceLoggedInToWorkspace(pathname: string) {
  if (isWorkspaceStayPath(pathname)) return false
  if (publicPayInstallmentId(pathname)) return false
  return true
}

export function safeInternalPath(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  return raw
}
