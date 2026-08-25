/**
 * Exportación a CSV para las tablas operativas del back office.
 * Usa punto y coma como separador y BOM UTF-8 porque el destino real de estos
 * archivos es Excel en español, que con coma parte mal las columnas y sin BOM
 * rompe los acentos.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(';')]
  for (const row of rows) lines.push(row.map(escapeCell).join(';'))
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Sufijo de fecha para los nombres de archivo, en formato AAAA-MM-DD. */
export function csvDateSuffix(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}
