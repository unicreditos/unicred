/**
 * El sitio público queda en mantenimiento mientras se revisa cada área.
 * MAINTENANCE_MODE=off lo vuelve a abrir sin otro cambio de código.
 * Si la variable no está, el mantenimiento sigue activo.
 */
export function maintenanceEnabled() {
  const flag = process.env.MAINTENANCE_MODE?.trim().toLowerCase()
  if (flag === '0' || flag === 'off' || flag === 'false') return false
  return true
}

/** Rutas que siguen vivas: ingreso, paneles, cobros, legales y webhooks. */
const OPEN_PREFIXES = [
  '/mantenimiento',
  '/sign-in',
  '/sign-up',
  '/recuperar-clave',
  '/restablecer-clave',
  '/admin',
  '/dashboard',
  '/merchant',
  '/api',
  '/pagar',
  '/legal',
  '/verification',
]

export function isOpenDuringMaintenance(pathname: string) {
  return OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
