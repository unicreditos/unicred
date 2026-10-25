/**
 * Texto de búsqueda de los listados de administración: sin caracteres de control (un byte nulo hace fallar la
 * consulta en Postgres y la pantalla muestra "Algo salió mal"), con espacios normalizados y largo acotado.
 */
export function cleanSearch(q: string | null | undefined, max = 80): string {
  return String(q ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
