/** Rutas del panel autenticado. Con sesión, el sitio de marketing queda afuera. */

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
  const match = pathname.match(/^\/(?:pedir\/)?pagar\/([^/]+)\/?$/)
  return match?.[1] ?? null
}

export function isWorkspaceStayPath(pathname: string) {
  if (WORKSPACE_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))) {
    return true
  }
  if (WORKSPACE_EXACT.has(pathname) || pathname.startsWith('/restablecer-clave/')) return true
  if (pathname.startsWith('/legal/')) return true
  if (pathname.startsWith('/pedir/legal/')) return true
  if (pathname.startsWith('/pedir/docs/')) return true
  if (pathname === '/pedir/cuenta' || pathname.startsWith('/pedir/cuenta/')) return true
  if (pathname === '/pedir/solicitud' || pathname.startsWith('/pedir/solicitud/')) return true
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
