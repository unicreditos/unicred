import { CANONICAL_HOST, shouldRedirectHost } from '@/lib/site'
import { loggedInSignupBouncePath } from '@/lib/loan-intent'
import { customerDashboardDocUrl, parsePrintDocumentPath } from '@/lib/documents/customer-view'
import { isPanelRoute, legacyDashboardRoute } from '@/lib/dashboard-routes'
import {
  installmentPosPath,
  legacyPedirRedirect,
  publicPayInstallmentId,
  safeInternalPath,
  shouldBounceLoggedInToWorkspace,
} from '@/lib/workspace-gate'
import { isOpenDuringMaintenance, maintenanceEnabled } from '@/lib/maintenance'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/merchant']

function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        Boolean(cookie.value?.trim()) &&
        (cookie.name.includes('session_token') || cookie.name.includes('better-auth.session')),
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

  const fromPedir = legacyPedirRedirect(pathname)
  if (fromPedir) {
    const url = request.nextUrl.clone()
    const dest = new URL(fromPedir, url)
    url.pathname = dest.pathname
    url.search = dest.search
    return NextResponse.redirect(url, 308)
  }

  const printed = parsePrintDocumentPath(pathname)
  if (printed) {
    const embed = request.nextUrl.searchParams.get('embed') === '1'
    const print = request.nextUrl.searchParams.get('print') === '1'
    const referer = request.headers.get('referer') ?? ''
    const fromAdmin = referer.includes('/admin')
    if (!embed && !print && !fromAdmin) {
      const url = request.nextUrl.clone()
      const dest = new URL(customerDashboardDocUrl(printed.kind, printed.id), url)
      url.pathname = dest.pathname
      url.search = dest.search
      return NextResponse.redirect(url)
    }
  }

  // Pestañas viejas (/dashboard?tab=pagos, /dashboard/cuotas_vigentes…) → pantalla nueva.
  if (pathname === '/dashboard') {
    const target = legacyDashboardRoute(request.nextUrl.searchParams.get('tab'))
    if (target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      url.searchParams.delete('tab')
      return NextResponse.redirect(url)
    }
  }
  const dashboardLeaf = pathname.match(/^\/dashboard\/([^/]+)\/?$/)
  if (dashboardLeaf && !isPanelRoute(dashboardLeaf[1])) {
    const target = legacyDashboardRoute(dashboardLeaf[1])
    if (target && target !== pathname) {
      const url = request.nextUrl.clone()
      url.pathname = target
      return NextResponse.redirect(url)
    }
  }

  if (maintenanceEnabled() && !isOpenDuringMaintenance(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/mantenimiento'
    url.search = ''
    return NextResponse.rewrite(url, {
      status: 503,
      headers: { 'Retry-After': '86400' },
    })
  }

  const authed = hasSessionCookie(request)

  if (authed) {
    const payId = publicPayInstallmentId(pathname)
    if (payId && !request.nextUrl.searchParams.has('t')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      const dest = new URL(installmentPosPath(payId), url)
      url.search = dest.search
      return NextResponse.redirect(url)
    }
    if (shouldBounceLoggedInToWorkspace(pathname)) {
      const next = safeInternalPath(
        request.nextUrl.searchParams.get('next') || request.nextUrl.searchParams.get('callbackUrl'),
      )
      const url = request.nextUrl.clone()
      if (next) {
        const dest = new URL(next, url)
        url.pathname = dest.pathname
        url.search = dest.search
        return NextResponse.redirect(url)
      }
      const fromIntent = loggedInSignupBouncePath(pathname, request.nextUrl.searchParams)
      if (fromIntent) {
        const dest = new URL(fromIntent, url)
        url.pathname = dest.pathname
        url.search = dest.search
        return NextResponse.redirect(url)
      }
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (needsAuth && !authed) {
    const url = request.nextUrl.clone()
    const intended = `${pathname}${request.nextUrl.search}`
    url.search = ''
    url.pathname = '/sign-in'
    url.searchParams.set('next', intended)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\..*).*)'],
}
