/** Nombre sugerido al «Guardar como PDF» (el navegador usa document.title). */

export function sanitizePdfFileName(name: string): string {
  const clean = String(name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
  return clean || 'UNICREDITOS-documento'
}

/** Sin extensión: Chrome/Edge agregan `.pdf` al guardar. */
export function documentPdfBaseName(kind: string, code: string): string {
  const k = sanitizePdfFileName(kind)
  const c = sanitizePdfFileName(code)
  return sanitizePdfFileName(`UNICREDITOS-${k}-${c}`)
}

export function shortDocCode(id: string | null | undefined, prefix: string, length = 8): string {
  const raw = String(id ?? '')
    .replace(/-/g, '')
    .toUpperCase()
    .slice(0, length)
  return raw ? `${prefix}-${raw}` : prefix
}
