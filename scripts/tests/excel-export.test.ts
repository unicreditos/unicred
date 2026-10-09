import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import type { Col, GridRow } from '@/components/uc/grid-types'

test('XLSX converts grid data and generates valid sheet', () => {
  const columns: Col[] = [
    { key: 'dniRaw', label: 'DNI', kind: 'num' },
    { key: 'nombre', label: 'Nombre Completo' },
    { key: 'email', label: 'Email' },
    { key: 'activos', label: 'Créditos Activos', kind: 'num' },
    { key: 'situKey', label: 'Situación' },
    { key: 'actions', label: 'Acción', kind: 'actions' },
  ]

  const rows: GridRow[] = [
    {
      id: 'c1',
      dniRaw: '35123456',
      nombre: 'Juan Pérez',
      email: 'juan@example.com',
      activos: 2,
      situKey: 'Al día',
      actions: [],
    },
    {
      id: 'c2',
      dniRaw: '28999888',
      nombre: 'María Gómez',
      email: 'maria@example.com',
      activos: 1,
      situKey: 'Con mora',
      actions: [],
    },
  ]

  const exportableCols = columns.filter((c) => c.kind !== 'actions')
  assert.equal(exportableCols.length, 5)

  const data = rows.map((r, i) => {
    const item: Record<string, unknown> = { '#': i + 1 }
    for (const c of exportableCols) {
      item[c.label] = r[c.key]
    }
    return item
  })

  const sheet = XLSX.utils.json_to_sheet(data)
  assert.ok(sheet['!ref'])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Clientes')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  assert.ok(buffer.length > 0)

  // Verify readable back from buffer
  const readWb = XLSX.read(buffer, { type: 'buffer' })
  assert.equal(readWb.SheetNames[0], 'Clientes')
  const readRows = XLSX.utils.sheet_to_json(readWb.Sheets['Clientes'])
  assert.equal(readRows.length, 2)
  assert.equal((readRows[0] as Record<string, unknown>)['Nombre Completo'], 'Juan Pérez')
  assert.equal((readRows[1] as Record<string, unknown>)['Situación'], 'Con mora')
})
