/** Reglas puras del segundo factor al iniciar sesion (sin base de datos). */
export type FactorRole = 'admin' | 'customer' | 'merchant'

/**
 * ADMIN_2FA_LOGIN=yes exige el codigo por correo a operadores; CUSTOMER_2FA_LOGIN=yes a clientes y comercios.
 * Por defecto estan apagados: se encienden DESPUES de aplicar el SQL (admin_second_factor.sessionId) y con el
 * correo transaccional configurado, porque si el correo no sale nadie podria entrar.
 */
export function secondFactorRequiredFor(role: FactorRole, env: Record<string, string | undefined> = process.env): boolean {
  const flag = role === 'admin' ? env.ADMIN_2FA_LOGIN : env.CUSTOMER_2FA_LOGIN
  return (flag ?? 'no').trim().toLowerCase() === 'yes'
}

/** Solo rutas internas relativas: evita redirecciones abiertas desde ?next=. */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n]/.test(next)) return fallback
  return next
}