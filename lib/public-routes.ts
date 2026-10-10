/**
 * El sitio público (home, páginas informativas, legales, ingreso, registro y 404) tiene un
 * diseño solo claro (paper/ink): no sigue el modo oscuro del sistema. Solo las áreas
 * autenticadas tienen tema claro/oscuro. Se lista lo que SÍ lo tiene, así cualquier ruta
 * nueva o inexistente queda en claro por defecto.
 */
const THEMED_APP_PREFIXES = [
  '/admin',
  '/api',
  '/cuenta',
  '/dashboard',
  '/merchant',
  '/pagar',
  '/verificar-2fa',
  '/verification',
] as const

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return !THEMED_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Misma regla para el script inline del <head>, que corre antes del primer pintado. */
export const PUBLIC_PATH_REGEX_SOURCE = `^(?!(${THEMED_APP_PREFIXES.join('|')})(/|$)).*$`
