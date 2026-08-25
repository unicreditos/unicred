import { CANONICAL_HOST, shouldRedirectHost } from '@/lib/site'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const DASHBOARD_TABS = new Set([
  'overview',
  'perfil',
  'kyc_biometrico',
  'notificaciones',
  'solicitar',
  'mis_solicitudes',
  'scoring',
  'cuotas',
  'pagos',
  'comprobantes',
  'bancos',
  'documentos',
  'ayuda',
  'cuenta',
  'reclamos',
])

const DASHBOARD_TAB_ALIASES: Record<string, string> = {
  banca: 'bancos',
}

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/merchant', '/pedir/cuenta', '/pedir/docs']

function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes('session_token') || cookie.name.includes('better-auth.session'),
    )
}

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? ''
  if (process.env.NODE_ENV === 'production' && shouldRedirectHost(host)) {
    const url = request.nextUrl.clone()
    url.protocol = 'https'
    url.hostname = CANONICAL_HOST
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  const { pathname } = request.nextUrl

  const dashboardLeaf = pathname.match(/^\/dashboard\/([^/]+)\/?$/)
  if (dashboardLeaf) {
    const leaf = DASHBOARD_TAB_ALIASES[dashboardLeaf[1]] ?? dashboardLeaf[1]
    if (DASHBOARD_TABS.has(leaf)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.searchParams.set('tab', leaf)
      return NextResponse.redirect(url)
    }
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (needsAuth && !hasSessionCookie(request)) {
    const url = request.nextUrl.clone()
    if (pathname.startsWith('/pedir/')) {
      url.pathname = '/pedir/ingresar'
      url.searchParams.set('callbackUrl', pathname)
    } else {
      url.pathname = '/sign-in'
      url.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\..*).*)'],
}
