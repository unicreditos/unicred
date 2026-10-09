/**
 * Todo el sitio queda cerrado hasta el despliegue completo.
 * MAINTENANCE_MODE=off lo vuelve a abrir sin otro cambio de código.
 * Si la variable no está, el mantenimiento sigue activo.
 */
export function maintenanceEnabled() {
  return false
}

/**
 * Nadie entra al sitio. Solo queda el aviso y los avisos que Mercado Pago y
 * Didit envían solos: si se cortan, un pago o una verificación en curso se pierde.
 */
const OPEN_PREFIXES = [
  '/mantenimiento',
  '/api/webhooks/mercadopago',
  '/api/webhooks/didit',
  '/api/cron/reconcile-payments',
  '/api/cron/reconcile-kyc',
]

export function isOpenDuringMaintenance(pathname: string) {
  return OPEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
