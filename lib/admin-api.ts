import { NextResponse } from 'next/server'

export function requestMeta(req: Request) {
  const h = req.headers
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
  }
}

/** Respuesta JSON sin cache para las APIs del panel de administracion. */
export function adminJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Error de autenticacion/permisos: 401 si no hay sesion (redirect() de Next se captura aqui, no se filtra
 * como "NEXT_REDIRECT"), 403 si falta permiso o el segundo factor.
 */
export function authFailure(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest
  if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
    return adminJson({ ok: false, message: 'No autenticado' }, 401)
  }
  const msg = err instanceof Error ? err.message : ''
  const status = /venci|ingres/i.test(msg) ? 401 : 403
  return adminJson({ ok: false, message: msg || 'No autorizado' }, status)
}

/** Fallo inesperado: el detalle queda en el log del servidor y el cliente recibe un mensaje generico. */
export function serverError(err: unknown, context: string) {
  console.error(`[${context}]`, err instanceof Error ? err.message : 'error')
  return adminJson({ ok: false, message: 'Error interno. Intentá de nuevo en unos minutos.' }, 500)
}

/** Defensa extra contra CSRF en POST con cookie: si el navegador manda Origin, debe ser este mismo sitio. */
export function rejectCrossOrigin(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return null
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    if (host && new URL(origin).host === host) return null
  } catch {
    /* origen ilegible: se rechaza */
  }
  return adminJson({ ok: false, message: 'Origen no permitido' }, 403)
}