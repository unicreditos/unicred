import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Productos' }

export default async function ProductosPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Productos" description="Líneas de crédito, montos, plazos y costo financiero." />
  if (!perms.has('credits.read')) return <>{head}<NoAccess what="los productos" /></>

  const rows: GridRow[] = state.products.map((p) => ({
    id: p.id,
    nombre: p.name,
    min: p.minAmount,
    max: p.maxAmount,
    plazos: p.minInstallments === p.maxInstallments ? String(p.minInstallments) : `${p.minInstallments} a ${p.maxInstallments}`,
    tna: p.tna,
    tea: p.tea,
    cft: p.cft,
    estadoKey: p.active ? 'Activo' : 'Pausado',
    estado: p.active ? badge('Activo', 'success') : badge('Pausado', 'warning'),
  }))

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'productos',
          rows,
          sort: { key: 'nombre', dir: 1 },
          searchKeys: ['nombre'],
          searchPlaceholder: 'Producto',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Activo', l: 'Activos' },
              { v: 'Pausado', l: 'Pausados' },
            ],
          },
          columns: [
            { key: 'nombre', label: 'Producto' },
            { key: 'min', label: 'Monto mínimo', kind: 'money', align: 'r' },
            { key: 'max', label: 'Monto máximo', kind: 'money', align: 'r' },
            { key: 'plazos', label: 'Cuotas', kind: 'num', align: 'c' },
            { key: 'tna', label: 'TNA', kind: 'pct', align: 'r' },
            { key: 'cft', label: 'CFT', kind: 'pct', align: 'r', amount: true },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Activo', 'Pausado'] },
          ],
          summary: { noun: 'productos' },
        }}
      />
    </>
  )
}
