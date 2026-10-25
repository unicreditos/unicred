/**
 * CSV para planillas (Excel en español): separador ";", coma decimal, fechas dd/mm/aaaa hh:mm en hora argentina y BOM
 * UTF-8 para que se abran bien los acentos. Una sola implementación para todas las descargas.
 */
import { formatDateTime } from '@/lib/format'

export type CsvValue = string | number | boolean | Date | null | undefined

function cell(v: CsvValue): string {
  if (v == null) return ''
  let s: string
  if (v instanceof Date) s = formatDateTime(v)
  else if (typeof v === 'number') s = Number.isFinite(v) ? String(v).replace('.', ',') : ''
  else s = String(v)
  // Evita que una planilla interprete un texto como fórmula (=, @, o +/- seguidos de algo que no es un número).
  if (typeof v === 'string' && /^([=@]|[+-](?!\d[\d.,]*$))/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Importe como número con coma decimal (sin símbolo), listo para sumar en una planilla. */
export function csvAmount(v: string | number | null | undefined): string {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : ''
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

export function csvResponse(name: string, body: string) {
  const safe = name.replace(/[^\w.-]+/g, '_')
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${safe}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
