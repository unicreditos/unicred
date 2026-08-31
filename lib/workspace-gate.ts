/** Rutas donde una sesión no debe rebotar al panel. Home y crédito público se ven con sesión; /directo también. */

const WORKSPACE_PREFIXES = ['/dashboard', '/admin', '/merchant', '/api/', '/verification/']

const WORKSPACE_EXACT = new Set([
  '/recuperar-clave',
  '/restablecer-clave',
])

/** Login/alta: el proxy no puede validar la sesión, solo ve el nombre de cookie. */
const AUTH_ENTRY_PATHS = new Set(['/sign-in', '/sign-up'])

export function isAuthEntryPath(pathname: string) {
  return (
    AUTH_ENTRY_PATHS.has(pathname) ||
    pathname.startsWith('/sign-in/') ||
    pathname.startsWith('/sign-up/')
  )
}

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
  if (contrato) return `/dashboard?tab=documentos_contrato&doc=contrato&docId=${contrato[1]}`
  const pagare = pathname.match(/^\/pedir\/docs\/pagare\/([^/]+)\/?$/)
  if (pagare) return `/dashboard?tab=documentos_pagare&doc=pagare&docId=${pagare[1]}`
  const cuponera = pathname.match(/^\/pedir\/docs\/cuponera\/([^/]+)\/?$/)
  if (cuponera) return `/dashboard?tab=documentos_talonario&doc=talonario&docId=${cuponera[1]}`
  return '/'
}

export function isWorkspaceStayPath(pathname: string) {
  if (pathname === '/') return true
  if (WORKSPACE_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))) {
    return true
  }
  if (isAuthEntryPath(pathname)) return true
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

/** Login, alta, home y páginas de crédito: no rebotar al panel. */
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
