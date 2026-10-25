/**
 * Número de página de la URL: entero entre 1 y un tope razonable. Cualquier otra cosa ("1.5", "abc", "-3", "1e30")
 * vale 1: una base de datos rechaza un desplazamiento fraccionario o enorme y la pantalla mostraría un error.
 */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 1 && n <= 1_000_000 ? n : 1
}
