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

export function authErrorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : ''
  if (/venci|ingres/i.test(msg)) return 401
  return 403
}