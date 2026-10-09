import * as XLSX from 'xlsx'
import type { Cell, Col, GridRow } from '@/components/uc/grid-types'
import { fdate, fdatetime } from '@/lib/uc/format'

const isObj = (c: Cell): c is Exclude<Cell, string | number | null | undefined | unknown[]> =>
  typeof c === 'object' && c !== null && !Array.isArray(c)

function cellToExcelValue(col: Col, rawValue: Cell): string | number | null {
  if (rawValue == null || rawValue === '') return null
  if (Array.isArray(rawValue)) return null

  // Link format { text: '...', href: '...' }
  if (isObj(rawValue) && 'text' in rawValue) {
    return rawValue.text
  }

  // Badge format { l: '...', t: '...' }
  if (isObj(rawValue) && 'l' in rawValue) {
    return rawValue.l
  }

  // Stack format { a: '...', b: '...' }
  if (isObj(rawValue) && 'a' in rawValue) {
    return rawValue.b ? `${rawValue.a} (${rawValue.b})` : rawValue.a
  }

  switch (col.kind) {
    case 'money':
      return typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0
    case 'num':
      return typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0
    case 'pct':
      return typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0
    case 'date':
      return rawValue ? fdate(String(rawValue)) : null
    case 'datetime':
      return rawValue ? fdatetime(String(rawValue)) : null
    default:
      return String(rawValue)
  }
}

export interface ExcelExportOptions {
  filename?: string
  sheetName?: string
  includeTimestamp?: boolean
}

/**
 * Convierte un arreglo de filas y columnas de DataGrid en un archivo Excel (.xlsx) y descarga en el navegador.
 */
export function exportGridRowsToExcel(
  rows: GridRow[],
  columns: Col[],
  options: ExcelExportOptions = {},
): { success: boolean; rowCount: number; filename: string } {
  const exportableColumns = columns.filter((c) => c.kind !== 'actions')

  const data = rows.map((row, index) => {
    const item: Record<string, string | number | null> = {
      '#': index + 1,
    }

    for (const col of exportableColumns) {
      const val = cellToExcelValue(col, row[col.key] as Cell)
      item[col.label || col.key] = val
    }

    return item
  })

  // Crear la hoja de cálculo
  const worksheet = XLSX.utils.json_to_sheet(data)

  // Ajustar anchos automáticos de columna
  const colWidths = [
    { wch: 5 }, // Columna '#'
    ...exportableColumns.map((col) => {
      const labelLen = (col.label || col.key).length
      const maxDataLen = Math.max(
        ...rows.slice(0, 50).map((r) => {
          const v = cellToExcelValue(col, r[col.key] as Cell)
          return v != null ? String(v).length : 0
        }),
        labelLen,
      )
      return { wch: Math.min(Math.max(maxDataLen + 3, 12), 40) }
    }),
  ]
  worksheet['!cols'] = colWidths

  // Crear el libro de trabajo
  const workbook = XLSX.utils.book_new()
  const sheetName = (options.sheetName || 'Planilla').slice(0, 31)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Nombre de archivo con fecha y hora si se requiere
  let filename = options.filename || 'Reporte_Planilla.xlsx'
  if (!filename.endsWith('.xlsx')) filename += '.xlsx'

  if (options.includeTimestamp) {
    const dateStamp = new Date().toISOString().slice(0, 10)
    filename = filename.replace(/\.xlsx$/i, `_${dateStamp}.xlsx`)
  }

  // Descarga directa en el navegador
  XLSX.writeFile(workbook, filename)

  return {
    success: true,
    rowCount: rows.length,
    filename,
  }
}
