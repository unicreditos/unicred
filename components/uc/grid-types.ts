import type { DeskMutateAction } from '@/lib/admin-desk/mutate'
import type { IconName } from '@/components/uc/icons'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Acción de fila que cambia datos del backoffice (pasa por un diálogo de confirmación). */
export type DeskRowAction = {
  kind: 'desk'
  label: string
  icon?: IconName
  action: DeskMutateAction
  payload: Record<string, unknown>
  /** Título y subtítulo del diálogo. */
  title: string
  sub?: string
  /** Resumen de datos que se muestra en el diálogo. */
  summary?: Array<[string, string]>
  warning?: string
  confirmLabel: string
  success: string
  field?: { name: string; label: string; required?: boolean; placeholder?: string; minLength?: number }
  choice?: { name: string; label: string; options: Array<{ value: string; label: string }> }
  danger?: boolean
}

export type LinkRowAction = { kind: 'link'; label: string; href: string; icon?: IconName }
export type RowAction = DeskRowAction | LinkRowAction

export type Cell =
  | string
  | number
  | null
  | undefined
  | { l: string; t: Tone } // badge
  | { a: string; b?: string } // dos líneas
  | { text: string; href: string } // enlace
  | RowAction[] // acciones

export type ColKind = 'text' | 'num' | 'money' | 'pct' | 'date' | 'datetime' | 'badge' | 'stack' | 'link' | 'actions'

export type Col = {
  key: string
  label: string
  kind?: ColKind
  align?: 'r' | 'c'
  /** Importes destacados (negrita). */
  amount?: boolean
  muted?: boolean
  sortable?: boolean
  /** Para columnas "badge": orden lógico al ordenar (si no, alfabético). */
  order?: string[]
}

export type GridRow = { id: string } & Record<string, Cell | boolean>

export type GridConfig = {
  /** Identifica la tabla (para el scroll y los atributos de accesibilidad). */
  id: string
  columns: Col[]
  rows: GridRow[]
  pageSize?: number
  sort?: { key: string; dir: 1 | -1 }
  searchPlaceholder?: string
  /** Campos (por clave) sobre los que busca el cuadro de búsqueda. */
  searchKeys?: string[]
  chips?: {
    label: string
    /** Campo de la fila con el valor a comparar. */
    key: string
    options: Array<{ v: string; l: string; in?: string[] }>
  }
  /** Filtro por rango de importe (minimo/maximo) sobre este campo numerico de la fila. */
  amountKey?: string
  amountLabel?: string
  /** Muestra "Exportar CSV" (filas filtradas) y fija el nombre del archivo. */
  exportName?: string
  dateKey?: string
  dateLabel?: string
  selects?: Array<{ key: string; label: string; all: string; options?: string[] }>
  /** Planilla: numera las filas y compacta la tabla. */
  sheet?: boolean
  toolbar?: boolean
  summary?: { noun: string; sumKey?: string; sumLabel?: string }
  empty?: string
  /** Habilita botón para exportar registros a Excel (.xlsx). */
  exportExcel?: boolean | { filename?: string; label?: string; sheetName?: string }
  /** Habilita botón para imprimir el reporte actual con window.print(). */
  printable?: boolean | { label?: string; title?: string }
}
