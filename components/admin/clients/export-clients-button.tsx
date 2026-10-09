'use client'

import { useState } from 'react'
import { Icon } from '@/components/uc/icons'
import type { Col, GridRow } from '@/components/uc/grid-types'
import { toast } from 'sonner'

interface ExportClientsButtonProps {
  rows: GridRow[]
  columns?: Col[]
  filename?: string
  className?: string
}

const DEFAULT_CLIENT_COLUMNS: Col[] = [
  { key: 'dniRaw', label: 'DNI', kind: 'num' },
  { key: 'nombre', label: 'Nombre Completo' },
  { key: 'email', label: 'Email' },
  { key: 'tel', label: 'Teléfono' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'activos', label: 'Créditos Activos', kind: 'num' },
  { key: 'situKey', label: 'Situación de Pago' },
  { key: 'kycTxt', label: 'Estado Identidad (KYC)' },
  { key: 'alta', label: 'Fecha de Alta', kind: 'date' },
]

export function ExportClientsButton({
  rows,
  columns = DEFAULT_CLIENT_COLUMNS,
  filename = 'Reporte_Planilla_Clientes_Unicred.xlsx',
  className = '',
}: ExportClientsButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (loading) return
    try {
      setLoading(true)
      const { exportGridRowsToExcel } = await import('@/lib/uc/excel-export')
      const result = exportGridRowsToExcel(rows, columns, {
        filename,
        sheetName: 'Clientes UNICRED',
        includeTimestamp: true,
      })
      toast.success(
        `Exportación exitosa: ${result.rowCount} clientes exportados a Excel en ${result.filename}`,
      )
    } catch (error) {
      console.error('Error exporting clients to Excel:', error)
      toast.error('Ocurrió un error al generar el archivo Excel de clientes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading || rows.length === 0}
      title="Exportar todos los clientes a formato Excel (.xlsx)"
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Icon name="download" size="xs" />
      <span>{loading ? 'Generando Excel...' : 'Export to Excel'}</span>
    </button>
  )
}
