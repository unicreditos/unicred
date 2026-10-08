import { DataGrid } from '@/components/uc/data-grid'
import { NoAccess, PageHead } from '@/components/uc/blocks'
import type { GridRow } from '@/components/uc/grid-types'
import { loadDesk } from '@/lib/admin-desk/load'
import { badge } from '@/lib/uc/admin'

export const metadata = { title: 'Operadores' }

const ROLE: Record<string, string> = {
  director: 'Director',
  originacion: 'Originación',
  tesoreria: 'Tesorería',
  riesgo: 'Riesgo',
  soporte: 'Soporte',
  auditor: 'Auditoría',
}

export default async function OperadoresPage() {
  const { state, perms } = await loadDesk()
  const head = <PageHead title="Operadores" description="Usuarios internos del backoffice y su rol." />
  if (!perms.has('users.manage')) return <>{head}<NoAccess what="los operadores" /></>

  const rows: GridRow[] = state.operators.map((o) => ({
    id: o.id,
    nombre: o.name,
    email: o.email,
    rol: ROLE[o.role] ?? o.role,
    acceso: o.lastSeen,
    estadoKey: o.active ? 'Activo' : 'Inactivo',
    estado: o.active ? badge('Activo', 'success') : badge('Inactivo', 'neutral'),
  }))

  return (
    <>
      {head}
      <DataGrid
        cfg={{
          id: 'ops',
          rows,
          sort: { key: 'nombre', dir: 1 },
          searchKeys: ['nombre', 'email'],
          searchPlaceholder: 'Nombre o email',
          chips: {
            label: 'Estado',
            key: 'estadoKey',
            options: [
              { v: 'all', l: 'Todos' },
              { v: 'Activo', l: 'Activos' },
              { v: 'Inactivo', l: 'Inactivos' },
            ],
          },
          selects: [{ key: 'rol', label: 'Rol', all: 'Rol: todos' }],
          columns: [
            { key: 'nombre', label: 'Operador' },
            { key: 'email', label: 'Email', muted: true },
            { key: 'rol', label: 'Rol' },
            { key: 'acceso', label: 'Última actividad', kind: 'datetime' },
            { key: 'estado', label: 'Estado', kind: 'badge', order: ['Activo', 'Inactivo'] },
          ],
          summary: { noun: 'operadores' },
        }}
      />
    </>
  )
}
